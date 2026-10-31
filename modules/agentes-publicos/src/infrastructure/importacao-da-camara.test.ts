import { MIGRACOES_DO_ACERVO, montarAcervo, SCHEMA_DO_ACERVO } from '@prometeu/acervo';
import type { EnvelopeDeEvento } from '@prometeu/contracts';
import { BancoDoContexto, migrar } from '@prometeu/infraestrutura';
import {
  BarramentoEmMemoria,
  iniciarPostgresDeTeste,
  type PostgresDeTeste,
} from '@prometeu/infraestrutura/testes';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  MIGRACOES_DE_AGENTES_PUBLICOS,
  type ModuloAgentesPublicos,
  montarAgentesPublicos,
  type ResumoDaImportacao,
  SCHEMA_DE_AGENTES_PUBLICOS,
} from '../index.js';
import { AGORA } from '../testes/construtores.js';
import { RelogioFixo } from '../testes/fakes.js';
import { mandato, outbox, pessoa } from './esquema.js';

const LOTE_1 = '0192d5e0-3333-7000-8000-000000000001';
const LOTE_2 = '0192d5e0-3333-7000-8000-000000000002';
const LOTE_3 = '0192d5e0-3333-7000-8000-000000000003';

// Tabelas prata como a plataforma de dados as cria (data-platform/migracoes, contrato v2.1.0).
const PRATA = sql.raw(`
  CREATE TABLE ingestao.camara_legislatura (
    id_legislatura integer PRIMARY KEY, data_inicio date NOT NULL, data_fim date NOT NULL,
    lote_id uuid NOT NULL, origem_fonte text NOT NULL, origem_url text NOT NULL,
    origem_coletada_em timestamptz NOT NULL, origem_sha256 char(64) NOT NULL,
    origem_caminho text NOT NULL, origem_tipo_de_conteudo text NOT NULL
  );
  CREATE TABLE ingestao.camara_deputado (
    id_deputado integer NOT NULL, id_legislatura integer NOT NULL, nome text NOT NULL,
    sigla_partido text NOT NULL, sigla_uf char(2) NOT NULL, url_foto text,
    exercicios jsonb NOT NULL,
    lote_id uuid NOT NULL, origem_fonte text NOT NULL, origem_url text NOT NULL,
    origem_coletada_em timestamptz NOT NULL, origem_sha256 char(64) NOT NULL,
    origem_caminho text NOT NULL, origem_tipo_de_conteudo text NOT NULL,
    PRIMARY KEY (id_deputado, id_legislatura)
  );
`);

const LEGISLATURA_57 = sql`
  INSERT INTO ingestao.camara_legislatura VALUES
    (57, '2023-02-01', '2027-01-31', ${LOTE_1}, 'camara', 'https://camara/legislaturas/57',
     '2026-10-30T09:00:00Z', ${'1'.repeat(64)}, 'bronze/camara/l', 'application/json');
`;

const LEGISLATURA_56 = sql`
  INSERT INTO ingestao.camara_legislatura VALUES
    (56, '2019-02-01', '2023-01-31', ${LOTE_3}, 'camara', 'https://camara/legislaturas/56',
     '2026-10-30T09:00:00Z', ${'2'.repeat(64)}, 'bronze/camara/l', 'application/json');
`;

/**
 * A legislatura anterior: a Ana, reeleita, era de outro partido; o Davi saiu com ela, e o exercício
 * dele ficou aberto na fonte.
 */
function daLegislaturaAnterior(lote: string) {
  const origem = sql`${lote}, 'camara', 'https://camara/deputados', '2026-10-30T09:00:00Z', ${'c'.repeat(64)}, 'bronze/camara/d', 'application/json'`;
  const daAna = JSON.stringify([
    { inicio: '2019-02-01T10:00:00-03:00', fim: '2023-01-31T23:59:00-03:00' },
  ]);
  const doDavi = JSON.stringify([{ inicio: '2019-02-01T10:00:00-03:00', fim: null }]);
  return sql`
    INSERT INTO ingestao.camara_deputado VALUES
      (900001, 56, 'Ana Exemplo', 'POU', 'SP', null, ${daAna}, ${origem}),
      (900004, 56, 'Davi Antigo', 'PEX', 'PE', null, ${doDavi}, ${origem})
  `;
}

