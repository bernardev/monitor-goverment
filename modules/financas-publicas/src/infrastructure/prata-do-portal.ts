import { bigint, char, integer, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Leitura da prata do Portal da Transparência (packages/contracts/prata/portal_transparencia, v1). O
// schema `ingestao` é da plataforma de dados; este contexto só lê. Fora do drizzle.config.ts.

const ingestao = pgSchema('ingestao');
const centavos = (nome: string) => bigint(nome, { mode: 'bigint' }).notNull();

export const transparenciaEmenda = ingestao.table('transparencia_emenda', {
  codigoEmenda: text('codigo_emenda').notNull(),
  ano: integer('ano').notNull(),
  tipo: text('tipo').notNull(),
  codigoAutor: text('codigo_autor').notNull(),
  nomeAutor: text('nome_autor').notNull(),
  numeroEmenda: text('numero_emenda').notNull(),
  localidade: text('localidade').notNull(),
  codigoMunicipioIbge: char('codigo_municipio_ibge', { length: 7 }),
  codigoUfIbge: char('codigo_uf_ibge', { length: 7 }),
  codigoFuncao: text('codigo_funcao').notNull(),
  nomeFuncao: text('nome_funcao').notNull(),
  codigoSubfuncao: text('codigo_subfuncao').notNull(),
  nomeSubfuncao: text('nome_subfuncao').notNull(),
  codigoPrograma: text('codigo_programa').notNull(),
  nomePrograma: text('nome_programa').notNull(),
  codigoAcao: text('codigo_acao').notNull(),
  nomeAcao: text('nome_acao').notNull(),
  codigoPlanoOrcamentario: text('codigo_plano_orcamentario').notNull(),
  nomePlanoOrcamentario: text('nome_plano_orcamentario').notNull(),
  empenhadoCentavos: centavos('empenhado_centavos'),
  liquidadoCentavos: centavos('liquidado_centavos'),
  pagoCentavos: centavos('pago_centavos'),
  restosInscritosCentavos: centavos('restos_inscritos_centavos'),
  restosCanceladosCentavos: centavos('restos_cancelados_centavos'),
  restosPagosCentavos: centavos('restos_pagos_centavos'),
  loteId: uuid('lote_id').notNull(),
  origemFonte: text('origem_fonte').notNull(),
  origemUrl: text('origem_url').notNull(),
  origemColetadaEm: timestamp('origem_coletada_em', { withTimezone: true, mode: 'date' }).notNull(),
  origemSha256: text('origem_sha256').notNull(),
  origemCaminho: text('origem_caminho').notNull(),
  origemTipoDeConteudo: text('origem_tipo_de_conteudo').notNull(),
});
