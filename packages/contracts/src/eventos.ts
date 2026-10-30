/**
 * Tipos TypeScript espelhando os JSON Schemas em `eventos/`. O schema é a fonte da verdade
 * (compartilhado com o Python); estes tipos existem para o compilador.
 */
export interface EnvelopeDeEvento<TTipo extends string = string, TDados = Record<string, unknown>> {
  readonly id: string;
  readonly tipo: TTipo;
  readonly versao: number;
  readonly ocorridoEm: string;
  readonly idDoAgregado: string;
  readonly idDeCorrelacao: string;
  readonly dados: TDados;
}

export interface DadosLoteIngerido {
  readonly fonte: string;
  readonly tabela: string;
  readonly versaoDoContrato: string;
  readonly coletadoDe: string;
  readonly coletadoAte: string;
  readonly registros: number;
}

export type LoteIngerido = EnvelopeDeEvento<'LoteIngerido', DadosLoteIngerido>;
