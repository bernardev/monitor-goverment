import type { EnvelopeDeEvento } from '@prometeu/contracts';

import type { BarramentoDeEventos, ManipuladorDeEvento } from '../barramento.js';

/** Barramento síncrono para testes: entrega na hora, a cada assinante do tipo, e guarda o publicado. */
export class BarramentoEmMemoria implements BarramentoDeEventos {
  readonly publicados: EnvelopeDeEvento[] = [];
  private readonly assinantes = new Map<string, ManipuladorDeEvento[]>();

  async publicar(envelope: EnvelopeDeEvento): Promise<void> {
    this.publicados.push(envelope);
    for (const manipulador of this.assinantes.get(envelope.tipo) ?? []) await manipulador(envelope);
  }

  assinar(tipo: string, _consumidor: string, manipulador: ManipuladorDeEvento): Promise<void> {
    this.assinantes.set(tipo, [...(this.assinantes.get(tipo) ?? []), manipulador]);
    return Promise.resolve();
  }

  tipos(): string[] {
    return this.publicados.map((envelope) => envelope.tipo);
  }

  fechar(): Promise<void> {
    return Promise.resolve();
  }
}
