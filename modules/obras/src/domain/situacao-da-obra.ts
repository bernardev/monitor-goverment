/**
 * Em que pé a obra está. `planejada`: cadastrada, sem execução iniciada. `inacabada`: parou e foi
 * dada como não concluída, sem previsão de retomada.
 */
export const SITUACOES_DA_OBRA = [
  'planejada',
  'em_execucao',
  'paralisada',
  'concluida',
  'cancelada',
  'inacabada',
] as const;
export type SituacaoDaObra = (typeof SITUACOES_DA_OBRA)[number];

/** O que o histórico registra: as interrupções da obra. */
export const INTERRUPCOES = ['paralisada', 'cancelada', 'inacabada'] as const;
export type Interrupcao = (typeof INTERRUPCOES)[number];
