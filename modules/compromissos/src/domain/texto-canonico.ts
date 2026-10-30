import { DomainError, Result, ValueObject } from '@prometeu/shared-kernel';

const LIMITE = 500;

/**
 * A promessa escrita de forma curta e neutra ("Construir 500 creches até 2028"). É o texto exibido;
 * a fala original fica no trecho de cada fonte.
 */
export class TextoCanonico extends ValueObject<{ valor: string }> {
  private constructor(valor: string) {
    super({ valor });
  }

  static criar(texto: string): Result<TextoCanonico, DomainError> {
    const normalizado = texto.trim().replace(/\s+/g, ' ');
    if (normalizado.length === 0) {
      return Result.fail(
        new DomainError('promessa.texto_vazio', 'A promessa precisa de um texto.'),
      );
    }
    if (normalizado.length > LIMITE) {
      return Result.fail(
        new DomainError(
          'promessa.texto_longo',
          `O texto da promessa passa de ${LIMITE} caracteres.`,
          {
            tamanho: normalizado.length,
          },
        ),
      );
    }
    return Result.ok(new TextoCanonico(normalizado));
  }

  get valor(): string {
    return this.props.valor;
  }

  override toString(): string {
    return this.props.valor;
  }
}
