import { definirInbox, definirOutbox } from '@prometeu/infraestrutura';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import type { Localizacao } from '../domain/trecho.js';

export const schemaDeCompromissos = pgSchema('compromissos');

const instante = (nome: string) => timestamp(nome, { withTimezone: true, mode: 'date' });

/** Fundamento de não cumprimento como fica gravado (datas em ISO 8601). */
export type FundamentoGravado =
  | { tipo: 'mandato_encerrado'; encerradoEm: string }
  | { tipo: 'ato_em_sentido_contrario'; evidencia: string };

export const promessa = schemaDeCompromissos.table(
  'promessa',
  {
    id: uuid('id').primaryKey(),
    pessoaId: uuid('pessoa_id').notNull(),
    candidaturaId: uuid('candidatura_id'),
    mandatoId: uuid('mandato_id'),
    texto: text('texto').notNull(),
    tema: text('tema').notNull(),
    mensurabilidade: text('mensurabilidade').notNull(),
    competencia: text('competencia').notNull(),
    metaDescricao: text('meta_descricao'),
    metaPrazo: instante('meta_prazo'),
    estagio: text('estagio').notNull(),
    /** Controle de concorrência otimista: duas gravações sobre a mesma versão não passam as duas. */
    versao: integer('versao').notNull(),
  },
  (t) => [index('promessa_por_pessoa').on(t.pessoaId)],
);

export const fonte = schemaDeCompromissos.table(
  'fonte',
  {
    id: uuid('id').primaryKey(),
    promessaId: uuid('promessa_id')
      .notNull()
      .references(() => promessa.id),
    tipo: text('tipo').notNull(),
    capturaId: uuid('captura_id').notNull(),
    citacaoLiteral: text('citacao_literal').notNull(),
    localizacao: jsonb('localizacao').$type<Localizacao>().notNull(),
    dataDaDeclaracao: instante('data_da_declaracao').notNull(),
  },
  (t) => [index('fonte_por_promessa').on(t.promessaId)],
);

export const vinculo = schemaDeCompromissos.table(
  'vinculo',
  {
    id: uuid('id').primaryKey(),
    promessaId: uuid('promessa_id')
      .notNull()
      .references(() => promessa.id),
    tipoDoAlvo: text('tipo_do_alvo').notNull(),
    idDoAlvo: uuid('id_do_alvo').notNull(),
    estagioQueComprova: text('estagio_que_comprova').notNull(),
    origem: text('origem').notNull(),
    evidencias: uuid('evidencias').array().notNull(),
    situacao: text('situacao').notNull(),
    sugeridoEm: instante('sugerido_em').notNull(),
    decididoPor: uuid('decidido_por'),
    decididoEm: instante('decidido_em'),
    motivo: text('motivo'),
  },
  (t) => [index('vinculo_por_promessa').on(t.promessaId)],
);

// Função, e não objeto: cada tabela precisa das próprias instâncias de coluna.
const colunasDoVeredito = () => ({
  veredito: text('veredito').notNull(),
  justificativa: text('justificativa').notNull(),
  evidencias: uuid('evidencias').array().notNull(),
  fundamento: jsonb('fundamento').$type<FundamentoGravado>(),
  errata: boolean('errata').notNull(),
  propostoPor: uuid('proposto_por').notNull(),
  propostoEm: instante('proposto_em').notNull(),
});

/** Histórico append-only (invariante 5): um gatilho no banco impede alterar ou apagar registros. */
export const registroDeVeredito = schemaDeCompromissos.table(
  'registro_de_veredito',
  {
    id: uuid('id').primaryKey(),
    promessaId: uuid('promessa_id')
      .notNull()
      .references(() => promessa.id),
    ...colunasDoVeredito(),
    revisadoPor: uuid('revisado_por').notNull(),
    publicadoEm: instante('publicado_em').notNull(),
    corrige: uuid('corrige'),
  },
  (t) => [index('registro_por_promessa').on(t.promessaId)],
);

/** No máximo uma proposta pendente por promessa. */
export const propostaDeVeredito = schemaDeCompromissos.table('proposta_de_veredito', {
  promessaId: uuid('promessa_id')
    .primaryKey()
    .references(() => promessa.id),
  ...colunasDoVeredito(),
});

export const outbox = definirOutbox(schemaDeCompromissos);
export const inbox = definirInbox(schemaDeCompromissos);
