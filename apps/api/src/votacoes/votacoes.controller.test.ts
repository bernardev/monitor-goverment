import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CONSULTA_DE_VOTACOES } from '../parlamentares/parlamentares.controller.js';
import { VotacoesController } from './votacoes.controller.js';
import { VOTACAO, VotacoesFalsas } from './votacoes-falsas.js';

describe('GET /v1/votacoes', () => {
  let app: INestApplication;
  const votacoes = new VotacoesFalsas();
  let servidor: Parameters<typeof request>[0];

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [VotacoesController],
      providers: [{ provide: CONSULTA_DE_VOTACOES, useValue: votacoes }],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
    // getHttpServer() é tipado como `any` pelo Nest.
    servidor = app.getHttpServer() as Parameters<typeof request>[0];
  });

  afterAll(async () => {
    await app.close();
  });

  it('lista as votações do período com paginação e cache para a CDN', async () => {
    const resposta = await request(servidor)
      .get('/v1/votacoes?de=2026-10-01&ate=2026-10-31&pagina=2&itens=10')
      .expect(200);

    expect(votacoes.ultimoFiltro).toEqual({
      de: '2026-10-01',
      ate: '2026-10-31',
      casa: undefined,
      pagina: 2,
      itensPorPagina: 10,
    });
    expect(resposta.body).toMatchObject({ total: 1, itens: [{ votacaoId: VOTACAO }] });
    expect(resposta.headers['cache-control']).toContain('s-maxage=300');
  });

  it('sem parâmetros, cobre os últimos 90 dias na primeira página', async () => {
    await request(servidor).get('/v1/votacoes').expect(200);

    const { de, ate, pagina, itensPorPagina } = votacoes.ultimoFiltro ?? {};
    expect((Date.parse(ate ?? '') - Date.parse(de ?? '')) / 86_400_000).toBe(89);
    expect([pagina, itensPorPagina]).toEqual([1, 50]);
  });

  it('filtra pela casa', async () => {
    await request(servidor).get('/v1/votacoes?casa=senado').expect(200);

    expect(votacoes.ultimoFiltro?.casa).toBe('senado_federal');
  });

  it.each(['de=2026-10-31&ate=2026-10-01', 'itens=500', 'de=ontem', 'casa=stf'])(
    'recusa parâmetro inválido (%s) com 400',
    async (query) => {
      await request(servidor).get(`/v1/votacoes?${query}`).expect(400);
    },
  );

  it('detalha a votação com as fontes', async () => {
    const resposta = await request(servidor).get(`/v1/votacoes/${VOTACAO}`).expect(200);

    expect(resposta.body).toMatchObject({
      votacaoId: VOTACAO,
      fonteDosVotos: { url: 'https://camara/votacoes/1/votos' },
    });
  });

  it('responde 404 para votação desconhecida', async () => {
    await request(servidor).get('/v1/votacoes/0192d5e0-7777-7000-8000-0000000000ff').expect(404);
  });
});
