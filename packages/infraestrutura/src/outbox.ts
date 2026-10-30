import type { EnvelopeDeEvento } from '@prometeu/contracts';
import type { DomainEvent } from '@prometeu/shared-kernel';
import { asc, inArray, isNull } from 'drizzle-orm';

import type { BancoDoContexto, Executor } from './banco.js';
import type { BarramentoDeEventos } from './barramento.js';
import { idDeCorrelacaoAtual } from './correlacao.js';
import type { TabelaOutbox } from './tabelas.js';

/**
 * Grava os eventos do agregado na outbox. Chame dentro da mesma transação que grava o agregado
 * (ADR-0007): ou os dois ficam, ou nenhum.
 */
export async function gravarNaOutbox(
  executor: Executor,
  outbox: TabelaOutbox,
  eventos: readonly DomainEvent[],
): Promise<void> {
  if (eventos.length === 0) return;
  const idDeCorrelacao = idDeCorrelacaoAtual();
  await executor.insert(outbox).values(
    eventos.map((evento) => ({
      id: evento.id,
      tipo: evento.tipo,
      versao: evento.versao,
      ocorridoEm: evento.ocorridoEm,
      idDoAgregado: evento.idDoAgregado,
      idDeCorrelacao,
      dados: evento.dados as Record<string, unknown>,
    })),
  );
}

/**
 * Publica no barramento o que está pendente na outbox de um contexto (ADR-0015). Entrega pelo menos
 * uma vez: se a marcação falhar depois de publicar, o evento sai de novo e a inbox do consumidor
 * descarta a repetição.
 */
export class RelayDaOutbox {
  private temporizador: NodeJS.Timeout | undefined;
  private parado = true;

  constructor(
    private readonly banco: BancoDoContexto,
    private readonly outbox: TabelaOutbox,
    private readonly barramento: BarramentoDeEventos,
  ) {}

  /** Publica até `limite` eventos, do mais antigo ao mais novo. Devolve quantos publicou. */
  publicarPendentes(limite = 100): Promise<number> {
    return this.banco.transacao(async (tx) => {
      const pendentes = await tx
        .select()
        .from(this.outbox)
        .where(isNull(this.outbox.publicadoEm))
        .orderBy(asc(this.outbox.ocorridoEm), asc(this.outbox.id))
        .limit(limite)
        .for('update', { skipLocked: true });
      for (const linha of pendentes) await this.barramento.publicar(paraEnvelope(linha));
      if (pendentes.length > 0) {
        await tx
          .update(this.outbox)
          .set({ publicadoEm: new Date() })
          .where(
            inArray(
              this.outbox.id,
              pendentes.map((linha) => linha.id),
            ),
          );
      }
      return pendentes.length;
    });
  }

  /** Esvazia a outbox continuamente; espera `intervaloEmMs` quando não há nada pendente. */
  iniciar(intervaloEmMs = 1000, aoFalhar: (erro: unknown) => void = () => undefined): void {
    this.parado = false;
    const ciclo = async (): Promise<void> => {
      let publicados = 0;
      try {
        publicados = await this.publicarPendentes();
      } catch (erro) {
        aoFalhar(erro);
      }
      if (!this.parado)
        this.temporizador = setTimeout(() => void ciclo(), publicados > 0 ? 0 : intervaloEmMs);
    };
    void ciclo();
  }

  parar(): void {
    this.parado = true;
    clearTimeout(this.temporizador);
  }
}

function paraEnvelope(linha: TabelaOutbox['$inferSelect']): EnvelopeDeEvento {
  return {
    id: linha.id,
    tipo: linha.tipo,
    versao: linha.versao,
    ocorridoEm: linha.ocorridoEm.toISOString(),
    idDoAgregado: linha.idDoAgregado,
    idDeCorrelacao: linha.idDeCorrelacao,
    dados: linha.dados,
  };
}