const EXERCICIOS_DA_ANA = JSON.stringify([
  { inicio: '2023-02-01T12:05:00-03:00', fim: '2026-03-31T18:00:00-03:00' },
  { inicio: '2026-07-31T10:30:00-03:00', fim: null },
]);
const EXERCICIOS_DO_BRUNO = JSON.stringify([
  { inicio: '2026-06-16T17:13:00-03:00', fim: '2026-10-15T00:00:00-03:00' },
]);
const EXERCICIOS_DA_CARLA = JSON.stringify([{ inicio: '2023-02-01T12:05:00-03:00', fim: null }]);

function deputados(lote: string, sha256: string, partidoDaAna: string) {
  const origem = sql`${lote}, 'camara', 'https://camara/deputados', '2026-10-30T09:00:00Z', ${sha256}, 'bronze/camara/d', 'application/json'`;
  return sql`
    INSERT INTO ingestao.camara_deputado VALUES
      (900001, 57, 'Ana Exemplo', ${partidoDaAna}, 'SP', null, ${EXERCICIOS_DA_ANA}, ${origem}),
      (900002, 57, 'Bruno Modelo', 'PMO', 'BA', 'https://camara.leg.br/900002.jpg',
       ${EXERCICIOS_DO_BRUNO}, ${origem}),
      (900003, 57, 'Uf Inexistente', 'PEX', 'XX', null, ${EXERCICIOS_DA_CARLA}, ${origem})
    ON CONFLICT (id_deputado, id_legislatura) DO UPDATE SET
      sigla_partido = EXCLUDED.sigla_partido, lote_id = EXCLUDED.lote_id,
      origem_sha256 = EXCLUDED.origem_sha256
  `;
}

const loteIngerido = (id: string, tabela = 'camara_deputado'): EnvelopeDeEvento => ({
  id,
  tipo: 'LoteIngerido',
  versao: 1,
  ocorridoEm: '2026-10-30T09:00:00.000Z',
  idDoAgregado: `camara.${tabela}`,
  idDeCorrelacao: `ingestao-${id}`,
  dados: {
    fonte: 'camara',
    tabela,
    versaoDoContrato: '2.1.0',
    coletadoDe: '2026-10-30T09:00:00Z',
    coletadoAte: '2026-10-30T09:00:00Z',
    registros: 3,
  },
});

