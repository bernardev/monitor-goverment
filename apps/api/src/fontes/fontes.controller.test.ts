import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { ConsultaDeFontes } from '@prometeu/consulta';
import type { SituacaoDaFonte } from '@prometeu/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CONSULTA_DE_FONTES, FontesController } from './fontes.controller.js';

const camara: SituacaoDaFonte = {
  fonte: 'camara',
  nome: 'Câmara dos Deputados',
  periodicidade: 'diaria',
  ultimaColetaEm: '2026-10-31T09:00:00.000Z',
  situacao: 'em_dia',
  tabelas: [],
};

const fontes: ConsultaDeFontes = { situacao: () => Promise.resolve([camara]) };

describe('GET /v1/fontes', () => {
  let app: INestApplication;
  let servidor: Parameters<typeof request>[0];

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [FontesController],
      providers: [{ provide: CONSULTA_DE_FONTES, useValue: fontes }],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
    // getHttpServer() é tipado como `any` pelo Nest.
    servidor = app.getHttpServer() as Parameters<typeof request>[0];
  });

  afterAll(async () => {
    await app.close();
  });

  it('lista a situação de cada fonte, com cache para a CDN', async () => {
    const resposta = await request(servidor).get('/v1/fontes').expect(200);

    expect(resposta.body).toEqual([camara]);
    expect(resposta.headers['cache-control']).toContain('s-maxage=300');
  });
});
