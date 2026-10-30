import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module.js';

describe('GET /saude', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde que a API está de pé', async () => {
    // getHttpServer() é tipado como `any` pelo Nest.
    const servidor = app.getHttpServer() as Parameters<typeof request>[0];
    const resposta = await request(servidor).get('/saude').expect(200);
    expect(resposta.body).toEqual({ status: 'ok', servico: 'api' });
  });
});
