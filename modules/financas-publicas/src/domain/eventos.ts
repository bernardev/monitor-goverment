import type { DomainEvent } from '@prometeu/shared-kernel';

import type { TipoDeFavorecido } from './tipo-de-favorecido.js';
import type { Modalidade, TipoDeEmenda } from './tipo-de-emenda.js';

// Dados só com primitivos serializáveis: vão para a outbox em JSON (ADR-0007) e são a linguagem
// publicada deste contexto para os outros (packages/contracts/eventos). Ausência é `null`.
// Valores em centavos vão como texto (`"150000000"`): JSON não tem inteiro de 64 bits.

export interface ClassificacaoPublicada {
  codigo: string;
  nome: string;
}

/** Estado completo da emenda: quem consome não precisa juntar eventos. */
export interface EmendaPublicada {
  /** Código da emenda no Portal da Transparência (`202638970001`). */
  codigoNaFonte: string;
  /** Ano do orçamento. */
  ano: number;
  tipo: TipoDeEmenda;
  numero: string;
  autor: {
    /** `null`: autor coletivo (bancada, comissão, relator) ou parlamentar não identificado. */
    pessoaId: string | null;
    nomeNaFonte: string;
    codigoNaFonte: string;
  };
  destinacoes: {
    localidade: string;
    municipioIbge: string | null;
    ufIbge: string | null;
    funcao: ClassificacaoPublicada;
    subfuncao: ClassificacaoPublicada;
    programa: ClassificacaoPublicada;
    acao: ClassificacaoPublicada;
    planoOrcamentario: ClassificacaoPublicada;
    /** `null` em emenda coletiva. */
    modalidade: Modalidade | null;
    empenhadoCentavos: string;
    liquidadoCentavos: string;
    pagoCentavos: string;
    restosInscritosCentavos: string;
    restosCanceladosCentavos: string;
    restosPagosCentavos: string;
  }[];
  capturaId: string;
}

export type EmendaRegistrada = DomainEvent<'EmendaRegistrada', EmendaPublicada>;

/** Os valores de empenho, liquidação ou pagamento mudaram. */
export type ExecucaoDaEmendaAtualizada = DomainEvent<'ExecucaoDaEmendaAtualizada', EmendaPublicada>;

/** A fonte corrigiu outro dado da emenda (autor, destino, classificação). */
export type EmendaRetificada = DomainEvent<'EmendaRetificada', EmendaPublicada>;

/** Para quem foi o dinheiro de uma emenda, mês a mês: estado completo da lista. */
export interface FavorecidosPublicados {
  /** Código da emenda no Portal da Transparência; a emenda pode ainda não ter sido importada. */
  codigoDaEmenda: string;
  recebimentos: {
    /** `aaaa-mm`. */
    mes: string;
    favorecido: {
      tipo: TipoDeFavorecido;
      /** CNPJ ou código da unidade gestora; `null` no somado (pessoas físicas, sem documento). */
      documento: string | null;
      nome: string | null;
      naturezaJuridica: string | null;
      /** Sigla da UF. */
      uf: string | null;
      /** Como a fonte escreve o município, sem código IBGE. */
      municipio: string | null;
    };
    /** Quantos favorecidos a fonte somou: 1 no identificado. */
    quantidade: number;
    /** Recebido no mês; negativo é estorno. */
    valorCentavos: string;
  }[];
  capturaId: string;
}

export type FavorecidosDaEmendaRegistrados = DomainEvent<
  'FavorecidosDaEmendaRegistrados',
  FavorecidosPublicados
>;

/** A fonte trouxe mês novo, corrigiu um valor ou tirou um favorecido. */
export type FavorecidosDaEmendaAtualizados = DomainEvent<
  'FavorecidosDaEmendaAtualizados',
  FavorecidosPublicados
>;

/** Estado completo do convênio e das emendas que o pagam. */
export interface ConvenioPublicado {
  /** Número do convênio na fonte (`825378`). */
  numero: string;
  convenente: string;
  objeto: string | null;
  /** `aaaa-mm-dd`. */
  publicadoEm: string;
  /** O valor do convênio inteiro. */
  valorCentavos: string;
  emendas: {
    codigoDaEmenda: string;
    funcao: ClassificacaoPublicada;
    subfuncao: ClassificacaoPublicada;
    localidade: string;
  }[];
  capturaId: string;
}

export type ConvenioRegistrado = DomainEvent<'ConvenioRegistrado', ConvenioPublicado>;

/** A fonte mudou o convênio: valor, objeto, convenente ou as emendas que o pagam. */
export type ConvenioAtualizado = DomainEvent<'ConvenioAtualizado', ConvenioPublicado>;

export type EventoDeFinancasPublicas =
  | EmendaRegistrada
  | ExecucaoDaEmendaAtualizada
  | EmendaRetificada
  | FavorecidosDaEmendaRegistrados
  | FavorecidosDaEmendaAtualizados
  | ConvenioRegistrado
  | ConvenioAtualizado;
