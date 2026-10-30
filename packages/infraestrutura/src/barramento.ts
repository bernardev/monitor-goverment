import type { EnvelopeDeEvento } from '@prometeu/contracts';
import { PgBoss } from 'pg-boss';

export type ManipuladorDeEvento = (envelope: EnvelopeDeEvento) => Promise<void>;

/** Porta do barramento entre contextos (ADR-0007). O domínio nunca a vê; só relays e consumidores. */
export interface BarramentoDeEventos {
  publicar(envelope: EnvelopeDeEvento): Promise<void>;
  /**
   * Entrega cada evento do `tipo` ao `consumidor`. Cada par consumidor e tipo tem sua fila, suas
   * tentativas e sua fila de falhas: um consumidor lento ou quebrado não afeta os outros. Assinar de
   * novo (outra instância do worker, um reinício) reaproveita a mesma fila.
   */
  assinar(tipo: string, consumidor: string, manipulador: ManipuladorDeEvento): Promise<void>;
  fechar(): Promise<void>;
}

const SCHEMA = 'barramento';

export class BarramentoPgBoss implements BarramentoDeEventos {
  private constructor(private readonly boss: PgBoss) {}

  static async iniciar(url: string): Promise<BarramentoPgBoss> {
    const boss = new PgBoss({ connectionString: url, schema: SCHEMA, application_name: SCHEMA });
    await boss.start();
    return new BarramentoPgBoss(boss);
  }

  async publicar(envelope: EnvelopeDeEvento): Promise<void> {
    await this.boss.publish(envelope.tipo, envelope, { singletonKey: envelope.id });
  }

  async assinar(tipo: string, consumidor: string, manipulador: ManipuladorDeEvento): Promise<void> {
    const fila = `${consumidor}.${tipo}`;
    const falhas = `${fila}.falhas`;
    await this.boss.createQueue(falhas);
    await this.boss.createQueue(fila, { retryLimit: 5, retryBackoff: true, deadLetter: falhas });
    await this.boss.subscribe(tipo, fila);
    await this.boss.work<EnvelopeDeEvento>(fila, async (jobs) => {
      for (const job of jobs) await manipulador(job.data);
    });
  }

  async fechar(): Promise<void> {
    await this.boss.stop({ graceful: true });
  }
}
