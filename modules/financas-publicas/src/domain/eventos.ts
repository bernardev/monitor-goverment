import type { DomainEvent } from '@prometeu/shared-kernel';

import type { TipoDeEmenda } from './tipo-de-emenda.js';

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

export type EventoDeFinancasPublicas =
  EmendaRegistrada | ExecucaoDaEmendaAtualizada | EmendaRetificada;
