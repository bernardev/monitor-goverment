import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  ConsultaDeFrequencia,
  ConsultaDeParlamentares,
  FiltroDeParlamentares,
  PeriodoDeFrequencia,
} from '@prometeu/consulta';
import type {
  FrequenciaDoParlamentar,
  Pagina,
  ParlamentarResumo,
  PerfilDeParlamentar,
} from '@prometeu/contracts';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  CONSULTA_DE_FREQUENCIA,
  CONSULTA_DE_PARLAMENTARES,
  ParlamentaresController,
} from './parlamentares.controller.js';

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

class FrequenciaFalsa implements ConsultaDeFrequencia {
  ultimoPeriodo: PeriodoDeFrequencia | undefined;

  doParlamentar(pessoaId: string, periodo: PeriodoDeFrequencia): Promise<FrequenciaDoParlamentar> {
    this.ultimoPeriodo = periodo;
    return Promise.resolve({
      pessoaId,
      ...periodo,
      resumo: {
        diasComSessao: 0,
        presencas: 0,
        ausenciasJustificadas: 0,
        ausenciasSemJustificativa: 0,
        porMotivo: [],
      },
      dias: [],
    });
  }
}

describe('GET /v1/parlamentares', () => {
  let app: INestApplication;
  const consulta = new ConsultaFalsa();
  const frequencia = new FrequenciaFalsa();
  let servidor: Parameters<typeof request>[0];

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [ParlamentaresController],
      providers: [
        { provide: CONSULTA_DE_PARLAMENTARES, useValue: consulta },
        { provide: CONSULTA_DE_FREQUENCIA, useValue: frequencia },
      ],
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
    frequencia.ultimoPeriodo = undefined;
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

  it('devolve a frequência do período pedido', async () => {
    const resposta = await request(servidor)
      .get(`/v1/parlamentares/${ANA}/frequencia?de=2026-10-01&ate=2026-10-31`)
      .expect(200);

    expect(frequencia.ultimoPeriodo).toEqual({ de: '2026-10-01', ate: '2026-10-31' });
    expect(resposta.body).toMatchObject({ pessoaId: ANA, resumo: { diasComSessao: 0 } });
    expect(resposta.headers['cache-control']).toContain('s-maxage=300');
  });

  it('sem período, cobre os últimos 90 dias', async () => {
    await request(servidor).get(`/v1/parlamentares/${ANA}/frequencia`).expect(200);

    const { de, ate } = frequencia.ultimoPeriodo ?? { de: '', ate: '' };
    expect((Date.parse(ate) - Date.parse(de)) / 86_400_000).toBe(89);
  });

  it.each([
    'de=01/10/2026',
    'de=2026-02-30',
    'de=2026-10-31&ate=2026-10-01',
    'de=2025-01-01&ate=2026-10-01',
  ])('recusa período inválido (%s) com 400', async (query) => {
    await request(servidor).get(`/v1/parlamentares/${ANA}/frequencia?${query}`).expect(400);
    expect(frequencia.ultimoPeriodo).toBeUndefined();
  });

  it('responde 404 para parlamentar desconhecido', async () => {
    await request(servidor).get('/v1/parlamentares/nao-e-uuid/frequencia').expect(404);
  });
});
