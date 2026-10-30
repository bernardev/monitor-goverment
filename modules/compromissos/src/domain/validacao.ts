import { DomainError, Result } from '@prometeu/shared-kernel';

/** Restringe um texto livre a uma das opções de um conjunto fechado da linguagem ubíqua. */
export function ehUmDe<T extends string>(opcoes: readonly T[], valor: string): valor is T {
  return (opcoes as readonly string[]).includes(valor);
}

/** Texto obrigatório: espaços nas pontas são removidos e o que sobra não pode ser vazio. */
export function textoObrigatorio(
  valor: string,
  codigo: string,
  mensagem: string,
): Result<string, DomainError> {
  const limpo = valor.trim();
  return limpo.length > 0 ? Result.ok(limpo) : Result.fail(new DomainError(codigo, mensagem));
}

/** Remove capturas repetidas mantendo a ordem em que foram informadas. */
export function semRepeticao<T extends { equals(outro: T): boolean }>(itens: readonly T[]): T[] {
  return itens.filter((item, i) => itens.findIndex((outro) => outro.equals(item)) === i);
}
