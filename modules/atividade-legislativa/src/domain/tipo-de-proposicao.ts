/**
 * Proposições que podem virar norma: emenda constitucional, lei complementar, lei ordinária, medida
 * provisória e decreto legislativo. Requerimentos e outros documentos de trâmite ficam de fora.
 */
export const TIPOS_DE_PROPOSICAO = ['PEC', 'PLP', 'PL', 'MPV', 'PDL'] as const;
export type TipoDeProposicao = (typeof TIPOS_DE_PROPOSICAO)[number];
