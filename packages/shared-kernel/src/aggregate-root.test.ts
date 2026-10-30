import { describe, expect, it } from 'vitest';

import { AggregateRoot } from './aggregate-root.js';
import { criarEvento } from './domain-event.js';
import { Identificador, gerarUuidV7 } from './identificador.js';

class ContadorId extends Identificador {
  static gerar(): ContadorId {
    return new ContadorId(gerarUuidV7());
  }
}

class Contador extends AggregateRoot<ContadorId> {
  private valor = 0;

  static criar(): Contador {
    return new Contador(ContadorId.gerar());
  }

  incrementar(): void {
    this.valor += 1;
    this.addDomainEvent(
      criarEvento({
        tipo: 'ContadorIncrementado',
        idDoAgregado: this.id.valor,
        dados: { valor: this.valor },
      }),
    );
  }
}

describe('AggregateRoot', () => {
  it('acumula eventos e os entrega uma única vez', () => {
    const contador = Contador.criar();
    contador.incrementar();
    contador.incrementar();

    const eventos = contador.pullDomainEvents();
    expect(eventos.map((e) => e.dados)).toEqual([{ valor: 1 }, { valor: 2 }]);
    expect(eventos.every((e) => e.idDoAgregado === contador.id.valor && e.versao === 1)).toBe(true);
    expect(contador.pullDomainEvents()).toEqual([]);
  });

  it('compara entidades pela identidade', () => {
    const a = Contador.criar();
    const b = Contador.criar();
    expect(a.equals(a)).toBe(true);
    expect(a.equals(b)).toBe(false);
  });
});
