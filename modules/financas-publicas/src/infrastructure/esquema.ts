import { definirInbox, definirOutbox } from '@prometeu/infraestrutura';
import { bigint, date, integer, jsonb, pgSchema, text, unique, uuid } from 'drizzle-orm/pg-core';

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
  modalidade: 'finalidade_definida' | 'transferencia_especial' | null;
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

/** Recebimento como guardado na lista de favorecidos: parte do agregado. Valor em centavos, texto. */
export interface RecebimentoGravado {
  mes: string;
  favorecido: {
    tipo: string;
    documento: string | null;
    nome: string | null;
    naturezaJuridica: string | null;
    uf: string | null;
    municipio: string | null;
  };
  quantidade: number;
  valor: string;
}

export const favorecidosDaEmenda = schemaDeFinancasPublicas.table(
  'favorecidos_da_emenda',
  {
    id: uuid('id').primaryKey(),
    /** A emenda pelo código da fonte: a lista pode chegar antes da emenda. */
    codigoDaEmenda: text('codigo_da_emenda').notNull(),
    recebimentos: jsonb('recebimentos').$type<RecebimentoGravado[]>().notNull(),
    capturaId: uuid('captura_id').notNull(),
    versao: integer('versao').notNull(),
  },
  (t) => [unique('favorecidos_por_emenda').on(t.codigoDaEmenda)],
);

export interface EmendaDoConvenioGravada {
  codigoDaEmenda: string;
  funcao: ClassificacaoGravada;
  subfuncao: ClassificacaoGravada;
  localidade: string;
}

export const convenio = schemaDeFinancasPublicas.table(
  'convenio',
  {
    id: uuid('id').primaryKey(),
    numero: text('numero').notNull(),
    convenente: text('convenente').notNull(),
    objeto: text('objeto'),
    publicadoEm: date('publicado_em', { mode: 'string' }).notNull(),
    valor: bigint('valor_centavos', { mode: 'bigint' }).notNull(),
    emendas: jsonb('emendas').$type<EmendaDoConvenioGravada[]>().notNull(),
    capturaId: uuid('captura_id').notNull(),
    versao: integer('versao').notNull(),
  },
  (t) => [unique('convenio_por_numero').on(t.numero)],
);

export const outbox = definirOutbox(schemaDeFinancasPublicas);
export const inbox = definirInbox(schemaDeFinancasPublicas);
