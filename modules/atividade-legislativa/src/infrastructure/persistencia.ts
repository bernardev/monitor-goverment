import type { DomainError, Result } from '@prometeu/shared-kernel';

/** Outra gravação mudou o agregado entre a leitura e a escrita; o consumidor tenta de novo. */
export class ConflitoDeConcorrencia extends Error {
  constructor(agregado: string) {
    super(`${agregado} foi alterado por outra gravação.`);
  }
}

export function conhecido<T extends string>(
  valores: readonly T[],
  valor: string,
  campo: string,
): T {
  const encontrado = valores.find((v) => v === valor);
  if (encontrado === undefined) {
    throw new Error(`Dado corrompido em atividade_legislativa: ${campo} "${valor}"`);
  }
  return encontrado;
}

/** O banco só guarda o que o domínio validou; um valor inválido aqui é dado corrompido. */
export function confiavel<T>(resultado: Result<T, DomainError>): T {
  if (!resultado.ok) {
    throw new Error(`Dado corrompido em atividade_legislativa: ${resultado.error.message}`);
  }
  return resultado.value;
}
