import { gerarUuidV7 } from './identificador.js';

/**
 * Fato de negócio que já aconteceu. Nome no passado, em português (`EmendaPaga`, `VereditoPublicado`).
 *
 * Os campos espelham o envelope de eventos de integração (ADR-0007), para que publicar um evento de
 * domínio seja apenas acrescentar o `idDeCorrelacao` da requisição.
 */
export interface DomainEvent<TTipo extends string = string, TDados = unknown> {
  readonly id: string;
  readonly tipo: TTipo;
  readonly versao: number;
  readonly ocorridoEm: Date;
  readonly idDoAgregado: string;
  readonly dados: TDados;
}

export interface NovoEvento<TTipo extends string, TDados> {
  readonly tipo: TTipo;
  readonly versao?: number;
  readonly idDoAgregado: string;
  readonly dados: TDados;
  readonly ocorridoEm?: Date;
}

export function criarEvento<TTipo extends string, TDados>(
  novo: NovoEvento<TTipo, TDados>,
): DomainEvent<TTipo, TDados> {
  const ocorridoEm = novo.ocorridoEm ?? new Date();
  return Object.freeze({
    id: gerarUuidV7(ocorridoEm.getTime()),
    tipo: novo.tipo,
    versao: novo.versao ?? 1,
    ocorridoEm,
    idDoAgregado: novo.idDoAgregado,
    dados: novo.dados,
  });
}
