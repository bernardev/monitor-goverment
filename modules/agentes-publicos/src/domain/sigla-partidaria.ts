import { DomainError, Result, ValueObject } from '@prometeu/shared-kernel';

// Siglas registradas no TSE usam letras, dígitos e, às vezes, espaço ou ponto ("PCdoB", "PC do B").
const FORMATO = /^[\p{L}\d][\p{L}\d .]{0,19}$/u;

/** Sigla do partido como a fonte oficial a escreve. A ausência de partido é `undefined`, não sigla. */
export class SiglaPartidaria extends ValueObject<{ valor: string }> {
  private constructor(valor: string) {
    super({ valor });
  }

  static criar(sigla: string): Result<SiglaPartidaria, DomainError> {
    const normalizada = sigla.trim();
    if (!FORMATO.test(normalizada)) {
      return Result.fail(
        new DomainError(
          'pessoa.sigla_partidaria_invalida',
          `Sigla partidária inválida: "${sigla}"`,
        ),
      );
    }
    return Result.ok(new SiglaPartidaria(normalizada));
  }

  get valor(): string {
    return this.props.valor;
  }

  override toString(): string {
    return this.props.valor;
  }
}
