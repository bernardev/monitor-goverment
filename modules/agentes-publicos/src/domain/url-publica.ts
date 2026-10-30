import { DomainError, Result, ValueObject } from '@prometeu/shared-kernel';

/** Endereço http(s) publicado por uma fonte oficial, como a foto oficial do parlamentar. */
export class UrlPublica extends ValueObject<{ valor: string }> {
  private constructor(valor: string) {
    super({ valor });
  }

  static criar(texto: string): Result<UrlPublica, DomainError> {
    const valor = texto.trim();
    const protocolo = URL.canParse(valor) ? new URL(valor).protocol : '';
    if (protocolo !== 'https:' && protocolo !== 'http:') {
      return Result.fail(new DomainError('url.invalida', `Endereço inválido: "${texto}"`));
    }
    return Result.ok(new UrlPublica(valor));
  }

  get valor(): string {
    return this.props.valor;
  }

  override toString(): string {
    return this.props.valor;
  }
}
