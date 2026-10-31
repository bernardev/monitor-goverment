import { MIGRACOES_DO_ACERVO, montarAcervo, SCHEMA_DO_ACERVO } from '@prometeu/acervo';
import {
  MIGRACOES_DE_AGENTES_PUBLICOS,
  montarAgentesPublicos,
  SCHEMA_DE_AGENTES_PUBLICOS,
} from '@prometeu/agentes-publicos';
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
  MIGRACOES_DE_FINANCAS_PUBLICAS,
  montarFinancasPublicas,
  type ResumoDaImportacao,
  SCHEMA_DE_FINANCAS_PUBLICAS,
} from '../index.js';
import { convenio, emenda, favorecidosDaEmenda, outbox } from './esquema.js';

const AGORA = new Date('2026-10-30T12:00:00.000Z');
const LOTE_1 = '0192d5e0-9999-7000-8000-0000000000e1';
const LOTE_2 = '0192d5e0-9999-7000-8000-0000000000e2';
const LOTE_DE_FAVORECIDOS = '0192d5e0-9999-7000-8000-0000000000f1';
const LOTE_DE_CONVENIOS = '0192d5e0-9999-7000-8000-0000000000c1';

// Tabelas prata como a plataforma de dados as cria (data-platform/migracoes, contrato v1.1.0).
const PRATA = sql.raw(`
  CREATE TABLE ingestao.transparencia_emenda (
    codigo_emenda text NOT NULL, ano integer NOT NULL, tipo text NOT NULL,
    codigo_autor text NOT NULL, nome_autor text NOT NULL, numero_emenda text NOT NULL,
    localidade text NOT NULL, codigo_municipio_ibge char(7), codigo_uf_ibge char(7),
    codigo_funcao text NOT NULL, nome_funcao text NOT NULL, codigo_subfuncao text NOT NULL,
    nome_subfuncao text NOT NULL, codigo_programa text NOT NULL, nome_programa text NOT NULL,
    codigo_acao text NOT NULL, nome_acao text NOT NULL, codigo_plano_orcamentario text NOT NULL,
    nome_plano_orcamentario text NOT NULL, empenhado_centavos bigint NOT NULL,
    liquidado_centavos bigint NOT NULL, pago_centavos bigint NOT NULL,
    restos_inscritos_centavos bigint NOT NULL, restos_cancelados_centavos bigint NOT NULL,
    restos_pagos_centavos bigint NOT NULL,
    lote_id uuid NOT NULL, origem_fonte text NOT NULL, origem_url text NOT NULL,
    origem_coletada_em timestamptz NOT NULL, origem_sha256 char(64) NOT NULL,
    origem_caminho text NOT NULL, origem_tipo_de_conteudo text NOT NULL,
    PRIMARY KEY (codigo_emenda, localidade, codigo_funcao, codigo_subfuncao, codigo_programa,
      codigo_acao, codigo_plano_orcamentario)
  );
  CREATE TABLE ingestao.transparencia_emenda_favorecido (
    codigo_emenda text NOT NULL, mes char(7) NOT NULL, tipo_favorecido text NOT NULL,
    codigo_favorecido text, nome_favorecido text, natureza_juridica text, uf char(2),
    municipio text, quantidade integer NOT NULL, valor_centavos bigint NOT NULL,
    lote_id uuid NOT NULL, origem_fonte text NOT NULL, origem_url text NOT NULL,
    origem_coletada_em timestamptz NOT NULL, origem_sha256 char(64) NOT NULL,
    origem_caminho text NOT NULL, origem_tipo_de_conteudo text NOT NULL,
    UNIQUE NULLS NOT DISTINCT (codigo_emenda, mes, tipo_favorecido, codigo_favorecido, uf, municipio)
  );
  CREATE TABLE ingestao.transparencia_emenda_convenio (
    codigo_emenda text NOT NULL, numero_convenio text NOT NULL, codigo_funcao text NOT NULL,
    nome_funcao text NOT NULL, codigo_subfuncao text NOT NULL, nome_subfuncao text NOT NULL,
    localidade text NOT NULL, publicado_em date NOT NULL, convenente text NOT NULL, objeto text,
    valor_centavos bigint NOT NULL,
    lote_id uuid NOT NULL, origem_fonte text NOT NULL, origem_url text NOT NULL,
    origem_coletada_em timestamptz NOT NULL, origem_sha256 char(64) NOT NULL,
    origem_caminho text NOT NULL, origem_tipo_de_conteudo text NOT NULL,
    PRIMARY KEY (codigo_emenda, numero_convenio, codigo_funcao, codigo_subfuncao, localidade)
  );
`);

