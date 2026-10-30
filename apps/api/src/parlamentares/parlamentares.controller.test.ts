import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { ConsultaDeParlamentares, FiltroDeParlamentares } from '@prometeu/consulta';
import type { Pagina, ParlamentarResumo, PerfilDeParlamentar } from '@prometeu/contracts';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { CONSULTA_DE_PARLAMENTARES, ParlamentaresController } from './parlamentares.controller.js';

const ANA = '0192d5e0-4444-7000-8000-00000000000a';

const perfil: PerfilDeParlamentar = {
  pessoaId: ANA,
  nome: 'Ana Exemplo',
  siglaPartido: 'PEX',
  uf: 'SP',
  cargo: 'deputado_federal',
  urlDaFoto: null,
  mandato: null,
  fonte: { capturaId: ANA, url: 'https://camara.leg.br', coletadaEm: '2026-10-30T09:00:00.000Z' },
  atualizadoEm: '2026-10-30T09:00:00.000Z',
};

class ConsultaFalsa implements ConsultaDeParlamentares {
  ultimoFiltro: FiltroDeParlamentares | undefined;

  listar(filtro: FiltroDeParlamentares): Promise<Pagina<ParlamentarResumo>> {
    this.ultimoFiltro = filtro;
    return Promise.resolve({
      itens: [perfil],
      pagina: filtro.pagina,
      itensPorPagina: 50,
      total: 1,
    });
  }

  buscar(pessoaId: string): Promise<PerfilDeParlamentar | undefined> {
    return Promise.resolve(pessoaId === ANA ? perfil : undefined);
  }
}

describe('GET /v1/parlamentares', () => {
  let app: INestApplication;
  const consulta = new ConsultaFalsa();
  let servidor: Parameters<typeof request>[0];

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [ParlamentaresController],
      providers: [{ provide: CONSULTA_DE_PARLAMENTARES, useValue: consulta }],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
    // getHttpServer() é tipado como `any` pelo Nest.
    servidor = app.getHttpServer() as Parameters<typeof request>[0];
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    consulta.ultimoFiltro = undefined;
  });

  it('lista com paginação padrão e cabeçalho de cache para a CDN', async () => {
    const resposta = await request(servidor).get('/v1/parlamentares').expect(200);

    expect(resposta.body).toMatchObject({ total: 1, itens: [{ nome: 'Ana Exemplo' }] });
    expect(resposta.headers['cache-control']).toContain('s-maxage=300');
    expect(consulta.ultimoFiltro).toEqual({
      uf: undefined,
      partido: undefined,
      pagina: 1,
      itensPorPagina: 50,
    });
  });

  it('repassa filtros e paginação da query', async () => {
    await request(servidor)
      .get('/v1/parlamentares?uf=sp&partido=PEX&pagina=2&itens=10')
      .expect(200);

    expect(consulta.ultimoFiltro).toEqual({
      uf: 'sp',
      partido: 'PEX',
      pagina: 2,
      itensPorPagina: 10,
    });
  });

  it.each(['uf=SAO', 'itens=500', 'pagina=0', 'pagina=abc'])(
    'recusa parâmetro inválido (%s) com 400',
    async (query) => {
      const resposta = await request(servidor).get(`/v1/parlamentares?${query}`).expect(400);
      expect(resposta.body).toMatchObject({ mensagem: 'Parâmetros inválidos.' });
    },
  );

  it('devolve o perfil com a fonte', async () => {
    const resposta = await request(servidor).get(`/v1/parlamentares/${ANA}`).expect(200);
    expect(resposta.body).toEqual(perfil);
  });

  it.each(['0192d5e0-4444-7000-8000-0000000000ff', 'nao-e-uuid'])(
    'responde 404 para %s',
    async (id) => {
      await request(servidor).get(`/v1/parlamentares/${id}`).expect(404);
    },
  );
});
