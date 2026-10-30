import type { Identificador } from './identificador.js';

/** Entidade: tem identidade própria; duas entidades são iguais se têm o mesmo identificador. */
export abstract class Entity<TId extends Identificador> {
  protected constructor(readonly id: TId) {}

  equals(other: Entity<TId> | null | undefined): boolean {
    if (other === null || other === undefined) return false;
    if (other.constructor !== this.constructor) return false;
    return this.id.equals(other.id);
  }
}
