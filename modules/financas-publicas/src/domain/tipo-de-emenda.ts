/**
 * Quem indica a emenda e como o dinheiro chega. A individual vai com finalidade definida; a
 * transferência especial (a "emenda PIX") cai direto no caixa do ente, sem finalidade definida.
 * Bancada, comissão e relator são autores coletivos.
 */
export const TIPOS_DE_EMENDA = [
  'individual',
  'transferencia_especial',
  'bancada',
  'comissao',
  'relator',
] as const;
export type TipoDeEmenda = (typeof TIPOS_DE_EMENDA)[number];

/** Só a emenda individual (com finalidade ou PIX) tem um parlamentar como autor. */
export function temAutorIndividual(tipo: TipoDeEmenda): boolean {
  return tipo === 'individual' || tipo === 'transferencia_especial';
}
