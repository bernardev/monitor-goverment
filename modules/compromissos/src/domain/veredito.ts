export const VEREDITOS = [
  'nao_iniciada',
  'em_andamento',
  'travada',
  'cumprida',
  'cumprida_parcialmente',
  'nao_cumprida',
] as const;
export type Veredito = (typeof VEREDITOS)[number];

/**
 * Máquina de estados do veredito (docs/dominio/modelo-compromissos.md). `cumprida` e `nao_cumprida`
 * são finais: sair delas só por errata, que corrige um erro em vez de registrar uma mudança no mundo.
 */
const TRANSICOES: Readonly<Record<Veredito, readonly Veredito[]>> = {
  nao_iniciada: ['em_andamento', 'nao_cumprida'],
  em_andamento: ['travada', 'cumprida_parcialmente', 'cumprida', 'nao_cumprida'],
  travada: ['em_andamento', 'nao_cumprida'],
  cumprida_parcialmente: ['cumprida', 'nao_cumprida'],
  cumprida: [],
  nao_cumprida: [],
};

/** Vereditos que só vão ao ar com revisão de outra pessoa (regra dos quatro olhos, invariante 3). */
const SENSIVEIS: readonly Veredito[] = [
  'travada',
  'cumprida',
  'cumprida_parcialmente',
  'nao_cumprida',
];

export function podeTransitar(de: Veredito, para: Veredito): boolean {
  return TRANSICOES[de].includes(para);
}

export function ehSensivel(veredito: Veredito): boolean {
  return SENSIVEIS.includes(veredito);
}
