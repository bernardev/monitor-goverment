import { DomainError, Result } from '@prometeu/shared-kernel';

// A entrada dos casos de uso chega em primitivos; aqui vira objeto do domínio ou DomainError.

export function lerOpcao<T extends string>(
  opcoes: readonly T[],
  valor: string,
  campo: string,
): Result<T, DomainError> {
  const opcao = opcoes.find((o) => o === valor);
  if (opcao !== undefined) return Result.ok(opcao);
  return Result.fail(
    new DomainError('entrada.opcao_invalida', `Valor "${valor}" não é aceito em ${campo}.`, {
      campo,
      opcoes,
    }),
  );
}

/** `null` na entrada é ausência legítima (sem partido, sem foto), não erro. */
export function lerOpcional<T>(
  fabrica: (valor: string) => Result<T, DomainError>,
  valor: string | null,
): Result<T | undefined, DomainError> {
  return valor === null ? Result.ok(undefined) : fabrica(valor);
}
