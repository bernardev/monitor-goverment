import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { ConsultaDeMunicipios } from '@prometeu/consulta';
import type { MunicipioResumo } from '@prometeu/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CONSULTA_DE_MUNICIPIOS, MunicipiosController } from './municipios.controller.js';

const SAPUCAIA: MunicipioResumo = { codigoIbge: '4320008', nome: 'Sapucaia do Sul', uf: 'RS' };

class MunicipiosFalsos implements ConsultaDeMunicipios {
  ultimoNome: string | undefined;

  buscar(nome: string): Promise<MunicipioResumo[]> {
    this.ultimoNome = nome;
    return Promise.resolve([SAPUCAIA]);
  }

  porCodigo(codigoIbge: string): Promise<MunicipioResumo | undefined> {
    return Promise.resolve(codigoIbge === SAPUCAIA.codigoIbge ? SAPUCAIA : undefined);
  }
}

describe('GET /v1/municipios', () => {
  let app: INestApplication;
  const municipios = new MunicipiosFalsos();
  let servidor: Parameters<typeof request>[0];

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [MunicipiosController],
      providers: [{ provide: CONSULTA_DE_MUNICIPIOS, useValue: municipios }],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
    // getHttpServer() é tipado como `any` pelo Nest.
    servidor = app.getHttpServer() as Parameters<typeof request>[0];
  });

  afterAll(async () => {
    await app.close();
  });

  it('busca pelo nome', async () => {
    const resposta = await request(servidor).get('/v1/municipios?nome=%20sapucaia%20').expect(200);

    expect(municipios.ultimoNome).toBe('sapucaia');
    expect(resposta.body).toEqual([SAPUCAIA]);
  });

  it.each(['', 'nome=s'])('recusa busca sem nome ou curta demais (%s) com 400', async (query) => {
    await request(servidor).get(`/v1/municipios?${query}`).expect(400);
  });

  it('acha pelo código IBGE, e responde 404 para desconhecido', async () => {
    await request(servidor).get('/v1/municipios/4320008').expect(200);
    await request(servidor).get('/v1/municipios/9999999').expect(404);
  });
});
