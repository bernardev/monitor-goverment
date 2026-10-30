import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CONSULTA_DE_EMENDAS, EmendasController } from './emendas.controller.js';
import { EMENDA, EmendasFalsas } from './emendas-falsas.js';

describe('GET /v1/emendas', () => {
  let app: INestApplication;
  const emendas = new EmendasFalsas();
  let servidor: Parameters<typeof request>[0];

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [EmendasController],
      providers: [{ provide: CONSULTA_DE_EMENDAS, useValue: emendas }],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
    // getHttpServer() é tipado como `any` pelo Nest.
    servidor = app.getHttpServer() as Parameters<typeof request>[0];
  });

  afterAll(async () => {
    await app.close();
  });

  it('lista com filtros de ano, tipo e UF, paginação e cache para a CDN', async () => {
    const resposta = await request(servidor)
      .get('/v1/emendas?ano=2026&tipo=bancada&uf=ba&pagina=2&itens=10')
      .expect(200);

    expect(emendas.ultimoFiltro).toEqual({
      ano: 2026,
      tipo: 'bancada',
      uf: 'ba',
      pagina: 2,
      itensPorPagina: 10,
    });
    expect(resposta.body).toMatchObject({
      total: 1,
      itens: [{ emendaId: EMENDA, execucao: { pagoCentavos: '50000000' } }],
    });
    expect(resposta.headers['cache-control']).toContain('s-maxage=300');
  });

  it.each(['tipo=pix', 'ano=1999', 'uf=Bahia', 'itens=500'])(
    'recusa parâmetro inválido (%s) com 400',
    async (query) => {
      await request(servidor).get(`/v1/emendas?${query}`).expect(400);
    },
  );

  it('detalha a emenda', async () => {
    const resposta = await request(servidor).get(`/v1/emendas/${EMENDA}`).expect(200);
    expect(resposta.body).toMatchObject({ codigoNaFonte: '202690010001', destinacoes: [] });
  });

  it('responde 404 para emenda desconhecida', async () => {
    await request(servidor).get('/v1/emendas/0192d5e0-6666-7000-8000-0000000000ff').expect(404);
  });
});
