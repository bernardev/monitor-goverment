import type { DadosLoteIngerido, EnvelopeDeEvento } from '@prometeu/contracts';
import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { lte } from 'drizzle-orm';

import { coleta } from './esquema.js';

export const EVENTOS_DE_COLETA = ['LoteIngerido'] as const;

/**
 * Mantém a projeção `coleta`: a última coleta de cada tabela de cada fonte. Vale o lote mais novo;
 * reaplicar o mesmo lote não muda nada.
 */
export class ProjetorDeColetas {
  constructor(private readonly banco: BancoDoContexto) {}

  async aplicar(envelope: EnvelopeDeEvento): Promise<void> {
    const dados = envelope.dados as unknown as DadosLoteIngerido;
    const estado = {
      versaoDoContrato: dados.versaoDoContrato,
      registros: dados.registros,
      ocorridoEm: new Date(envelope.ocorridoEm),
    };
    await this.banco.executor
      .insert(coleta)
      .values({ fonte: dados.fonte, tabela: dados.tabela, ...estado })
      .onConflictDoUpdate({
        target: [coleta.fonte, coleta.tabela],
        set: estado,
        setWhere: lte(coleta.ocorridoEm, estado.ocorridoEm),
      });
  }
}
