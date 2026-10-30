/** Cadeia de entrega em ordem: a posição no array é o quão avançado é o estágio. */
export const ESTAGIOS = ['prometida', 'ato', 'orcamento', 'execucao', 'entrega'] as const;
export type EstagioNaCadeia = (typeof ESTAGIOS)[number];

/** Estágios que um vínculo pode comprovar. `prometida` é o ponto de partida, não precisa de prova. */
export type EstagioComprovavel = Exclude<EstagioNaCadeia, 'prometida'>;

export function posicaoNaCadeia(estagio: EstagioNaCadeia): number {
  return ESTAGIOS.indexOf(estagio);
}

export function estagioMaisAvancado(estagios: Iterable<EstagioNaCadeia>): EstagioNaCadeia {
  let maisAvancado: EstagioNaCadeia = 'prometida';
  for (const estagio of estagios) {
    if (posicaoNaCadeia(estagio) > posicaoNaCadeia(maisAvancado)) maisAvancado = estagio;
  }
  return maisAvancado;
}
