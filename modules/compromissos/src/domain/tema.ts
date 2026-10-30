import { DomainError, Result, ValueObject } from '@prometeu/shared-kernel';

const SLUG = /^[a-z][a-z0-9_]*$/;

/**
 * Área da promessa (`saude`, `educacao`, `seguranca_publica`). A lista de temas é mantida pela
 * curadoria; aqui só garantimos o formato do código, para que ele sirva de chave em filtros e URLs.
 */
export class Tema extends ValueObject<{ codigo: string }> {
  private constructor(codigo: string) {
    super({ codigo });
  }

  static criar(codigo: string): Result<Tema, DomainError> {
    const normalizado = codigo.trim();
    if (!SLUG.test(normalizado)) {
      return Result.fail(
        new DomainError(
          'promessa.tema_invalido',
          `Tema deve ser um código em minúsculas sem acento, como "saude": "${codigo}"`,
        ),
      );
    }
    return Result.ok(new Tema(normalizado));
  }

  get codigo(): string {
    return this.props.codigo;
  }

  override toString(): string {
    return this.props.codigo;
  }
}
