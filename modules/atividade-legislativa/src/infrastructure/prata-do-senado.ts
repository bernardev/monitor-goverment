import {
  boolean,
  date,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// Leitura da prata do Senado (packages/contracts/prata/senado, v1). O schema `ingestao` é da
// plataforma de dados; este contexto só lê. Fica fora do drizzle.config.ts de propósito.

const ingestao = pgSchema('ingestao');

export interface SenadorNaVotacao {
  codigo_parlamentar: number;
  sigla_voto: string;
  descricao_voto: string | null;
  sigla_partido: string | null;
  sigla_uf: string | null;
}

export const senadoVotacao = ingestao.table('senado_votacao', {
  codigoSessaoVotacao: integer('codigo_sessao_votacao').notNull(),
  data: date('data', { mode: 'string' }).notNull(),
  descricao: text('descricao').notNull(),
  identificacao: text('identificacao'),
  codigoMateria: integer('codigo_materia'),
  siglaMateria: text('sigla_materia'),
  numeroMateria: text('numero_materia'),
  anoMateria: integer('ano_materia'),
  ementa: text('ementa'),
  aprovada: boolean('aprovada'),
  secreta: boolean('secreta').notNull(),
  votos: jsonb('votos').$type<SenadorNaVotacao[]>().notNull(),
  loteId: uuid('lote_id').notNull(),
  origemFonte: text('origem_fonte').notNull(),
  origemUrl: text('origem_url').notNull(),
  origemColetadaEm: timestamp('origem_coletada_em', { withTimezone: true, mode: 'date' }).notNull(),
  origemSha256: text('origem_sha256').notNull(),
  origemCaminho: text('origem_caminho').notNull(),
  origemTipoDeConteudo: text('origem_tipo_de_conteudo').notNull(),
});
