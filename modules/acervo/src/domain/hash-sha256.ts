import { DomainError, Result, ValueObject } from '@prometeu/shared-kernel';

const HEXADECIMAL_DE_64 = /^[0-9a-f]{64}$/;

/** Impressão digital do conteúdo capturado. Duas capturas com o mesmo hash são a mesma prova. */
export class HashSha256 extends ValueObject<{ valor: string }> {
  private constructor(valor: string) {
    super({ valor });
  }

  static de(valor: string): Result<HashSha256, DomainError> {
    const normalizado = valor.trim().toLowerCase();
    if (!HEXADECIMAL_DE_64.test(normalizado)) {
      return Result.fail(
        new DomainError('captura.hash_invalido', `Hash SHA-256 inválido: "${valor}"`),
      );
    }
    return Result.ok(new HashSha256(normalizado));
  }

  get valor(): string {
    return this.props.valor;
  }

  override toString(): string {
    return this.props.valor;
  }
}
