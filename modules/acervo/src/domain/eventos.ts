import type { DomainEvent } from '@prometeu/shared-kernel';

// Dados só com primitivos serializáveis: vão para a outbox em JSON e são contrato com outros contextos.

export type CapturaRegistrada = DomainEvent<
  'CapturaRegistrada',
  {
    sha256: string;
    fonte: string;
    url: string;
    coletadaEm: string;
    tipoDeConteudo: string;
  }
>;

export type EventoDoAcervo = CapturaRegistrada;
