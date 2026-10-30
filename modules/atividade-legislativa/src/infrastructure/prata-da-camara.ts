import { date, integer, jsonb, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Leitura das tabelas prata da Câmara (packages/contracts/prata/camara, v1). O schema `ingestao` é da
// plataforma de dados; este contexto só lê, com a permissão dada em infra/docker/postgres.
// Fica fora do drizzle.config.ts de propósito: estas tabelas não têm migração aqui.

const ingestao = pgSchema('ingestao');

export const camaraMatricula = ingestao.table('camara_matricula', {
  matricula: integer('matricula').notNull(),
  idDeputado: integer('id_deputado').notNull(),
});

export const camaraFrequenciaDia = ingestao.table('camara_frequencia_dia', {
  matricula: integer('matricula').notNull(),
  dia: date('dia', { mode: 'string' }).notNull(),
  frequencia: text('frequencia').notNull(),
  justificativa: text('justificativa'),
  sessoes: jsonb('sessoes').$type<{ descricao: string; frequencia: string }[]>().notNull(),
  loteId: uuid('lote_id').notNull(),
  origemFonte: text('origem_fonte').notNull(),
  origemUrl: text('origem_url').notNull(),
  origemColetadaEm: timestamp('origem_coletada_em', { withTimezone: true, mode: 'date' }).notNull(),
  origemSha256: text('origem_sha256').notNull(),
  origemCaminho: text('origem_caminho').notNull(),
  origemTipoDeConteudo: text('origem_tipo_de_conteudo').notNull(),
});
