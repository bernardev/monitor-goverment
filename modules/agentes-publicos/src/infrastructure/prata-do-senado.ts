import { integer, jsonb, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Leitura das tabelas prata do Senado (packages/contracts/prata/senado, v1). O schema `ingestao` é da
// plataforma de dados; este contexto só lê. Fica fora do drizzle.config.ts de propósito.

const ingestao = pgSchema('ingestao');

export const senadoSenador = ingestao.table('senado_senador', {
  codigo: integer('codigo').notNull(),
  nome: text('nome').notNull(),
  siglaPartido: text('sigla_partido'),
  urlFoto: text('url_foto'),
  loteId: uuid('lote_id').notNull(),
  origemFonte: text('origem_fonte').notNull(),
  origemUrl: text('origem_url').notNull(),
  origemColetadaEm: timestamp('origem_coletada_em', { withTimezone: true, mode: 'date' }).notNull(),
  origemSha256: text('origem_sha256').notNull(),
  origemCaminho: text('origem_caminho').notNull(),
  origemTipoDeConteudo: text('origem_tipo_de_conteudo').notNull(),
});

/** Datas `aaaa-mm-dd` do calendário de Brasília; `fim` nulo no exercício em curso. */
export interface ExercicioNoSenado {
  codigo_exercicio: number;
  uf: string;
  inicio: string;
  fim: string | null;
  fim_do_mandato: string;
  causa_do_afastamento: string | null;
}

export const senadoExercicios = ingestao.table('senado_exercicios', {
  codigo: integer('codigo').notNull(),
  exercicios: jsonb('exercicios').$type<ExercicioNoSenado[]>().notNull(),
});
