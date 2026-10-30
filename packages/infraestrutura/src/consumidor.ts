import type { EnvelopeDeEvento } from '@prometeu/contracts';

import type { BancoDoContexto } from './banco.js';
import type { ManipuladorDeEvento } from './barramento.js';
import { comCorrelacao } from './correlacao.js';
import type { TabelaInbox } from './tabelas.js';

/**
 * Embrulha o efeito de um consumidor para que cada evento produza efeito uma única vez (ADR-0015): o
 * registro na inbox e o efeito acontecem na mesma transação do contexto. O efeito herda o
 * `idDeCorrelacao` do evento, e os eventos que ele gerar continuam a mesma cadeia.
 */
export function consumidorIdempotente(
  banco: BancoDoContexto,
  inbox: TabelaInbox,
  consumidor: string,
  efeito: (envelope: EnvelopeDeEvento) => Promise<void>,
): ManipuladorDeEvento {
  return (envelope) =>
    comCorrelacao(envelope.idDeCorrelacao, () =>
      banco.transacao(async (tx) => {
        const novo = await tx
          .insert(inbox)
          .values({ idDoEvento: envelope.id, consumidor })
          .onConflictDoNothing()
          .returning({ id: inbox.idDoEvento });
        if (novo.length > 0) await efeito(envelope);
      }),
    );
}
