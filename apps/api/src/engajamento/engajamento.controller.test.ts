import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  MIGRACOES_DE_ENGAJAMENTO,
  montarEngajamento,
  SCHEMA_DE_ENGAJAMENTO,
} from '@prometeu/engajamento';
import { BancoDoContexto, migrar } from '@prometeu/infraestrutura';
import { iniciarPostgresDeTeste, type PostgresDeTeste } from '@prometeu/infraestrutura/testes';
import { createLocalJWKSet, exportJWK, generateKeyPair, type CryptoKey, SignJWT } from 'jose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { GuardaDeAutenticacao } from '../autenticacao/guarda.js';
import { type Papel, VerificadorDeToken } from '../autenticacao/verificador-de-token.js';
import {
  ALVOS,
  type AlvosAcompanhaveis,
  EngajamentoController,
  MODULO_ENGAJAMENTO,
} from './engajamento.controller.js';

const EMISSOR = 'https://identidade.teste/realms/prometeu';
const MARIA = '5a1f2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const JOAO = '6b2a3c4d-5e6f-4a71-9b8c-0d1e2f3a4b5c';
const DEPUTADA = '01a18ca8-18f3-7861-a9f8-3a7105869469';
const PORTO_ALEGRE = '4314902';

/** A Consulta de mentira: uma deputada e uma cidade existem; o resto, não. */
const alvos: AlvosAcompanhaveis = {
  existe: (tipo, id) =>
    Promise.resolve(tipo === 'parlamentar' ? id === DEPUTADA : id === PORTO_ALEGRE),
  descrever: () =>
    Promise.resolve(
      new Map([
        [`parlamentar:${DEPUTADA}`, { titulo: 'Ana Exemplo', detalhe: 'PEX-SP' }],
        [`municipio:${PORTO_ALEGRE}`, { titulo: 'Porto Alegre', detalhe: 'RS' }],
      ]),
    ),
};

describe('API da conta do cidadão', () => {
  let postgres: PostgresDeTeste;
  let banco: BancoDoContexto;
  let app: INestApplication;
  let servidor: Parameters<typeof request>[0];
  let chavePrivada: CryptoKey;

  const como = async (sub: string, papeis: Papel[]) => ({
    Authorization: `Bearer ${await new SignJWT({ realm_access: { roles: papeis } })
      .setProtectedHeader({ alg: 'RS256', kid: 'teste' })
      .setSubject(sub)
      .setIssuer(EMISSOR)
      .setAudience('prometeu-api')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(chavePrivada)}`,
  });

  beforeAll(async () => {
    const chaves = await generateKeyPair('RS256');
    chavePrivada = chaves.privateKey;
    const publica = { ...(await exportJWK(chaves.publicKey)), kid: 'teste', alg: 'RS256' };

    postgres = await iniciarPostgresDeTeste();
    banco = BancoDoContexto.conectar(
      SCHEMA_DE_ENGAJAMENTO,
      postgres.urlDoContexto(SCHEMA_DE_ENGAJAMENTO),
    );
    await migrar(banco, MIGRACOES_DE_ENGAJAMENTO);

    const modulo = await Test.createTestingModule({
      controllers: [EngajamentoController],
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
        { provide: MODULO_ENGAJAMENTO, useValue: montarEngajamento(banco) },
        { provide: ALVOS, useValue: alvos },
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

  it('sem login, 401; com conta só editorial, 403', async () => {
    await request(servidor).get('/v1/eu/acompanhamentos').expect(401);
    await request(servidor)
      .get('/v1/eu/acompanhamentos')
      .set(await como(MARIA, ['curador']))
      .expect(403);
  });

  it('acompanha, lista com os nomes, deixa de acompanhar; cada um vê só o seu', async () => {
    const maria = await como(MARIA, ['cidadao']);
    const lista = async (quem: Record<string, string>) => {
      const resposta = await request(servidor).get('/v1/eu/acompanhamentos').set(quem).expect(200);
      expect(resposta.headers['cache-control']).toBe('private, no-store');
      return (resposta.body as { id: string; titulo: string }[]).map((a) => a.titulo);
    };

    await request(servidor)
      .put(`/v1/eu/acompanhamentos/municipio/${PORTO_ALEGRE}`)
      .set(maria)
      .expect(204);
    await request(servidor)
      .put(`/v1/eu/acompanhamentos/parlamentar/${DEPUTADA.toUpperCase()}`)
      .set(maria)
      .expect(204);
    // De novo: não é erro nem duplica.
    await request(servidor)
      .put(`/v1/eu/acompanhamentos/municipio/${PORTO_ALEGRE}`)
      .set(maria)
      .expect(204);
    expect(await lista(maria)).toEqual(['Ana Exemplo', 'Porto Alegre']);
    expect(await lista(await como(JOAO, ['cidadao']))).toEqual([]);

    await request(servidor)
      .delete(`/v1/eu/acompanhamentos/municipio/${PORTO_ALEGRE}`)
      .set(maria)
      .expect(204);
    expect(await lista(maria)).toEqual(['Ana Exemplo']);
  });

  it('alvo que não existe, 404; tipo desconhecido ou identificador malformado, 400', async () => {
    const joao = await como(JOAO, ['cidadao']);
    await request(servidor).put('/v1/eu/acompanhamentos/municipio/3550308').set(joao).expect(404);
    await request(servidor)
      .put(`/v1/eu/acompanhamentos/promessa/${DEPUTADA}`)
      .set(joao)
      .expect(400);
    await request(servidor).delete('/v1/eu/acompanhamentos/municipio/12').set(joao).expect(400);
  });

  it('apagar meus dados leva tudo o que a pessoa acompanha', async () => {
    const joao = await como(JOAO, ['cidadao']);
    await request(servidor)
      .put(`/v1/eu/acompanhamentos/municipio/${PORTO_ALEGRE}`)
      .set(joao)
      .expect(204);

    await request(servidor).delete('/v1/eu').set(joao).expect(204);

    const resposta = await request(servidor).get('/v1/eu/acompanhamentos').set(joao).expect(200);
    expect(resposta.body).toEqual([]);
  });
});