const origemDoLote = (lote: string) => sql`
  ${lote}, 'portal_transparencia', 'https://portal/emendas', '2026-10-30T09:00:00Z',
  ${lote.replace(/-/g, '').padEnd(64, '0')}, 'bronze/portal/emendas', 'application/zip'
`;

/**
 * O hospital recebeu da emenda da Ana em dois meses; as bolsistas chegam somadas, sem nome. A emenda
 * do ex-deputado traz um tipo de favorecido fora do contrato.
 */
const FAVORECIDOS = sql`
  INSERT INTO ingestao.transparencia_emenda_favorecido VALUES
    ('202690010001', '2026-05', 'Pessoa Jurídica', '12345678000190', 'HOSPITAL EXEMPLO',
      'Associação Privada', 'SP', 'SÃO PAULO', 1, 50000000, ${origemDoLote(LOTE_DE_FAVORECIDOS)}),
    ('202690010001', '2026-06', 'Pessoa Jurídica', '12345678000190', 'HOSPITAL EXEMPLO',
      'Associação Privada', 'SP', 'SÃO PAULO', 1, 25000000, ${origemDoLote(LOTE_DE_FAVORECIDOS)}),
    ('202690010001', '2026-05', 'Pessoa Física', NULL, NULL, NULL, 'SP', 'SÃO PAULO', 3, 180050,
      ${origemDoLote(LOTE_DE_FAVORECIDOS)}),
    ('202690020001', '2026-05', 'Pessoa Misteriosa', NULL, NULL, NULL, NULL, NULL, 1, 100,
      ${origemDoLote(LOTE_DE_FAVORECIDOS)})
`;

/** O convênio 825378 é pago por duas emendas; o 900001 se contradiz entre as linhas. */
const CONVENIOS = sql`
  INSERT INTO ingestao.transparencia_emenda_convenio VALUES
    ('202690010001', '825378', '10', 'Saúde', '302', 'Assistência hospitalar', 'SÃO PAULO (UF)',
      '2026-01-06', 'HOSPITAL EXEMPLO', 'AQUISICAO DE EQUIPAMENTO', 145000000,
      ${origemDoLote(LOTE_DE_CONVENIOS)}),
    ('202490010007', '825378', '10', 'Saúde', '302', 'Assistência hospitalar', 'Nacional',
      '2026-01-06', 'HOSPITAL EXEMPLO', 'AQUISICAO DE EQUIPAMENTO', 145000000,
      ${origemDoLote(LOTE_DE_CONVENIOS)}),
    ('202690010001', '900001', '10', 'Saúde', '302', 'Assistência hospitalar', 'SÃO PAULO (UF)',
      '2026-02-01', 'FUNDACAO EXEMPLO', NULL, 100000, ${origemDoLote(LOTE_DE_CONVENIOS)}),
    ('202490010007', '900001', '10', 'Saúde', '302', 'Assistência hospitalar', 'SÃO PAULO (UF)',
      '2026-02-01', 'FUNDACAO EXEMPLO', NULL, 200000, ${origemDoLote(LOTE_DE_CONVENIOS)})
`;

const TIPO_INDIVIDUAL = 'Emenda Individual - Transferências com Finalidade Definida';
const TIPO_PIX = 'Emenda Individual - Transferências Especiais';

/**
 * A emenda 2026 da Ana tem duas ações, uma em cada modalidade; a de 2024 também é dela (ela já
 * estava no cargo quando as emendas de 2024 foram apresentadas, no fim de 2023; o homônimo que saiu
 * em janeiro de 2023 não estava). A do ex-deputado não identifica ninguém, e a de bancada é
 * coletiva. No segundo lote, a Ana recebe mais um pagamento.
 */
function linhas(lote: string, pagoDaAna: number) {
  const linha = (
    codigo: string,
    ano: number,
    tipo: string,
    autor: [string, string],
    acao: string,
    pago: number,
  ) => sql`(
    ${codigo}, ${ano}, ${tipo}, ${autor[0]}, ${autor[1]}, '0001', 'SÃO PAULO - SP', '3550308',
    '3500000', '10', 'Saúde', '302', 'Assistência hospitalar', '5118', 'ATENÇÃO ESPECIALIZADA',
    ${acao}, 'AÇÃO FICTÍCIA', '0000', 'DIVERSAS', 100000000, 50000000, ${pago}, 0, 0, 0,
    ${lote}, 'portal_transparencia', 'https://portal/emendas', '2026-10-30T09:00:00Z',
    ${lote.replace(/-/g, '').padEnd(64, '0')}, 'bronze/portal/emendas', 'application/zip'
  )`;
  return sql`
    INSERT INTO ingestao.transparencia_emenda VALUES
      ${linha('202690010001', 2026, TIPO_INDIVIDUAL, ['9001', 'ANA EXEMPLO'], '2E90', pagoDaAna)},
      ${linha('202690010001', 2026, TIPO_PIX, ['9001', 'ANA EXEMPLO'], '00SX', 0)},
      ${linha('202490010007', 2024, TIPO_INDIVIDUAL, ['9001', 'ANA EXEMPLO'], '2E90', 0)},
      ${linha('202690020001', 2026, TIPO_INDIVIDUAL, ['9002', 'EX DEPUTADO'], '2E90', 0)},
      ${linha('202571060003', 2025, 'Emenda de Bancada', ['7106', 'BANCADA DA BAHIA'], '2E90', 0)}
    ON CONFLICT (codigo_emenda, localidade, codigo_funcao, codigo_subfuncao, codigo_programa,
      codigo_acao, codigo_plano_orcamentario)
    DO UPDATE SET pago_centavos = EXCLUDED.pago_centavos, lote_id = EXCLUDED.lote_id,
      origem_sha256 = EXCLUDED.origem_sha256
  `;
}

