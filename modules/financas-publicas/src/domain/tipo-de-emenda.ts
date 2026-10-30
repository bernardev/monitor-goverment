/**
 * Quem indica a emenda. A individual é de um parlamentar; bancada, comissão e relator são autores
 * coletivos.
 */
export const TIPOS_DE_EMENDA = ['individual', 'bancada', 'comissao', 'relator'] as const;
export type TipoDeEmenda = (typeof TIPOS_DE_EMENDA)[number];

/**
 * Como o dinheiro da emenda individual chega ao ente. Com finalidade definida, vai para uma ação
 * orçamentária específica; a transferência especial (a "emenda PIX") cai direto no caixa do ente.
 * A mesma emenda pode ter destinações nas duas modalidades.
 */
export const MODALIDADES = ['finalidade_definida', 'transferencia_especial'] as const;
export type Modalidade = (typeof MODALIDADES)[number];

/** Só a emenda individual tem um parlamentar como autor. */
export function temAutorIndividual(tipo: TipoDeEmenda): boolean {
  return tipo === 'individual';
}
