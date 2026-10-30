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
import { emenda, outbox } from './esquema.js';

const AGORA = new Date('2026-10-30T12:00:00.000Z');
const LOTE_1 = '0192d5e0-9999-7000-8000-0000000000e1';
const LOTE_2 = '0192d5e0-9999-7000-8000-0000000000e2';

// Tabela prata como a plataforma de dados a cria (data-platform/migracoes, contrato v1.0.0).
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
`);

const TIPO_INDIVIDUAL = 'Emenda Individual - Transferências com Finalidade Definida';

/**
 * A emenda 2026 da Ana tem duas ações; a de 2024 também é dela (ela já estava no cargo em 2023). A
 * do ex-deputado não identifica ninguém, e a de bancada é coletiva. No segundo lote, a Ana recebe
 * mais um pagamento.
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
      ${linha('202690010001', 2026, TIPO_INDIVIDUAL, ['9001', 'ANA EXEMPLO'], '00SX', 0)},
      ${linha('202490010007', 2024, TIPO_INDIVIDUAL, ['9001', 'ANA EXEMPLO'], '2E90', 0)},
      ${linha('202690020001', 2026, TIPO_INDIVIDUAL, ['9002', 'EX DEPUTADO'], '2E90', 0)},
      ${linha('202571060003', 2025, 'Emenda de Bancada', ['7106', 'BANCADA DA BAHIA'], '2E90', 0)}
    ON CONFLICT (codigo_emenda, localidade, codigo_funcao, codigo_subfuncao, codigo_programa,
      codigo_acao, codigo_plano_orcamentario)
    DO UPDATE SET pago_centavos = EXCLUDED.pago_centavos, lote_id = EXCLUDED.lote_id,
      origem_sha256 = EXCLUDED.origem_sha256
  `;
}

const loteIngerido = (id: string): EnvelopeDeEvento => ({
  id,
  tipo: 'LoteIngerido',
  versao: 1,
  ocorridoEm: '2026-10-30T09:00:00.000Z',
  idDoAgregado: 'portal_transparencia.transparencia_emenda',
  idDeCorrelacao: `ingestao-${id}`,
  dados: {
    fonte: 'portal_transparencia',
    tabela: 'transparencia_emenda',
    versaoDoContrato: '1.0.0',
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
    const sincronizada = await agentesPublicos.sincronizar.execute({
      identificador: { fonte: 'camara', codigo: '900001' },
      nome: 'Ana Exemplo',
      siglaPartido: 'PEX',
      urlDaFoto: null,
      mandatos: [
        {
          cargo: 'deputado_federal',
          circunscricao: '35',
          inicio: new Date('2023-02-01T15:05:00.000Z'),
          fim: new Date('2027-02-01T02:59:59.999Z'),
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
    ana = sincronizada.value.pessoaId;

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
    expect(daAna?.destinacoes.map((d) => [d.acao.codigo, d.pago])).toEqual([
      ['00SX', '0'],
      ['2E90', '25000000'],
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
});