describe('importação de deputados da Câmara (prata → Agentes Públicos)', () => {
  let postgres: PostgresDeTeste;
  let bancoDoAcervo: BancoDoContexto;
  let banco: BancoDoContexto;
  let ingestao: BancoDoContexto;
  const barramento = new BarramentoEmMemoria();
  const resumos: ResumoDaImportacao[] = [];
  let modulo: ModuloAgentesPublicos;

  beforeAll(async () => {
    postgres = await iniciarPostgresDeTeste();
    bancoDoAcervo = BancoDoContexto.conectar(
      SCHEMA_DO_ACERVO,
      postgres.urlDoContexto(SCHEMA_DO_ACERVO),
    );
    banco = BancoDoContexto.conectar(
      SCHEMA_DE_AGENTES_PUBLICOS,
      postgres.urlDoContexto(SCHEMA_DE_AGENTES_PUBLICOS),
    );
    ingestao = BancoDoContexto.conectar('ingestao', postgres.urlDoContexto('ingestao'));
    await migrar(bancoDoAcervo, MIGRACOES_DO_ACERVO);
    await migrar(banco, MIGRACOES_DE_AGENTES_PUBLICOS);
    await ingestao.drizzle.execute(PRATA);
    await ingestao.drizzle.execute(LEGISLATURA_57);

    const relogio = new RelogioFixo(AGORA);
    modulo = montarAgentesPublicos({
      banco,
      registrarCaptura: montarAcervo(bancoDoAcervo, relogio).registrarCaptura,
      relogio,
    });
    await modulo.assinarConsumidores(barramento, (resumo) => resumos.push(resumo));
  });

  afterAll(async () => {
    await Promise.all([bancoDoAcervo.fechar(), banco.fechar(), ingestao.fechar()]);
    await postgres.parar();
  });

  it('importa o lote: pessoas, um mandato por exercício, capturas e eventos na outbox', async () => {
    await ingestao.drizzle.execute(deputados(LOTE_1, 'a'.repeat(64), 'PEX'));

    await barramento.publicar(loteIngerido(LOTE_1));

    expect(resumos.at(-1)).toMatchObject({ loteId: LOTE_1, lidos: 3, pessoasNovas: 2 });
    expect(resumos.at(-1)?.falhas).toEqual([
      expect.objectContaining({ codigoNaFonte: '900003', erro: 'codigo_ibge.uf_invalida' }),
    ]);

    const pessoas = await banco.drizzle.select().from(pessoa).orderBy(pessoa.nome);
    expect(pessoas.map((p) => [p.nome, p.siglaPartido])).toEqual([
      ['Ana Exemplo', 'PEX'],
      ['Bruno Modelo', 'PMO'],
    ]);
    const mandatos = await banco.drizzle
      .select()
      .from(mandato)
      .orderBy(mandato.circunscricao, mandato.inicio);
    expect(
      mandatos.map((m) => [m.circunscricao, m.inicio.toISOString(), m.fim?.toISOString()]),
    ).toEqual([
      ['29', '2026-06-16T20:13:00.000Z', '2026-10-15T03:00:00.000Z'],
      ['35', '2023-02-01T15:05:00.000Z', '2026-03-31T21:00:00.000Z'],
      // Em curso: termina, no máximo, com a legislatura.
      ['35', '2026-07-31T13:30:00.000Z', '2027-02-01T02:59:59.999Z'],
    ]);

    const eventos = await banco.drizzle.select().from(outbox);
    expect(eventos.map((e) => e.tipo).sort()).toEqual([
      'MandatoRegistrado',
      'MandatoRegistrado',
      'MandatoRegistrado',
      'PessoaRegistrada',
      'PessoaRegistrada',
    ]);
    expect(new Set(eventos.map((e) => e.idDeCorrelacao))).toEqual(new Set([`ingestao-${LOTE_1}`]));

    const capturas = await bancoDoAcervo.drizzle.execute(
      sql`SELECT count(*)::int AS n FROM acervo.captura`,
    );
    expect(capturas.rows).toEqual([{ n: 1 }]);
  });

  it('outros contextos consultam o mandato importado pelo id', async () => {
    const [registrado] = await banco.drizzle
      .select()
      .from(mandato)
      .where(sql`circunscricao = '35'`)
      .orderBy(sql`inicio DESC`);
    if (!registrado) throw new Error('Mandato não importado.');

    expect(await modulo.mandatos.buscar(registrado.id)).toMatchObject({
      cargo: 'deputado_federal',
      circunscricao: '35',
      fim: new Date('2027-02-01T02:59:59.999Z'),
    });
    expect(await modulo.mandatos.buscar('0192d5e0-9999-7000-8000-000000000000')).toBeUndefined();
    expect(await modulo.mandatos.buscar('nao-e-uuid')).toBeUndefined();
  });

  it('outros contextos acham o mandato vigente pelo código da fonte', async () => {
    const ana = { fonte: 'camara', codigo: '900001' } as const;
    const dentro = new Date('2026-10-06T15:00:00.000Z');

    expect(await modulo.mandatos.vigente(ana, 'deputado_federal', dentro)).toMatchObject({
      cargo: 'deputado_federal',
      circunscricao: '35',
    });
    expect(
      await modulo.mandatos.vigente(ana, 'deputado_federal', new Date('2027-02-01T03:00:00.000Z')),
    ).toBeUndefined();
    expect(await modulo.mandatos.vigente(ana, 'senador', dentro)).toBeUndefined();
    // De licença, a Ana não estava no cargo; o suplente Bruno esteve só entre a posse e a saída.
    const deLicenca = new Date('2026-05-04T15:00:00.000Z');
    expect(await modulo.mandatos.vigente(ana, 'deputado_federal', deLicenca)).toBeUndefined();
    const bruno = { fonte: 'camara', codigo: '900002' } as const;
    expect(await modulo.mandatos.vigente(bruno, 'deputado_federal', dentro)).toBeDefined();
    expect(
      await modulo.mandatos.vigente(bruno, 'deputado_federal', new Date('2026-10-20T15:00:00Z')),
    ).toBeUndefined();
    expect(
      await modulo.mandatos.vigente(
        { fonte: 'senado', codigo: '900001' },
        'deputado_federal',
        dentro,
      ),
    ).toBeUndefined();
  });

  it('o mesmo evento entregue de novo não produz efeito', async () => {
    const antes = await banco.drizzle.select().from(outbox);

    await barramento.publicar(loteIngerido(LOTE_1));

    expect(await banco.drizzle.select().from(outbox)).toHaveLength(antes.length);
  });

  it('um lote novo registra só a troca de partido, com a nova captura', async () => {
    await banco.drizzle.execute(sql`TRUNCATE agentes_publicos.outbox`);
    await ingestao.drizzle.execute(deputados(LOTE_2, 'b'.repeat(64), 'S.PART.'));

    await barramento.publicar(loteIngerido(LOTE_2));

    const eventos = await banco.drizzle.select().from(outbox);
    expect(eventos.map((e) => [e.tipo, e.dados['de'], e.dados['para']])).toEqual([
      ['FiliacaoPartidariaAlterada', 'PEX', null],
    ]);
    expect(resumos.at(-1)).toMatchObject({ loteId: LOTE_2, pessoasNovas: 0 });
  });

  it('com a legislatura anterior, o reeleito ganha o mandato antigo sem trocar de partido', async () => {
    await banco.drizzle.execute(sql`TRUNCATE agentes_publicos.outbox`);
    await ingestao.drizzle.execute(LEGISLATURA_56);
    await ingestao.drizzle.execute(deputados(LOTE_3, 'b'.repeat(64), 'S.PART.'));
    await ingestao.drizzle.execute(daLegislaturaAnterior(LOTE_3));

    await barramento.publicar(loteIngerido(LOTE_3));

    expect(resumos.at(-1)).toMatchObject({ loteId: LOTE_3, lidos: 5, pessoasNovas: 1 });
    const eventos = await banco.drizzle.select().from(outbox);
    expect(eventos.map((e) => e.tipo).sort()).toEqual([
      'MandatoRegistrado',
      'MandatoRegistrado',
      'PessoaRegistrada',
    ]);

    const emJunhoDe2022 = new Date('2022-06-01T15:00:00.000Z');
    const ana = { fonte: 'camara', codigo: '900001' } as const;
    expect(await modulo.mandatos.vigente(ana, 'deputado_federal', emJunhoDe2022)).toMatchObject({
      circunscricao: '35',
      fim: new Date('2023-02-01T02:59:00.000Z'),
    });
    // O exercício aberto na fonte termina com a legislatura.
    const davi = { fonte: 'camara', codigo: '900004' } as const;
    expect(await modulo.mandatos.vigente(davi, 'deputado_federal', emJunhoDe2022)).toMatchObject({
      circunscricao: '26',
      fim: new Date('2023-02-01T02:59:59.999Z'),
    });
    const em2022 = await modulo.pessoas.parlamentaresEmExercicio(
      new Date('2022-01-01T03:00:00.000Z'),
      new Date('2023-01-01T02:59:59.999Z'),
    );
    expect(em2022.map((p) => p.nome).sort()).toEqual(['Ana Exemplo', 'Davi Antigo']);
  });

  it('ignora lotes de outras tabelas', async () => {
    const quantos = resumos.length;

    await barramento.publicar(
      loteIngerido('0192d5e0-3333-7000-8000-000000000009', 'camara_legislatura'),
    );

    expect(resumos).toHaveLength(quantos);
  });
});
