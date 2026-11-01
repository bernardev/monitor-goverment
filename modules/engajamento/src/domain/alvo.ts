import { CodigoIbge, DomainError, Result, ValueObject } from '@prometeu/shared-kernel';

/** O que um cidadão pode acompanhar hoje. Promessa entra quando houver promessa publicada no site. */
export const TIPOS_DE_ALVO = ['parlamentar', 'municipio'] as const;
export type TipoDeAlvo = (typeof TIPOS_DE_ALVO)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * O que é acompanhado: um parlamentar (pela pessoa, em Agentes Públicos) ou um município (pelo código
 * IBGE de 7 dígitos). Só o identificador; o nome e o resto vêm de quem é dono do dado.
 */
export class Alvo extends ValueObject<{ tipo: TipoDeAlvo; id: string }> {
  private constructor(tipo: TipoDeAlvo, id: string) {
    super({ tipo, id });
  }

  static criar(tipo: string, id: string): Result<Alvo, DomainError> {
    const tipoValido = TIPOS_DE_ALVO.find((t) => t === tipo);
    if (!tipoValido) {
      return Result.fail(
        new DomainError('alvo.tipo_invalido', `Não dá para acompanhar "${tipo}".`),
      );
    }
    const normalizado = id.trim().toLowerCase();
    const valido =
      tipoValido === 'parlamentar'
        ? UUID.test(normalizado)
        : normalizado.length === 7 && CodigoIbge.criar(normalizado).ok;
    if (!valido) {
      return Result.fail(new DomainError('alvo.id_invalido', `Identificador inválido: "${id}".`));
    }
    return Result.ok(new Alvo(tipoValido, normalizado));
  }

  get tipo(): TipoDeAlvo {
    return this.props.tipo;
  }

  get id(): string {
    return this.props.id;
  }

  /** `municipio:4314902`: uma chave por alvo, para não acompanhar o mesmo duas vezes. */
  get chave(): string {
    return `${this.props.tipo}:${this.props.id}`;
  }
}
