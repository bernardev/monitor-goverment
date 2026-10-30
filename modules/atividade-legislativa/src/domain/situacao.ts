/** Situação de um mandato num dia de sessão. Só `ausencia_justificada` tem motivo. */
export const SITUACOES = ['presente', 'ausente', 'ausencia_justificada'] as const;
export type Situacao = (typeof SITUACOES)[number];
