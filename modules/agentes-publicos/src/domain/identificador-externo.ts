import { DomainError, Result, ValueObject } from '@prometeu/shared-kernel';

export const FONTES_EXTERNAS = ['camara', 'senado', 'tse', 'portal_transparencia'] as const;
export type FonteExterna = (typeof FONTES_EXTERNAS)[number];

/**
 * Código de uma pessoa numa fonte oficial (`camara:204554`). Este contexto é o único que diz que
 * códigos de fontes diferentes são a mesma pessoa (docs/dominio/mapa-de-contextos.md).
 */
export class IdentificadorExterno extends ValueObject<{ fonte: FonteExterna; codigo: string }> {
  private constructor(fonte: FonteExterna, codigo: string) {
    super({ fonte, codigo });
  }

  static criar(fonte: string, codigo: string): Result<IdentificadorExterno, DomainError> {
    const fonteConhecida = FONTES_EXTERNAS.find((f) => f === fonte);
    if (fonteConhecida === undefined) {
      return Result.fail(
        new DomainError('identificador.fonte_desconhecida', `Fonte desconhecida: "${fonte}"`),
      );
    }
    const normalizado = codigo.trim();
    if (normalizado.length === 0) {
      return Result.fail(
        new DomainError('identificador.codigo_vazio', `O código na fonte ${fonte} está vazio.`),
      );
    }
    return Result.ok(new IdentificadorExterno(fonteConhecida, normalizado));
  }

  get fonte(): FonteExterna {
    return this.props.fonte;
  }

  get codigo(): string {
    return this.props.codigo;
  }

  override toString(): string {
    return `${this.props.fonte}:${this.props.codigo}`;
  }
}
