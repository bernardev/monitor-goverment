import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CONSULTA_DE_OBRAS, ObrasController } from './obras.controller.js';
import { OBRA, ObrasFalsas } from './obras-falsas.js';

describe('GET /v1/obras', () => {
  let app: INestApplication;
  const obras = new ObrasFalsas();
  let servidor: Parameters<typeof request>[0];

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [ObrasController],
      providers: [{ provide: CONSULTA_DE_OBRAS, useValue: obras }],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
    // getHttpServer() é tipado como `any` pelo Nest.
    servidor = app.getHttpServer() as Parameters<typeof request>[0];
  });

  afterAll(async () => {
    await app.close();
  });

  it('lista com filtros de UF e situação, paginação e cache para a CDN', async () => {
    const resposta = await request(servidor)
      .get('/v1/obras?uf=rs&situacao=paralisada&pagina=2&itens=10')
      .expect(200);

    expect(obras.ultimoFiltro).toEqual({
      uf: 'rs',
      situacao: 'paralisada',
      pagina: 2,
      itensPorPagina: 10,
    });
    expect(resposta.body).toMatchObject({
      total: 1,
      itens: [{ obraId: OBRA, medicao: { percentualCentesimos: 2335 } }],
    });
    expect(resposta.headers['cache-control']).toContain('s-maxage=300');
  });

  it.each(['situacao=atrasada', 'uf=Rio', 'itens=500'])(
    'recusa parâmetro inválido (%s) com 400',
    async (query) => {
      await request(servidor).get(`/v1/obras?${query}`).expect(400);
    },
  );

  it('detalha a obra', async () => {
    const resposta = await request(servidor).get(`/v1/obras/${OBRA}`).expect(200);
    expect(resposta.body).toMatchObject({ idNaFonte: '151020.43-16', emendas: [] });
  });

  it('responde 404 para obra desconhecida', async () => {
    const resposta = await request(servidor).get('/v1/obras/desconhecida').expect(404);
    expect(resposta.body).toMatchObject({ mensagem: 'Obra não encontrada.' });
  });
});
