import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CONSULTA_DE_PROPOSICOES, ProposicoesController } from './proposicoes.controller.js';
import { PROPOSICAO, ProposicoesFalsas } from './proposicoes-falsas.js';

describe('GET /v1/proposicoes', () => {
  let app: INestApplication;
  const proposicoes = new ProposicoesFalsas();
  let servidor: Parameters<typeof request>[0];

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [ProposicoesController],
      providers: [{ provide: CONSULTA_DE_PROPOSICOES, useValue: proposicoes }],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
    // getHttpServer() é tipado como `any` pelo Nest.
    servidor = app.getHttpServer() as Parameters<typeof request>[0];
  });

  afterAll(async () => {
    await app.close();
  });

  it('lista com filtros de casa e tipo, paginação e cache para a CDN', async () => {
    const resposta = await request(servidor)
      .get('/v1/proposicoes?casa=senado&tipo=PEC&pagina=2&itens=10')
      .expect(200);

    expect(proposicoes.ultimoFiltro).toEqual({
      casa: 'senado_federal',
      sigla: 'PEC',
      pagina: 2,
      itensPorPagina: 10,
    });
    expect(resposta.body).toMatchObject({ total: 1, itens: [{ proposicaoId: PROPOSICAO }] });
    expect(resposta.headers['cache-control']).toContain('s-maxage=300');
  });

  it.each(['tipo=REQ', 'casa=stf', 'itens=500'])(
    'recusa parâmetro inválido (%s) com 400',
    async (query) => {
      await request(servidor).get(`/v1/proposicoes?${query}`).expect(400);
    },
  );

  it('detalha a proposição', async () => {
    const resposta = await request(servidor).get(`/v1/proposicoes/${PROPOSICAO}`).expect(200);
    expect(resposta.body).toMatchObject({ sigla: 'PL', numero: 901 });
  });

  it('responde 404 para proposição desconhecida', async () => {
    await request(servidor).get('/v1/proposicoes/0192d5e0-8888-7000-8000-0000000000ff').expect(404);
  });
});
