import type { FonteDoDado } from '@prometeu/contracts';

/** A fonte coletada por último entre os itens listados (emendas ou obras); `undefined` se não há item. */
export function fonteMaisRecente(
  emendas: { readonly itens: readonly { readonly fonte: FonteDoDado }[] } | undefined,
): FonteDoDado | undefined {
  return (emendas?.itens ?? [])
    .map((e) => e.fonte)
    .reduce<FonteDoDado | undefined>(
      (a, b) => (a === undefined || (b.coletadaEm ?? '') > (a.coletadaEm ?? '') ? b : a),
      undefined,
    );
}
