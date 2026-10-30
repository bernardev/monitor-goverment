// Ajudas das camadas anticorrupção: regras de tradução comuns a mais de uma fonte.

/** Verdadeiro na primeira vez que o código aparece; serve para tirar repetições mantendo a ordem. */
export function primeiraVez<T>(vistos: Set<T>, codigo: T): boolean {
  if (vistos.has(codigo)) return false;
  vistos.add(codigo);
  return true;
}

/** Um dia (`aaaa-mm-dd`) sem hora vira o primeiro instante dele em Brasília. */
export function inicioDoDia(dia: string): Date {
  return new Date(`${dia}T00:00:00.000-03:00`);
}
