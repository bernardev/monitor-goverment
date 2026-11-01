import { index, pgSchema, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const schemaDeEngajamento = pgSchema('engajamento');

/**
 * Um político ou uma cidade que a pessoa acompanha. A chave impede repetir; o índice por alvo serve
 * aos alertas (etapa 6.3): quem acompanha o político que acabou de votar.
 */
export const acompanhamento = schemaDeEngajamento.table(
  'acompanhamento',
  {
    cidadaoId: uuid('cidadao_id').notNull(),
    tipo: text('tipo').notNull(),
    alvoId: text('alvo_id').notNull(),
    desde: timestamp('desde', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.cidadaoId, t.tipo, t.alvoId] }),
    index('acompanhamento_por_alvo').on(t.tipo, t.alvoId),
  ],
);
