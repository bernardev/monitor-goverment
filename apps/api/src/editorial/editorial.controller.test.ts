import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { CapturarDocumento } from '@prometeu/acervo';
import type { ConsultaDeMandatos } from '@prometeu/agentes-publicos';
import {
  MIGRACOES_DE_COMPROMISSOS,
  montarCompromissos,
  SCHEMA_DE_COMPROMISSOS,
} from '@prometeu/compromissos';
import { BancoDoContexto, migrar } from '@prometeu/infraestrutura';
import { iniciarPostgresDeTeste, type PostgresDeTeste } from '@prometeu/infraestrutura/testes';
import { gerarUuidV7, Result } from '@prometeu/shared-kernel';
import { createLocalJWKSet, exportJWK, generateKeyPair, type CryptoKey, SignJWT } from 'jose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { GuardaDeAutenticacao } from '../autenticacao/guarda.js';
import { type Papel, VerificadorDeToken } from '../autenticacao/verificador-de-token.js';
import {
  CAPTURAR_DOCUMENTO,
  EditorialController,
  MODULO_COMPROMISSOS,
} from './editorial.controller.js';

const EMISSOR = 'https://identidade.teste/realms/prometeu';
const CURADORA = '0b6c3a52-6f1e-4d5a-9a3e-2f1d0c9b8a71';
const REVISOR = '7e2d9c14-3b8a-4f6e-8d1c-5a9b0e3f2c48';
const EDITORA = 'c4f1e8a2-9d3b-4c7e-a6f5-1b2d3e4f5a69';
const CAPTURA = gerarUuidV7();

const semMandatos: Pick<ConsultaDeMandatos, 'buscar'> = {
  buscar: () => Promise.resolve(undefined),
};
const capturaFalsa = {
  execute: () =>
    Promise.resolve(Result.ok({ capturaId: CAPTURA, sha256: 'a'.repeat(64), nova: true })),
} as unknown as CapturarDocumento;

const novaPromessa = {
  pessoaId: gerarUuidV7(),
  mandatoId: gerarUuidV7(),
  texto: 'Construir 500 creches até 2026',
  tema: 'educacao',
  mensurabilidade: 'mensuravel',
  competencia: 'propria',
  fonte: {
    tipo: 'plano_de_governo',
    capturaId: CAPTURA,
    citacaoLiteral: 'Vamos construir 500 creches.',
    localizacao: { tipo: 'pagina', pagina: 12 },
    dataDaDeclaracao: '2022-08-15T12:00:00Z',
  },
};

