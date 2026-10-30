import { definirInbox, definirOutbox } from '@prometeu/infraestrutura';
import { index, integer, pgSchema, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const schemaDeAgentesPublicos = pgSchema('agentes_publicos');

const instante = (nome: string) => timestamp(nome, { withTimezone: true, mode: 'date' });

export const pessoa = schemaDeAgentesPublicos.table('pessoa', {
  id: uuid('id').primaryKey(),
  nome: text('nome').notNull(),
  siglaPartido: text('sigla_partido'),
  urlDaFoto: text('url_da_foto'),
  /** Controle de concorrência otimista: duas gravações sobre a mesma versão não passam as duas. */
  versao: integer('versao').notNull(),
});

export const identificadorExterno = schemaDeAgentesPublicos.table(
  'identificador_externo',
  {
    fonte: text('fonte').notNull(),
    codigo: text('codigo').notNull(),
    pessoaId: uuid('pessoa_id')
      .notNull()
      .references(() => pessoa.id),
  },
  (t) => [
    primaryKey({ columns: [t.fonte, t.codigo] }),
    index('identificador_por_pessoa').on(t.pessoaId),
  ],
);

export const mandato = schemaDeAgentesPublicos.table(
  'mandato',
  {
    id: uuid('id').primaryKey(),
    pessoaId: uuid('pessoa_id')
      .notNull()
      .references(() => pessoa.id),
    cargo: text('cargo').notNull(),
    circunscricao: text('circunscricao').notNull(),
    inicio: instante('inicio').notNull(),
    fim: instante('fim'),
    capturaId: uuid('captura_id').notNull(),
  },
  (t) => [index('mandato_por_pessoa').on(t.pessoaId)],
);

export const outbox = definirOutbox(schemaDeAgentesPublicos);
export const inbox = definirInbox(schemaDeAgentesPublicos);
