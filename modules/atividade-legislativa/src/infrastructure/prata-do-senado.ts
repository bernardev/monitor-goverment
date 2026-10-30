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
  /** Novo no contrato v1.1.0: o id de `senado_processo`. */
  idProcesso: integer('id_processo'),
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

export const senadoProcesso = ingestao.table('senado_processo', {
  idProcesso: integer('id_processo').notNull(),
  sigla: text('sigla').notNull(),
  numero: integer('numero').notNull(),
  ano: integer('ano').notNull(),
  ementa: text('ementa'),
  apresentadaEm: date('apresentada_em', { mode: 'string' }),
  situacao: jsonb('situacao').$type<{ sigla: string; descricao: string; desde: string }>(),
  autores: jsonb('autores')
    .$type<
      {
        nome: string;
        tipo: string;
        codigo_parlamentar: number | null;
        sigla_partido: string | null;
        uf: string | null;
        ordem: number;
      }[]
    >()
    .notNull(),
  situacoes: jsonb('situacoes')
    .$type<
      {
        sigla: string;
        descricao: string;
        inicio: string;
        fim: string | null;
        colegiado: string | null;
      }[]
    >()
    .notNull(),
  normaGerada: text('norma_gerada'),
  urlDocumento: text('url_documento'),
  loteId: uuid('lote_id').notNull(),
  origemFonte: text('origem_fonte').notNull(),
  origemUrl: text('origem_url').notNull(),
  origemColetadaEm: timestamp('origem_coletada_em', { withTimezone: true, mode: 'date' }).notNull(),
  origemSha256: text('origem_sha256').notNull(),
  origemCaminho: text('origem_caminho').notNull(),
  origemTipoDeConteudo: text('origem_tipo_de_conteudo').notNull(),
});
