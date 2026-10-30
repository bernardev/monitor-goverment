import type { DomainEvent } from '@prometeu/shared-kernel';

import type { CasaLegislativa } from './casa-legislativa.js';
import type { CategoriaDoMotivo } from './motivo-da-ausencia.js';
import type { TipoDeProposicao } from './tipo-de-proposicao.js';
import type { Situacao } from './situacao.js';
import type { OpcaoDeVoto, ResultadoDaVotacao, SituacaoSemVoto } from './voto.js';

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

/**
 * Estado completo da votação nominal (contrato v2): todos os votos e, quando a casa lista todos os
 * parlamentares em exercício, quem não votou e por quê.
 */
export interface VotacaoNominalPublicada {
  casa: CasaLegislativa;
  /** Como a casa identifica a votação (`2635476-36`). */
  codigoNaFonte: string;
  /** Dia do calendário de Brasília, `aaaa-mm-dd`. */
  dia: string;
  /** `null`: a casa não informa o horário (Senado). */
  registradaEm: string | null;
  descricao: string;
  resultado: ResultadoDaVotacao;
  secreta: boolean;
  /** A casa listou todos os parlamentares em exercício, inclusive quem não votou. */
  relacaoCompleta: boolean;
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
    /** `null`: a casa não informa o horário do voto. */
    registradoEm: string | null;
    /** Partido do parlamentar no dia, como a casa informou. */
    siglaPartidoNaFonte: string | null;
  }[];
  /** Vazio quando a casa não lista quem não votou (`relacaoCompleta` falso). */
  semVoto: {
    pessoaId: string;
    mandatoId: string;
    situacao: SituacaoSemVoto;
    motivo: { categoria: CategoriaDoMotivo; descricaoNaFonte: string } | null;
    registroNaFonte: string;
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

/** Estado completo da proposição, com toda a tramitação conhecida. */
export interface ProposicaoPublicada {
  casa: CasaLegislativa;
  /** Como a casa identifica a proposição (id da Câmara, id do processo no Senado). */
  codigoNaFonte: string;
  sigla: TipoDeProposicao;
  numero: number;
  ano: number;
  ementa: string | null;
  apresentadaEm: string | null;
  autores: {
    /** `null`: autor que não é parlamentar conhecido (Poder Executivo, comissão, ex-parlamentar). */
    pessoaId: string | null;
    nomeNaFonte: string;
    tipoNaFonte: string;
    proponente: boolean;
  }[];
  situacao: { descricao: string; desde: string; orgao: string | null } | null;
  /** Em ordem cronológica. */
  tramitacoes: {
    em: string;
    orgao: string | null;
    descricao: string;
    situacao: string | null;
    despacho: string | null;
  }[];
  normaGerada: string | null;
  urlDoTexto: string | null;
  capturaId: string;
}

export type ProposicaoRegistrada = DomainEvent<'ProposicaoRegistrada', ProposicaoPublicada>;

export type TramitacaoAvancou = DomainEvent<
  'TramitacaoAvancou',
  ProposicaoPublicada & { novasTramitacoes: number }
>;

export type ProposicaoRetificada = DomainEvent<'ProposicaoRetificada', ProposicaoPublicada>;

export type EventoDeAtividadeLegislativa =
  | PresencaRegistrada
  | AusenciaRegistrada
  | FrequenciaRetificada
  | VotacaoNominalRegistrada
  | VotacaoNominalRetificada
  | ProposicaoRegistrada
  | TramitacaoAvancou
  | ProposicaoRetificada;
