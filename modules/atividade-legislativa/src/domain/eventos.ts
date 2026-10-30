import type { DomainEvent } from '@prometeu/shared-kernel';

import type { CasaLegislativa } from './casa-legislativa.js';
import type { CategoriaDoMotivo } from './motivo-da-ausencia.js';
import type { Situacao } from './situacao.js';

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

export type EventoDeAtividadeLegislativa =
  PresencaRegistrada | AusenciaRegistrada | FrequenciaRetificada;