describe('API editorial com login', () => {
  let postgres: PostgresDeTeste;
  let banco: BancoDoContexto;
  let app: INestApplication;
  let servidor: Parameters<typeof request>[0];
  let chavePrivada: CryptoKey;

  const token = (sub: string, papeis: Papel[], emissor = EMISSOR, expira = '5m') =>
    new SignJWT({ realm_access: { roles: papeis }, name: 'Pessoa de Teste' })
      .setProtectedHeader({ alg: 'RS256', kid: 'teste' })
      .setSubject(sub)
      .setIssuer(emissor)
      .setAudience('prometeu-api')
      .setIssuedAt()
      .setExpirationTime(expira)
      .sign(chavePrivada);

  const como = async (sub: string, papeis: Papel[]) => ({
    Authorization: `Bearer ${await token(sub, papeis)}`,
  });

  beforeAll(async () => {
    const chaves = await generateKeyPair('RS256');
    chavePrivada = chaves.privateKey;
    const publica = { ...(await exportJWK(chaves.publicKey)), kid: 'teste', alg: 'RS256' };

    postgres = await iniciarPostgresDeTeste();
    banco = BancoDoContexto.conectar(
      SCHEMA_DE_COMPROMISSOS,
      postgres.urlDoContexto(SCHEMA_DE_COMPROMISSOS),
    );
    await migrar(banco, MIGRACOES_DE_COMPROMISSOS);

    const modulo = await Test.createTestingModule({
      controllers: [EditorialController],
      providers: [
        GuardaDeAutenticacao,
        {
          provide: VerificadorDeToken,
          useValue: new VerificadorDeToken({
            emissor: EMISSOR,
            audiencia: 'prometeu-api',
            chaves: createLocalJWKSet({ keys: [publica] }),
          }),
        },
        {
          provide: MODULO_COMPROMISSOS,
          useValue: montarCompromissos({ banco, mandatos: semMandatos }),
        },
        { provide: CAPTURAR_DOCUMENTO, useValue: capturaFalsa },
      ],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
    servidor = app.getHttpServer() as Parameters<typeof request>[0];
  });

  afterAll(async () => {
    await app.close();
    await banco.fechar();
    await postgres.parar();
  });

  it('sem token, com token de outro emissor ou vencido: 401', async () => {
    await request(servidor).get('/v1/editorial/promessas').expect(401);
    for (const invalido of [
      await token(CURADORA, ['curador'], 'https://outro-emissor/realms/x'),
      await token(CURADORA, ['curador'], EMISSOR, '-1m'),
      'nao-e-um-token',
    ]) {
      await request(servidor)
        .get('/v1/editorial/promessas')
        .set('Authorization', `Bearer ${invalido}`)
        .expect(401);
    }
  });

  it('cidadão não entra na API editorial: 403', async () => {
    await request(servidor)
      .get('/v1/editorial/promessas')
      .set(await como(gerarUuidV7(), ['cidadao']))
      .expect(403);
  });

  it('revisor não registra promessa: 403', async () => {
    await request(servidor)
      .post('/v1/editorial/promessas')
      .set(await como(REVISOR, ['revisor']))
      .send(novaPromessa)
      .expect(403);
  });

  it('corpo fora do formato: 400; regra de negócio violada: 422 com o código', async () => {
    const curadora = await como(CURADORA, ['curador']);
    const formato = await request(servidor)
      .post('/v1/editorial/promessas')
      .set(curadora)
      .send({ ...novaPromessa, pessoaId: 'x' })
      .expect(400);
    expect(formato.body).toMatchObject({ problemas: [{ campo: 'pessoaId' }] });

    const regra = await request(servidor)
      .post('/v1/editorial/promessas')
      .set(curadora)
      .send({ ...novaPromessa, texto: '   ' })
      .expect(422);
    expect(regra.body).toMatchObject({ codigo: 'promessa.texto_vazio' });
  });

  it('jornada: curadora registra e propõe; revisor publica; autor de cada ato vem do token', async () => {
    const curadora = await como(CURADORA, ['curador']);
    const registrada = await request(servidor)
      .post('/v1/editorial/promessas')
      .set(curadora)
      .send(novaPromessa)
      .expect(201);
    const promessaId = (registrada.body as { promessaId: string }).promessaId;

    await request(servidor)
      .post(`/v1/editorial/promessas/${promessaId}/vereditos`)
      .set(curadora)
      .send({ veredito: 'em_andamento', justificativa: 'Licitação aberta.', evidencias: [CAPTURA] })
      .expect(204);
    await request(servidor)
      .post(`/v1/editorial/promessas/${promessaId}/vereditos/publicacao`)
      .set(curadora)
      .expect(403);
    await request(servidor)
      .post(`/v1/editorial/promessas/${promessaId}/vereditos/publicacao`)
      .set(await como(REVISOR, ['revisor']))
      .expect(201);

    const vista = await request(servidor)
      .get(`/v1/editorial/promessas/${promessaId}`)
      .set(curadora)
      .expect(200);
    expect(vista.headers['cache-control']).toBe('no-store');
    expect(vista.body).toMatchObject({
      vereditoVigente: 'em_andamento',
      historico: [{ propostoPor: CURADORA, revisadoPor: REVISOR }],
    });
  });

  it('regra dos quatro olhos vale mesmo para quem tem papel de editora-chefe', async () => {
    const editora = await como(EDITORA, ['curador', 'editor_chefe']);
    const registrada = await request(servidor)
      .post('/v1/editorial/promessas')
      .set(editora)
      .send(novaPromessa)
      .expect(201);
    const promessaId = (registrada.body as { promessaId: string }).promessaId;
    for (const veredito of ['em_andamento', 'travada']) {
      await request(servidor)
        .post(`/v1/editorial/promessas/${promessaId}/vereditos`)
        .set(editora)
        .send({ veredito, justificativa: 'Evidência.', evidencias: [CAPTURA] })
        .expect(204);
      const publicacao = await request(servidor)
        .post(`/v1/editorial/promessas/${promessaId}/vereditos/publicacao`)
        .set(editora);
      if (veredito === 'em_andamento') expect(publicacao.status).toBe(201);
      else {
        expect(publicacao.status).toBe(422);
        expect(publicacao.body).toMatchObject({ codigo: 'veredito.revisor_igual_ao_curador' });
      }
    }
  });

  it('promessa inexistente: 404', async () => {
    const curadora = await como(CURADORA, ['curador']);
    await request(servidor)
      .get(`/v1/editorial/promessas/${gerarUuidV7()}`)
      .set(curadora)
      .expect(404);
    await request(servidor)
      .post(`/v1/editorial/promessas/${gerarUuidV7()}/vereditos/recusa`)
      .set(curadora)
      .send({ motivo: 'teste' })
      .expect(404);
  });

  it('captura de documento só aceita https', async () => {
    const curadora = await como(CURADORA, ['curador']);
    await request(servidor)
      .post('/v1/editorial/capturas')
      .set(curadora)
      .send({ url: 'http://tse.jus.br/plano.pdf' })
      .expect(400);
    const capturada = await request(servidor)
      .post('/v1/editorial/capturas')
      .set(curadora)
      .send({ url: 'https://tse.jus.br/plano.pdf' })
      .expect(201);
    expect(capturada.body).toMatchObject({ capturaId: CAPTURA });
  });
});
