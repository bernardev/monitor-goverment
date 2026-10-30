import { definirInbox, definirOutbox } from '@prometeu/infraestrutura';
import { date, index, integer, jsonb, pgSchema, text, unique, uuid } from 'drizzle-orm/pg-core';

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

export const outbox = definirOutbox(schemaDeAtividadeLegislativa);
export const inbox = definirInbox(schemaDeAtividadeLegislativa);
