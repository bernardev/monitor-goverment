import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uuid,
  type PgSchema,
} from 'drizzle-orm/pg-core';

// As fábricas abaixo devolvem tabelas Drizzle cujo tipo é inferido das colunas; escrevê-lo à mão
// duplicaria cada coluna. Por isso a regra de tipo de retorno explícito fica desligada nelas.

const instante = (nome: string) => timestamp(nome, { withTimezone: true, mode: 'date' });

/**
 * Outbox do contexto (ADR-0015). Mesmo formato em todos os schemas, inclusive `ingestao`, que é
 * gravada pela plataforma de dados em Python.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function definirOutbox(schema: PgSchema) {
  return schema.table(
    'outbox',
    {
      id: uuid('id').primaryKey(),
      tipo: text('tipo').notNull(),
      versao: integer('versao').notNull(),
      ocorridoEm: instante('ocorrido_em').notNull(),
      idDoAgregado: text('id_do_agregado').notNull(),
      idDeCorrelacao: text('id_de_correlacao').notNull(),
      dados: jsonb('dados').$type<Record<string, unknown>>().notNull(),
      publicadoEm: instante('publicado_em'),
    },
    (t) => [
      index('outbox_pendentes')
        .on(t.ocorridoEm)
        .where(sql`${t.publicadoEm} IS NULL`),
    ],
  );
}

/** Eventos já processados por cada consumidor do contexto: garante efeito único (ADR-0015). */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function definirInbox(schema: PgSchema) {
  return schema.table(
    'inbox',
    {
      idDoEvento: uuid('id_do_evento').notNull(),
      consumidor: text('consumidor').notNull(),
      processadoEm: instante('processado_em').notNull().defaultNow(),
    },
    (t) => [primaryKey({ columns: [t.idDoEvento, t.consumidor] })],
  );
}

export type TabelaOutbox = ReturnType<typeof definirOutbox>;
export type TabelaInbox = ReturnType<typeof definirInbox>;

/** Outbox do schema `ingestao`, gravada pela plataforma de dados e esvaziada pelo worker (ADR-0015). */
export const outboxDaIngestao = definirOutbox(pgSchema('ingestao'));