const loteIngerido = (id: string, tabela = 'transparencia_emenda'): EnvelopeDeEvento => ({
  id,
  tipo: 'LoteIngerido',
  versao: 1,
  ocorridoEm: '2026-10-30T09:00:00.000Z',
  idDoAgregado: `portal_transparencia.${tabela}`,
  idDeCorrelacao: `ingestao-${id}`,
  dados: {
    fonte: 'portal_transparencia',
    tabela,
    versaoDoContrato: '1.1.0',
    coletadoDe: '2026-10-30T09:00:00Z',
    coletadoAte: '2026-10-30T09:00:00Z',
    registros: 5,
  },
});

describe('importação das emendas do Portal (prata → Finanças Públicas)', () => {
  let postgres: PostgresDeTeste;
  let bancos: BancoDoContexto[];
  let banco: BancoDoContexto;
  let ingestao: BancoDoContexto;
  const barramento = new BarramentoEmMemoria();
  const resumos: ResumoDaImportacao[] = [];
  let ana = '';

  beforeAll(async () => {
    postgres = await iniciarPostgresDeTeste();
    const conectar = (schema: string) =>
      BancoDoContexto.conectar(schema, postgres.urlDoContexto(schema));
    const acervo = conectar(SCHEMA_DO_ACERVO);
    const agentes = conectar(SCHEMA_DE_AGENTES_PUBLICOS);
    banco = conectar(SCHEMA_DE_FINANCAS_PUBLICAS);
    ingestao = conectar('ingestao');
    bancos = [acervo, agentes, banco, ingestao];
    await migrar(acervo, MIGRACOES_DO_ACERVO);
    await migrar(agentes, MIGRACOES_DE_AGENTES_PUBLICOS);
    await migrar(banco, MIGRACOES_DE_FINANCAS_PUBLICAS);
    await ingestao.drizzle.execute(PRATA);

    const relogio = { agora: () => AGORA };
    const registrarCaptura = montarAcervo(acervo, relogio).registrarCaptura;
    const agentesPublicos = montarAgentesPublicos({ banco: agentes, registrarCaptura, relogio });
    const deputada = async (codigo: string, inicio: string, fim: string) => {
      const sincronizada = await agentesPublicos.sincronizar.execute({
        identificador: { fonte: 'camara', codigo },
        nome: 'Ana Exemplo',
        siglaPartido: 'PEX',
        urlDaFoto: null,
        mandatos: [
          {
            cargo: 'deputado_federal',
            circunscricao: '35',
            inicio: new Date(inicio),
            fim: new Date(fim),
          },
        ],
        origem: {
          fonte: 'camara',
          url: 'https://camara/deputados',
          coletadaEm: AGORA,
          sha256: 'd'.repeat(64),
          caminho: 'bronze/camara/d',
          tipoDeConteudo: 'application/json',
        },
      });
      if (!sincronizada.ok) throw new Error(sincronizada.error.message);
      return sincronizada.value.pessoaId;
    };
    ana = await deputada('900001', '2023-02-01T15:05:00.000Z', '2027-02-01T02:59:59.999Z');
    await deputada('900009', '2019-02-01T13:00:00.000Z', '2023-02-01T02:59:59.999Z');

    const modulo = montarFinancasPublicas({
      banco,
      registrarCaptura,
      pessoas: agentesPublicos.pessoas,
      relogio,
    });
    await modulo.assinarConsumidores(barramento, (resumo) => resumos.push(resumo));
  });

  afterAll(async () => {
    await Promise.all(bancos.map((b) => b.fechar()));
    await postgres.parar();
  });

  it('agrupa as linhas por emenda e liga o autor identificado pelo nome', async () => {
    await ingestao.drizzle.execute(linhas(LOTE_1, 25_000_000));

    await barramento.publicar(loteIngerido(LOTE_1));

    expect(resumos.at(-1)).toMatchObject({ loteId: LOTE_1, lidos: 4, novos: 4, falhas: [] });
    const emendas = await banco.drizzle.select().from(emenda).orderBy(emenda.codigoNaFonte);
    expect(emendas.map((e) => [e.codigoNaFonte, e.tipo, e.autor.pessoaId])).toEqual([
      ['202490010007', 'individual', ana],
      ['202571060003', 'bancada', null],
      ['202690010001', 'individual', ana],
      ['202690020001', 'individual', null],
    ]);
    const daAna = emendas.find((e) => e.codigoNaFonte === '202690010001');
    expect(daAna?.destinacoes.map((d) => [d.acao.codigo, d.modalidade, d.pago])).toEqual([
      ['00SX', 'transferencia_especial', '0'],
      ['2E90', 'finalidade_definida', '25000000'],
    ]);
  });

  it('um pagamento novo no lote seguinte vira ExecucaoDaEmendaAtualizada', async () => {
    await banco.drizzle.execute(sql`TRUNCATE financas_publicas.outbox`);
    await ingestao.drizzle.execute(linhas(LOTE_2, 75_000_000));

    await barramento.publicar(loteIngerido(LOTE_2));

    expect(resumos.at(-1)).toMatchObject({ loteId: LOTE_2, novos: 0 });
    const eventos = await banco.drizzle.select().from(outbox);
    expect(eventos.map((e) => [e.tipo, e.dados['codigoNaFonte']])).toEqual([
      ['ExecucaoDaEmendaAtualizada', '202690010001'],
    ]);
  });

  it('o mesmo lote entregue de novo não produz efeito', async () => {
    const quantos = resumos.length;

    await barramento.publicar(loteIngerido(LOTE_2));

    expect(resumos).toHaveLength(quantos);
  });

  it('agrupa os favorecidos por emenda e recusa só a emenda com tipo fora do contrato', async () => {
    await banco.drizzle.execute(sql`TRUNCATE financas_publicas.outbox`);
    await ingestao.drizzle.execute(FAVORECIDOS);

    await barramento.publicar(loteIngerido(LOTE_DE_FAVORECIDOS, 'transparencia_emenda_favorecido'));

    expect(resumos.at(-1)).toMatchObject({
      loteId: LOTE_DE_FAVORECIDOS,
      importacao: 'favorecidos',
      lidos: 2,
      novos: 1,
      falhas: [{ codigoNaFonte: '202690020001', erro: 'favorecidos.tipo_desconhecido' }],
    });
    const [daAna] = await banco.drizzle.select().from(favorecidosDaEmenda);
    expect(daAna?.codigoDaEmenda).toBe('202690010001');
    expect(
      daAna?.recebimentos.map((r) => [r.mes, r.favorecido.tipo, r.quantidade, r.valor]),
    ).toEqual([
      ['2026-05', 'pessoa_juridica', 1, '50000000'],
      ['2026-05', 'pessoas_fisicas', 3, '180050'],
      ['2026-06', 'pessoa_juridica', 1, '25000000'],
    ]);
    const eventos = await banco.drizzle.select().from(outbox);
    expect(eventos.map((e) => e.tipo)).toEqual(['FavorecidosDaEmendaRegistrados']);
  });

  it('junta as linhas do mesmo convênio e recusa o que se contradiz', async () => {
    await banco.drizzle.execute(sql`TRUNCATE financas_publicas.outbox`);
    await ingestao.drizzle.execute(CONVENIOS);

    await barramento.publicar(loteIngerido(LOTE_DE_CONVENIOS, 'transparencia_emenda_convenio'));

    expect(resumos.at(-1)).toMatchObject({
      loteId: LOTE_DE_CONVENIOS,
      importacao: 'convenios',
      lidos: 2,
      novos: 1,
      falhas: [{ codigoNaFonte: '900001', erro: 'convenio.linhas_inconsistentes' }],
    });
    const convenios = await banco.drizzle.select().from(convenio);
    expect(convenios.map((c) => [c.numero, c.valor, c.publicadoEm])).toEqual([
      ['825378', 145_000_000n, '2026-01-06'],
    ]);
    expect(convenios[0]?.emendas.map((e) => [e.codigoDaEmenda, e.localidade])).toEqual([
      ['202490010007', 'Nacional'],
      ['202690010001', 'SÃO PAULO (UF)'],
    ]);
    const eventos = await banco.drizzle.select().from(outbox);
    expect(eventos.map((e) => e.tipo)).toEqual(['ConvenioRegistrado']);
  });
});
