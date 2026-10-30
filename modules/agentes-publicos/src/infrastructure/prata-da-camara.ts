import { date, integer, jsonb, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Leitura das tabelas prata da Câmara (packages/contracts/prata/camara, v2). O schema `ingestao` é da
// plataforma de dados; este contexto só lê, com a permissão dada em infra/docker/postgres.
// Fica fora do drizzle.config.ts de propósito: estas tabelas não têm migração aqui.

const ingestao = pgSchema('ingestao');

export const camaraDeputado = ingestao.table('camara_deputado', {
  idDeputado: integer('id_deputado').notNull(),
  idLegislatura: integer('id_legislatura').notNull(),
  nome: text('nome').notNull(),
  siglaPartido: text('sigla_partido').notNull(),
  siglaUf: text('sigla_uf').notNull(),
  urlFoto: text('url_foto'),
  /** Instantes ISO 8601 com fuso; `fim` nulo no exercício em curso. */
  exercicios: jsonb('exercicios').$type<{ inicio: string; fim: string | null }[]>().notNull(),
  loteId: uuid('lote_id').notNull(),
  origemFonte: text('origem_fonte').notNull(),
  origemUrl: text('origem_url').notNull(),
  origemColetadaEm: timestamp('origem_coletada_em', { withTimezone: true, mode: 'date' }).notNull(),
  origemSha256: text('origem_sha256').notNull(),
  origemCaminho: text('origem_caminho').notNull(),
  origemTipoDeConteudo: text('origem_tipo_de_conteudo').notNull(),
});

export const camaraLegislatura = ingestao.table('camara_legislatura', {
  idLegislatura: integer('id_legislatura').notNull(),
  dataInicio: date('data_inicio', { mode: 'string' }).notNull(),
  dataFim: date('data_fim', { mode: 'string' }).notNull(),
});
