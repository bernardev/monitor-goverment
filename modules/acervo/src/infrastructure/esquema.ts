import { definirInbox, definirOutbox } from '@prometeu/infraestrutura';
import { char, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const schemaDoAcervo = pgSchema('acervo');

const instante = (nome: string) => timestamp(nome, { withTimezone: true, mode: 'date' });

export const captura = schemaDoAcervo.table('captura', {
  id: uuid('id').primaryKey(),
  sha256: char('sha256', { length: 64 }).notNull().unique(),
  fonte: text('fonte').notNull(),
  url: text('url').notNull(),
  coletadaEm: instante('coletada_em').notNull(),
  caminho: text('caminho').notNull(),
  tipoDeConteudo: text('tipo_de_conteudo').notNull(),
  registradaEm: instante('registrada_em').notNull(),
});

export const outbox = definirOutbox(schemaDoAcervo);
export const inbox = definirInbox(schemaDoAcervo);
