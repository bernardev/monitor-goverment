import { definirInbox, definirOutbox } from '@prometeu/infraestrutura';
import { integer, jsonb, pgSchema, text, unique, uuid } from 'drizzle-orm/pg-core';

export const schemaDeObras = pgSchema('obras');

/** Apuração como guardada na obra: parte do agregado. Centavos em texto (bigint em JSON). */
export interface ApuracaoGravada {
  nome: string;
  descricao: string | null;
  natureza: string | null;
  especie: string | null;
  situacao: string;
  situacaoNaFonte: string;
  uf: string | null;
  municipios: { codigoIbge: string; nome: string | null }[];
  pontos: { latitude: string; longitude: string }[];
  endereco: string | null;
  inicioPrevisto: string | null;
  fimPrevisto: string | null;
  inicioEfetivo: string | null;
  fimEfetivo: string | null;
  investimentoPrevisto: string;
  executores: { nome: string | null; cnpj: string | null }[];
  medicao: { percentualCentesimos: number; em: string | null } | null;
  interrupcoes: { tipo: string; em: string; justificativa: string | null }[];
  emendas: {
    codigoDaEmenda: string;
    ugEmitente: string;
    numeroDoEmpenho: string;
    acaoOrcamentaria: string | null;
    empenhado: string;
    emitidoEm: string | null;
  }[];
}

export const obra = schemaDeObras.table(
  'obra',
  {
    id: uuid('id').primaryKey(),
    /** Projeto de investimento no Obrasgov.br. */
    idNaFonte: text('id_na_fonte').notNull(),
    apuracao: jsonb('apuracao').$type<ApuracaoGravada>().notNull(),
    capturaId: uuid('captura_id').notNull(),
    /** Controle de concorrência otimista: duas gravações sobre a mesma versão não passam as duas. */
    versao: integer('versao').notNull(),
  },
  (t) => [unique('obra_por_id_na_fonte').on(t.idNaFonte)],
);

export const outbox = definirOutbox(schemaDeObras);
export const inbox = definirInbox(schemaDeObras);
