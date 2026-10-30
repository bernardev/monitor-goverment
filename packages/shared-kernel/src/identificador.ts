import { randomBytes } from 'node:crypto';

import { DomainError } from './domain-error.js';
import { Result } from './result.js';
import { ValueObject } from './value-object.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * Base para identificadores de entidades. Cada agregado declara o seu (`PromessaId`, `MandatoId`...),
 * e o compilador impede trocar um pelo outro.
 *
 * Usamos UUIDv7 (ADR-0006): ordenável pelo tempo de criação, o que mantém os índices compactos.
 */
export abstract class Identificador extends ValueObject<{ valor: string }> {
  protected constructor(valor: string) {
    super({ valor });
  }

  get valor(): string {
    return this.props.valor;
  }

  override toString(): string {
    return this.props.valor;
  }

  /** Valida o texto antes de uma subclasse construir o identificador. */
  protected static validar(valor: string): Result<string, DomainError> {
    const normalizado = valor.trim().toLowerCase();
    if (!UUID.test(normalizado)) {
      return Result.fail(
        new DomainError('identificador.invalido', `Identificador inválido: "${valor}"`),
      );
    }
    return Result.ok(normalizado);
  }
}

/** Gera um UUIDv7 (RFC 9562): 48 bits de milissegundos Unix seguidos de bits aleatórios. */
export function gerarUuidV7(agoraEmMs: number = Date.now()): string {
  const bytes = randomBytes(16);
  let tempo = BigInt(agoraEmMs);
  for (let i = 5; i >= 0; i--) {
    bytes[i] = Number(tempo & 0xffn);
    tempo >>= 8n;
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
