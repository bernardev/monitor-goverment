import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { ConsultaDeMunicipios } from '@prometeu/consulta';
import type { AutorNoMunicipio, MunicipioResumo } from '@prometeu/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CONSULTA_DE_MUNICIPIOS, MunicipiosController } from './municipios.controller.js';

const SAPUCAIA: MunicipioResumo = { codigoIbge: '4320008', nome: 'Sapucaia do Sul', uf: 'RS' };
const BANCADA: AutorNoMunicipio = {
  pessoaId: null,
  nome: 'BANCADA DO RIO GRANDE DO SUL',
  siglaPartido: null,
  cargo: null,
  emendas: 1,
  empenhadoCentavos: '300000',
  pagoCentavos: '200000',
};

class MunicipiosFalsos implements ConsultaDeMunicipios {
  ultimoNome: string | undefined;

  buscar(nome: string): Promise<MunicipioResumo[]> {
    this.ultimoNome = nome;
    return Promise.resolve([SAPUCAIA]);
  }

  porCodigo(codigoIbge: string): Promise<MunicipioResumo | undefined> {
    return Promise.resolve(codigoIbge === SAPUCAIA.codigoIbge ? SAPUCAIA : undefined);
  }

  porCodigos(codigos: readonly string[]): Promise<MunicipioResumo[]> {
    return Promise.resolve(codigos.includes(SAPUCAIA.codigoIbge) ? [SAPUCAIA] : []);
  }

  autoresDeEmendas(codigoIbge: string): Promise<AutorNoMunicipio[]> {
    return Promise.resolve(codigoIbge === SAPUCAIA.codigoIbge ? [BANCADA] : []);
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

  it('lista quem mandou dinheiro de emenda para o município', async () => {
    const resposta = await request(servidor).get('/v1/municipios/4320008/autores').expect(200);

    expect(resposta.body).toEqual([BANCADA]);
    await request(servidor).get('/v1/municipios/9999999/autores').expect(404);
  });
});
