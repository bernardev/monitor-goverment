import type { DomainEvent } from '@prometeu/shared-kernel';

import type { CasaLegislativa } from './casa-legislativa.js';
import type { CategoriaDoMotivo } from './motivo-da-ausencia.js';
import type { Situacao } from './situacao.js';
import type { OpcaoDeVoto, ResultadoDaVotacao } from './voto.js';

// Dados só com primitivos serializáveis: vão para a outbox em JSON (ADR-0007) e são a linguagem
// publicada deste contexto para os outros (packages/contracts/eventos). Ausência é `null`.
// Todo evento traz a captura que prova o dado (ADR-0009).

/** Estado completo do registro: quem consome não precisa juntar eventos para saber o dia. */
export interface FrequenciaPublicada {
  casa: CasaLegislativa;
  /** Dia do calendário de Brasília, `aaaa-mm-dd`. */
  dia: string;
  pessoaId: string;
  mandatoId: string;
  situacao: Situacao;
  motivo: { categoria: CategoriaDoMotivo; descricaoNaFonte: string } | null;
  registroNaFonte: string;
  sessoes: { descricao: string; presente: boolean }[];
  capturaId: string;
}

export type PresencaRegistrada = DomainEvent<'PresencaRegistrada', FrequenciaPublicada>;

export type AusenciaRegistrada = DomainEvent<'AusenciaRegistrada', FrequenciaPublicada>;

export type FrequenciaRetificada = DomainEvent<
  'FrequenciaRetificada',
  FrequenciaPublicada & { situacaoAnterior: Situacao }
>;

/** Estado completo da votação nominal, com todos os votos registrados. */
export interface VotacaoNominalPublicada {
  casa: CasaLegislativa;
  /** Como a casa identifica a votação (`2635476-36`). */
  codigoNaFonte: string;
  /** Dia do calendário de Brasília, `aaaa-mm-dd`. */
  dia: string;
  registradaEm: string;
  descricao: string;
  resultado: ResultadoDaVotacao;
  secreta: boolean;
  proposicoes: {
    codigoNaFonte: string;
    sigla: string;
    numero: number;
    ano: number;
    ementa: string | null;
  }[];
  votos: {
    pessoaId: string;
    mandatoId: string;
    opcao: OpcaoDeVoto;
    /** Como a casa escreveu o voto (`Artigo 17`); `null` na votação secreta. */
    registroNaFonte: string | null;
    registradoEm: string;
    /** Partido do parlamentar no dia, como a casa informou. */
    siglaPartidoNaFonte: string | null;
  }[];
  /** Captura do detalhe da votação. */
  capturaId: string;
  /** Captura da lista de votos. */
  capturaDosVotosId: string;
}

export type VotacaoNominalRegistrada = DomainEvent<
  'VotacaoNominalRegistrada',
  VotacaoNominalPublicada
>;

export type VotacaoNominalRetificada = DomainEvent<
  'VotacaoNominalRetificada',
  VotacaoNominalPublicada
>;

export type EventoDeAtividadeLegislativa =
  | PresencaRegistrada
  | AusenciaRegistrada
  | FrequenciaRetificada
  | VotacaoNominalRegistrada
  | VotacaoNominalRetificada;
