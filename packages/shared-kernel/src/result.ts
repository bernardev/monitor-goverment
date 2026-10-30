/**
 * Resultado explícito de uma operação de domínio.
 *
 * Regras de negócio violadas são resultados esperados, não exceções (ver ADR-0003):
 * quem chama é obrigado pelo compilador a tratar o caso de falha.
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Fail<E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E> = Ok<T> | Fail<E>;

export const Result = {
  ok<T>(value: T): Ok<T> {
    return { ok: true, value };
  },

  fail<E>(error: E): Fail<E> {
    return { ok: false, error };
  },

  /** Combina vários resultados: devolve o primeiro erro ou a lista de valores. */
  all<T, E>(results: readonly Result<T, E>[]): Result<T[], E> {
    const values: T[] = [];
    for (const result of results) {
      if (!result.ok) return result;
      values.push(result.value);
    }
    return Result.ok(values);
  },
};
