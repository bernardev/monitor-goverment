import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  ConsultaDeFrequencia,
  ConsultaDeParlamentares,
  FiltroDeParlamentares,
  PeriodoEmDias,
} from '@prometeu/consulta';
import type {
  FrequenciaDoParlamentar,
  Pagina,
  ParlamentarResumo,
  PerfilDeParlamentar,
} from '@prometeu/contracts';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { CONSULTA_DE_EMENDAS } from '../emendas/emendas.controller.js';
import { EmendasFalsas } from '../emendas/emendas-falsas.js';
import { CONSULTA_DE_PROPOSICOES } from '../proposicoes/proposicoes.controller.js';
import { ProposicoesFalsas } from '../proposicoes/proposicoes-falsas.js';
import { VotacoesFalsas } from '../votacoes/votacoes-falsas.js';
import {
  CONSULTA_DE_FREQUENCIA,
  CONSULTA_DE_PARLAMENTARES,
  CONSULTA_DE_VOTACOES,
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
  ultimoPeriodo: PeriodoEmDias | undefined;

  doParlamentar(pessoaId: string, periodo: PeriodoEmDias): Promise<FrequenciaDoParlamentar> {
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
  const votacoes = new VotacoesFalsas();
  const proposicoes = new ProposicoesFalsas();
  const emendas = new EmendasFalsas();
  let servidor: Parameters<typeof request>[0];

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [ParlamentaresController],
      providers: [
        { provide: CONSULTA_DE_PARLAMENTARES, useValue: consulta },
        { provide: CONSULTA_DE_FREQUENCIA, useValue: frequencia },
        { provide: CONSULTA_DE_VOTACOES, useValue: votacoes },
        { provide: CONSULTA_DE_PROPOSICOES, useValue: proposicoes },
        { provide: CONSULTA_DE_EMENDAS, useValue: emendas },
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
    votacoes.ultimoPeriodo = undefined;
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

  it('devolve os votos do período pedido', async () => {
    const resposta = await request(servidor)
      .get(`/v1/parlamentares/${ANA}/votos?de=2026-10-01&ate=2026-10-31`)
      .expect(200);

    expect(votacoes.ultimoPeriodo).toEqual({ de: '2026-10-01', ate: '2026-10-31' });
    expect(resposta.body).toMatchObject({ pessoaId: ANA, resumo: { votacoes: 0 } });
  });

  it('devolve as proposições de autoria, paginadas', async () => {
    const resposta = await request(servidor)
      .get(`/v1/parlamentares/${ANA}/proposicoes?pagina=2&itens=5`)
      .expect(200);

    expect(proposicoes.ultimaPaginacao).toEqual({ pagina: 2, itensPorPagina: 5 });
    expect(resposta.body).toMatchObject({ total: 1, itens: [{ proponente: true }] });
    await request(servidor).get('/v1/parlamentares/nao-e-uuid/proposicoes').expect(404);
  });

  it('devolve as emendas de que é autor, com a soma da execução', async () => {
    const resposta = await request(servidor)
      .get(`/v1/parlamentares/${ANA}/emendas?pagina=3&itens=20`)
      .expect(200);

    expect(emendas.ultimaPaginacao).toEqual({ pagina: 3, itensPorPagina: 20 });
    expect(resposta.body).toMatchObject({ total: 1, soma: { pagoCentavos: '50000000' } });
    await request(servidor).get('/v1/parlamentares/nao-e-uuid/emendas').expect(404);
  });

  it('votos: período inválido é 400 e parlamentar desconhecido é 404', async () => {
    await request(servidor).get(`/v1/parlamentares/${ANA}/votos?de=2026-13-01`).expect(400);
    await request(servidor)
      .get('/v1/parlamentares/0192d5e0-4444-7000-8000-0000000000ff/votos')
      .expect(404);
    expect(votacoes.ultimoPeriodo).toBeUndefined();
  });
});
