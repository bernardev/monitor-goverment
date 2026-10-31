import { and, eq, inArray, isNotNull } from 'drizzle-orm';

import type { BancoDoContexto } from './banco.js';
import type { TabelaInbox, TabelaOutbox } from './tabelas.js';

export interface OrigemDaReentrega {
  readonly banco: BancoDoContexto;
  readonly outbox: TabelaOutbox;
}

export interface DestinoDaReentrega {
  readonly banco: BancoDoContexto;
  readonly inbox: TabelaInbox;
  readonly consumidor: string;
}

export interface Reentrega {
  /** Eventos que o relay vai publicar de novo. */
  readonly republicados: number;
  /** Registros da inbox do consumidor esquecidos: ele vai processar esses eventos de novo. */
  readonly esquecidos: number;
}

/**
 * Prepara a reentrega de eventos a um consumidor: apaga da inbox dele o registro de que já os
 * processou e marca na outbox de origem que não foram publicados, para o relay publicar de novo
 * (ADR-0007, ADR-0015). Os outros consumidores também recebem, e a inbox deles descarta.
 *
 * Serve para importar de novo um lote depois de corrigir um importador, ou para alimentar desde o
 * começo um consumidor novo (uma projeção nova). Sem `eventos`, reentrega toda a outbox de origem,
 * opcionalmente só os de um `tipo`.
 */
export async function reentregar(
  origem: OrigemDaReentrega,
  destino: DestinoDaReentrega,
  filtro: { readonly eventos?: readonly string[]; readonly tipo?: string } = {},
): Promise<Reentrega> {
  const { outbox } = origem;
  const { inbox } = destino;
  const escolhidos = and(
    isNotNull(outbox.publicadoEm),
    filtro.eventos === undefined ? undefined : inArray(outbox.id, [...filtro.eventos]),
    filtro.tipo === undefined ? undefined : eq(outbox.tipo, filtro.tipo),
  );
  const ids = (
    await origem.banco.drizzle.select({ id: outbox.id }).from(outbox).where(escolhidos)
  ).map((e) => e.id);
  if (ids.length === 0) return { republicados: 0, esquecidos: 0 };

  // Primeiro a inbox: se o relay publicar antes, o consumidor já não descarta o evento.
  let esquecidos = 0;
  for (let inicio = 0; inicio < ids.length; inicio += 1000) {
    const parte = ids.slice(inicio, inicio + 1000);
    const apagados = await destino.banco.drizzle
      .delete(inbox)
      .where(and(eq(inbox.consumidor, destino.consumidor), inArray(inbox.idDoEvento, parte)))
      .returning({ id: inbox.idDoEvento });
    esquecidos += apagados.length;
  }
  let republicados = 0;
  for (let inicio = 0; inicio < ids.length; inicio += 1000) {
    const parte = ids.slice(inicio, inicio + 1000);
    const marcados = await origem.banco.drizzle
      .update(outbox)
      .set({ publicadoEm: null })
      .where(inArray(outbox.id, parte))
      .returning({ id: outbox.id });
    republicados += marcados.length;
  }
  return { republicados, esquecidos };
}
