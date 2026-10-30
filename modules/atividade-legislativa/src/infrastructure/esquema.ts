import { definirInbox, definirOutbox } from '@prometeu/infraestrutura';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const schemaDeAtividadeLegislativa = pgSchema('atividade_legislativa');

export const registroDeFrequencia = schemaDeAtividadeLegislativa.table(
  'registro_de_frequencia',
  {
    id: uuid('id').primaryKey(),
    casa: text('casa').notNull(),
    dia: date('dia', { mode: 'string' }).notNull(),
    pessoaId: uuid('pessoa_id').notNull(),
    mandatoId: uuid('mandato_id').notNull(),
    situacao: text('situacao').notNull(),
    motivoCategoria: text('motivo_categoria'),
    motivoDescricao: text('motivo_descricao'),
    registroNaFonte: text('registro_na_fonte').notNull(),
    sessoes: jsonb('sessoes').$type<{ descricao: string; presente: boolean }[]>().notNull(),
    capturaId: uuid('captura_id').notNull(),
    /** Controle de concorrência otimista: duas gravações sobre a mesma versão não passam as duas. */
    versao: integer('versao').notNull(),
  },
  (t) => [
    unique('frequencia_por_dia').on(t.casa, t.pessoaId, t.dia),
    index('frequencia_por_mandato').on(t.mandatoId, t.dia),
  ],
);

/** Voto como guardado na votação: parte do agregado, sem vida própria. */
export interface VotoGravado {
  pessoaId: string;
  mandatoId: string;
  opcao: string;
  registroNaFonte: string | null;
  registradoEm: string | null;
  siglaPartidoNaFonte: string | null;
}

/** Parlamentar em exercício que não votou, com a situação informada pela casa. */
export interface SemVotoGravado {
  pessoaId: string;
  mandatoId: string;
  situacao: string;
  motivoCategoria: string | null;
  motivoDescricao: string | null;
  registroNaFonte: string;
  siglaPartidoNaFonte: string | null;
}

export interface ProposicaoGravada {
  codigoNaFonte: string;
  sigla: string;
  numero: number;
  ano: number;
  ementa: string | null;
}

export const votacaoNominal = schemaDeAtividadeLegislativa.table(
  'votacao_nominal',
  {
    id: uuid('id').primaryKey(),
    casa: text('casa').notNull(),
    codigoNaFonte: text('codigo_na_fonte').notNull(),
    dia: date('dia', { mode: 'string' }).notNull(),
    registradaEm: timestamp('registrada_em', { withTimezone: true, mode: 'date' }),
    descricao: text('descricao').notNull(),
    resultado: text('resultado').notNull(),
    proposicoes: jsonb('proposicoes').$type<ProposicaoGravada[]>().notNull(),
    votos: jsonb('votos').$type<VotoGravado[]>().notNull(),
    relacaoCompleta: boolean('relacao_completa').notNull().default(false),
    semVoto: jsonb('sem_voto').$type<SemVotoGravado[]>().notNull().default([]),
    capturaId: uuid('captura_id').notNull(),
    capturaDosVotosId: uuid('captura_dos_votos_id').notNull(),
    /** Controle de concorrência otimista: duas gravações sobre a mesma versão não passam as duas. */
    versao: integer('versao').notNull(),
  },
  (t) => [unique('votacao_por_codigo').on(t.casa, t.codigoNaFonte)],
);

export const outbox = definirOutbox(schemaDeAtividadeLegislativa);
export const inbox = definirInbox(schemaDeAtividadeLegislativa);
