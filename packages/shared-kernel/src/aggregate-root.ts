import type { DomainEvent } from './domain-event.js';
import { Entity } from './entity.js';
import type { Identificador } from './identificador.js';

/**
 * Raiz de agregado: a única porta de entrada para alterar o agregado e a fronteira de consistência.
 *
 * Os eventos registrados aqui são gravados pelo repositório na outbox, na mesma transação do
 * agregado (ADR-0007). Por isso o repositório chama `pullDomainEvents()` depois de persistir.
 */
export abstract class AggregateRoot<TId extends Identificador> extends Entity<TId> {
  private domainEvents: DomainEvent[] = [];

  protected addDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  pullDomainEvents(): DomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }
}
