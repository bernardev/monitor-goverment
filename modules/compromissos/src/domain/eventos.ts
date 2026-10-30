import type { DomainEvent } from '@prometeu/shared-kernel';

import type { Competencia, Mensurabilidade, TipoDeFonte } from './classificacao.js';
import type { EstagioComprovavel, EstagioNaCadeia } from './estagio.js';
import type { TipoDeAlvo } from './referencia-externa.js';
import type { Veredito } from './veredito.js';
import type { OrigemDoVinculo } from './vinculo.js';

// Os dados dos eventos são só primitivos serializáveis: eles vão para a outbox em JSON (ADR-0007) e
// viram contrato com os outros contextos. Ausência é `null`, não campo omitido.

export type PromessaRegistrada = DomainEvent<
  'PromessaRegistrada',
  {
    pessoaId: string;
    candidaturaId: string | null;
    mandatoId: string | null;
    texto: string;
    tema: string;
    mensurabilidade: Mensurabilidade;
    competencia: Competencia;
    fonteId: string;
    capturaId: string;
    registradoPor: string;
  }
>;

export type FonteAdicionada = DomainEvent<
  'FonteAdicionada',
  { fonteId: string; tipo: TipoDeFonte; capturaId: string; adicionadaPor: string }
>;

export type VinculoSugerido = DomainEvent<
  'VinculoSugerido',
  {
    vinculoId: string;
    tipoDoAlvo: TipoDeAlvo;
    idDoAlvo: string;
    estagioQueComprova: EstagioComprovavel;
    origem: OrigemDoVinculo;
    evidencias: string[];
  }
>;

export type VinculoConfirmado = DomainEvent<
  'VinculoConfirmado',
  { vinculoId: string; confirmadoPor: string }
>;

export type VinculoRejeitado = DomainEvent<
  'VinculoRejeitado',
  { vinculoId: string; estavaConfirmado: boolean; rejeitadoPor: string; motivo: string }
>;

export type EstagioDaPromessaAvancou = DomainEvent<
  'EstagioDaPromessaAvancou',
  { de: EstagioNaCadeia; para: EstagioNaCadeia }
>;

export type EstagioDaPromessaRecuou = DomainEvent<
  'EstagioDaPromessaRecuou',
  { de: EstagioNaCadeia; para: EstagioNaCadeia }
>;

export type VereditoProposto = DomainEvent<
  'VereditoProposto',
  {
    veredito: Veredito;
    vigente: Veredito;
    errata: boolean;
    exigeRevisao: boolean;
    propostoPor: string;
  }
>;

export type VereditoRecusado = DomainEvent<
  'VereditoRecusado',
  { veredito: Veredito; propostoPor: string; recusadoPor: string; motivo: string }
>;

export type VereditoPublicado = DomainEvent<
  'VereditoPublicado',
  {
    registroId: string;
    veredito: Veredito;
    anterior: Veredito;
    justificativa: string;
    evidencias: string[];
    fundamento: 'mandato_encerrado' | 'ato_em_sentido_contrario' | null;
    propostoPor: string;
    revisadoPor: string;
    corrige: string | null;
  }
>;

export type EventoDeCompromissos =
  | PromessaRegistrada
  | FonteAdicionada
  | VinculoSugerido
  | VinculoConfirmado
  | VinculoRejeitado
  | EstagioDaPromessaAvancou
  | EstagioDaPromessaRecuou
  | VereditoProposto
  | VereditoRecusado
  | VereditoPublicado;
