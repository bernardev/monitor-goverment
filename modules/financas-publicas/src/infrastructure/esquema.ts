import { definirInbox, definirOutbox } from '@prometeu/infraestrutura';
import { integer, jsonb, pgSchema, text, unique, uuid } from 'drizzle-orm/pg-core';

export const schemaDeFinancasPublicas = pgSchema('financas_publicas');

export interface ClassificacaoGravada {
  codigo: string;
  nome: string;
}

/** Destinação como guardada na emenda: parte do agregado. Centavos em texto (bigint em JSON). */
export interface DestinacaoGravada {
  localidade: string;
  municipioIbge: string | null;
  ufIbge: string | null;
  funcao: ClassificacaoGravada;
  subfuncao: ClassificacaoGravada;
  programa: ClassificacaoGravada;
  acao: ClassificacaoGravada;
  planoOrcamentario: ClassificacaoGravada;
  empenhado: string;
  liquidado: string;
  pago: string;
  restosInscritos: string;
  restosCancelados: string;
  restosPagos: string;
}

export const emenda = schemaDeFinancasPublicas.table(
  'emenda',
  {
    id: uuid('id').primaryKey(),
    codigoNaFonte: text('codigo_na_fonte').notNull(),
    ano: integer('ano').notNull(),
    tipo: text('tipo').notNull(),
    numero: text('numero').notNull(),
    autor: jsonb('autor')
      .$type<{ pessoaId: string | null; nomeNaFonte: string; codigoNaFonte: string }>()
      .notNull(),
    destinacoes: jsonb('destinacoes').$type<DestinacaoGravada[]>().notNull(),
    capturaId: uuid('captura_id').notNull(),
    /** Controle de concorrência otimista: duas gravações sobre a mesma versão não passam as duas. */
    versao: integer('versao').notNull(),
  },
  (t) => [unique('emenda_por_codigo').on(t.codigoNaFonte)],
);

export const outbox = definirOutbox(schemaDeFinancasPublicas);
export const inbox = definirInbox(schemaDeFinancasPublicas);
