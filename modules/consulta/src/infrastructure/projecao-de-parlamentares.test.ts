import type { EnvelopeDeEvento } from '@prometeu/contracts';
import { BancoDoContexto, migrar } from '@prometeu/infraestrutura';
import {
  BarramentoEmMemoria,
  iniciarPostgresDeTeste,
  type PostgresDeTeste,
} from '@prometeu/infraestrutura/testes';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  type ConsultaDeParlamentares,
  MIGRACOES_DA_CONSULTA,
  montarConsulta,
  SCHEMA_DA_CONSULTA,
} from '../index.js';

const ANA = '0192d5e0-4444-7000-8000-00000000000a';
const BRUNO = '0192d5e0-4444-7000-8000-00000000000b';
const CAPTURA_1 = '0192d5e0-5555-7000-8000-000000000001';
const CAPTURA_2 = '0192d5e0-5555-7000-8000-000000000002';
const MANDATO = '0192d5e0-6666-7000-8000-000000000001';

let sequencia = 0;
function evento(
  tipo: string,
  idDoAgregado: string,
  ocorridoEm: string,
  dados: Record<string, unknown>,
): EnvelopeDeEvento {
  sequencia += 1;
  return {
    id: `0192d5e0-7777-7000-8000-${String(sequencia).padStart(12, '0')}`,
    tipo,
    versao: 1,
    ocorridoEm,
    idDoAgregado,
    idDeCorrelacao: 'teste',
    dados,
  };
}

const registrada = (pessoaId: string, nome: string, partido: string | null, quando: string) =>
  evento('PessoaRegistrada', pessoaId, quando, {
    nome,
    siglaPartido: partido,
    urlDaFoto: null,
    identificadores: [{ fonte: 'camara', codigo: '1' }],
    capturaId: CAPTURA_1,
  });

const AGORA = new Date('2026-10-30T12:00:00.000Z');

const mandato = (
  pessoaId: string,
  circunscricao: string,
  quando: string,
  periodo = { inicio: '2023-02-01T03:00:00.000Z', fim: '2027-02-01T02:59:59.999Z' },
  mandatoId = MANDATO,
) =>
  evento('MandatoRegistrado', pessoaId, quando, {
    mandatoId,
    cargo: 'deputado_federal',
    circunscricao,
    ...periodo,
    capturaId: CAPTURA_1,
  });

const retificado = (pessoaId: string, inicio: string, fim: string, quando: string) =>
  evento('PeriodoDoMandatoRetificado', pessoaId, quando, {
    mandatoId: MANDATO,
    inicio,
    fim,
    inicioAnterior: '2023-02-01T03:00:00.000Z',
    fimAnterior: '2027-02-01T02:59:59.999Z',
    capturaId: CAPTURA_2,
  });

const filiacao = (pessoaId: string, de: string | null, para: string | null, quando: string) =>
  evento('FiliacaoPartidariaAlterada', pessoaId, quando, { de, para, capturaId: CAPTURA_2 });

const capturaRegistrada = (capturaId: string, url: string) =>
  evento('CapturaRegistrada', capturaId, '2026-10-30T09:00:00.000Z', {
    sha256: 'a'.repeat(64),
    fonte: 'camara',
    url,
    coletadaEm: '2026-10-30T09:00:00.000Z',
    tipoDeConteudo: 'application/json',
  });

describe('projeção de parlamentares', () => {
  let postgres: PostgresDeTeste;
  let banco: BancoDoContexto;
  let barramento: BarramentoEmMemoria;
  let consulta: ConsultaDeParlamentares;

  beforeAll(async () => {
    postgres = await iniciarPostgresDeTeste();
    banco = BancoDoContexto.conectar(
      SCHEMA_DA_CONSULTA,
      postgres.urlDoContexto(SCHEMA_DA_CONSULTA),
    );
    await migrar(banco, MIGRACOES_DA_CONSULTA);
  });

  afterAll(async () => {
    await banco.fechar();
    await postgres.parar();
  });

  beforeEach(async () => {
    await banco.drizzle.execute(
      sql`TRUNCATE consulta.parlamentar, consulta.captura, consulta.inbox`,
    );
    barramento = new BarramentoEmMemoria();
    const modulo = montarConsulta(banco, { agora: () => AGORA });
    await modulo.assinarConsumidores(barramento);
    consulta = modulo.parlamentares;
  });

  const publicar = async (...envelopes: EnvelopeDeEvento[]) => {
    for (const envelope of envelopes) await barramento.publicar(envelope);
  };

  it('monta o perfil com mandato e a fonte de cada dado', async () => {
    await publicar(
      capturaRegistrada(CAPTURA_1, 'https://dadosabertos.camara.leg.br/api/v2/deputados'),
      registrada(ANA, 'Ana Exemplo', 'PEX', '2026-10-30T09:00:00.000Z'),
      mandato(ANA, '35', '2026-10-30T09:00:00.000Z'),
    );

    expect(await consulta.buscar(ANA)).toEqual({
      pessoaId: ANA,
      nome: 'Ana Exemplo',
      siglaPartido: 'PEX',
      uf: 'SP',
      cargo: 'deputado_federal',
      urlDaFoto: null,
      fonte: {
        capturaId: CAPTURA_1,
        url: 'https://dadosabertos.camara.leg.br/api/v2/deputados',
        coletadaEm: '2026-10-30T09:00:00.000Z',
      },
      mandato: {
        mandatoId: MANDATO,
        cargo: 'deputado_federal',
        circunscricao: '35',
        inicio: '2023-02-01T03:00:00.000Z',
        fim: '2027-02-01T02:59:59.999Z',
        fonte: expect.objectContaining({ capturaId: CAPTURA_1 }) as unknown,
      },
      atualizadoEm: '2026-10-30T09:00:00.000Z',
    });
  });

  it('eventos fora de ordem chegam ao mesmo resultado', async () => {
    await publicar(
      filiacao(ANA, 'PEX', 'PMO', '2026-11-05T09:00:00.000Z'),
      mandato(ANA, '35', '2026-10-30T09:00:00.000Z'),
      registrada(ANA, 'Ana Exemplo', 'PEX', '2026-10-30T09:00:00.000Z'),
    );

    const perfil = await consulta.buscar(ANA);
    expect(perfil?.siglaPartido).toBe('PMO');
    expect(perfil?.fonte.capturaId).toBe(CAPTURA_2);
    expect(perfil?.fonte.url).toBeNull();
  });

  it('o mesmo evento entregue de novo não muda nada', async () => {
    const troca = filiacao(ANA, 'PEX', 'PMO', '2026-11-05T09:00:00.000Z');
    await publicar(registrada(ANA, 'Ana Exemplo', 'PEX', '2026-10-30T09:00:00.000Z'), troca);
    await publicar(filiacao(ANA, 'PMO', null, '2026-11-10T09:00:00.000Z'), troca);

    expect((await consulta.buscar(ANA))?.siglaPartido).toBeNull();
  });

  it('não exibe quem só tem mandato, sem o evento de registro', async () => {
    await publicar(mandato(BRUNO, '29', '2026-10-30T09:00:00.000Z'));

    expect(await consulta.buscar(BRUNO)).toBeUndefined();
    expect((await consulta.listar({ pagina: 1, itensPorPagina: 10 })).total).toBe(0);
  });

  it('lista em ordem alfabética, filtra por UF e partido e pagina', async () => {
    await publicar(
      registrada(BRUNO, 'Bruno Modelo', 'PMO', '2026-10-30T09:00:00.000Z'),
      mandato(BRUNO, '29', '2026-10-30T09:00:00.000Z'),
      registrada(ANA, 'Ana Exemplo', 'PEX', '2026-10-30T09:00:00.000Z'),
      mandato(ANA, '35', '2026-10-30T09:00:00.000Z'),
    );

    const todos = await consulta.listar({ pagina: 1, itensPorPagina: 1 });
    expect(todos.total).toBe(2);
    expect(todos.itens.map((p) => p.nome)).toEqual(['Ana Exemplo']);
    expect(
      (await consulta.listar({ pagina: 2, itensPorPagina: 1 })).itens.map((p) => p.nome),
    ).toEqual(['Bruno Modelo']);
    expect(
      (await consulta.listar({ uf: 'ba', pagina: 1, itensPorPagina: 10 })).itens.map((p) => p.uf),
    ).toEqual(['BA']);
    expect((await consulta.listar({ partido: 'PEX', pagina: 1, itensPorPagina: 10 })).total).toBe(
      1,
    );
    expect((await consulta.listar({ uf: 'XX', pagina: 1, itensPorPagina: 10 })).total).toBe(0);
  });

  it('a retificação muda o período do mandato exibido, e um exercício mais novo o substitui', async () => {
    await publicar(
      registrada(ANA, 'Ana Exemplo', 'PEX', '2026-10-30T09:00:00.000Z'),
      mandato(ANA, '35', '2026-10-30T09:00:00.000Z'),
      retificado(
        ANA,
        '2023-02-01T15:05:00.000Z',
        '2026-03-31T21:00:00.000Z',
        '2026-10-30T10:00:00.000Z',
      ),
    );
    expect((await consulta.buscar(ANA))?.mandato).toMatchObject({
      inicio: '2023-02-01T15:05:00.000Z',
      fim: '2026-03-31T21:00:00.000Z',
    });

    const REASSUNCAO = '0192d5e0-6666-7000-8000-000000000002';
    await publicar(
      mandato(
        ANA,
        '35',
        '2026-10-30T10:00:00.000Z',
        { inicio: '2026-07-31T13:30:00.000Z', fim: '2027-02-01T02:59:59.999Z' },
        REASSUNCAO,
      ),
    );
    expect((await consulta.buscar(ANA))?.mandato).toMatchObject({ mandatoId: REASSUNCAO });
  });

  it('lista só quem está no cargo; o suplente que saiu mantém o perfil', async () => {
    await publicar(
      registrada(ANA, 'Ana Exemplo', 'PEX', '2026-10-30T09:00:00.000Z'),
      mandato(ANA, '35', '2026-10-30T09:00:00.000Z'),
      registrada(BRUNO, 'Bruno Modelo', 'PMO', '2026-10-30T09:00:00.000Z'),
      mandato(BRUNO, '29', '2026-10-30T09:00:00.000Z', {
        inicio: '2026-06-16T20:13:00.000Z',
        fim: '2026-10-15T03:00:00.000Z',
      }),
    );

    const lista = await consulta.listar({ pagina: 1, itensPorPagina: 10 });

    expect(lista.itens.map((p) => p.nome)).toEqual(['Ana Exemplo']);
    expect((await consulta.buscar(BRUNO))?.mandato?.fim).toBe('2026-10-15T03:00:00.000Z');
    // A busca por nome acha também quem saiu, sem importar acento nem maiúsculas.
    const busca = async (nome: string) =>
      (await consulta.listar({ nome, pagina: 1, itensPorPagina: 10 })).itens.map((p) => p.nome);
    expect(await busca('BRUNO')).toEqual(['Bruno Modelo']);
    expect(await busca('exêmplo')).toEqual(['Ana Exemplo']);
    expect(await busca('ninguém')).toEqual([]);
  });
});
