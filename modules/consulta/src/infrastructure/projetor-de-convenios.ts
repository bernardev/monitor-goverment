import type { EnvelopeDeEvento } from '@prometeu/contracts';
import type { ConvenioPublicado } from '@prometeu/financas-publicas';
import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { lte } from 'drizzle-orm';

import { convenio } from './esquema.js';

/** Eventos que esta projeção acompanha. Todos trazem o estado completo do convênio. */
export const EVENTOS_DE_CONVENIO = ['ConvenioRegistrado', 'ConvenioAtualizado'] as const;

/**
 * Mantém a projeção `convenio`. Vale o evento mais novo: a ordem de chegada não importa, e reaplicar
 * o mesmo evento não muda nada.
 */
export class ProjetorDeConvenios {
  constructor(private readonly banco: BancoDoContexto) {}

  async aplicar(envelope: EnvelopeDeEvento): Promise<void> {
    const dados = envelope.dados as unknown as ConvenioPublicado;
    const estado = {
      numero: dados.numero,
      convenente: dados.convenente,
      objeto: dados.objeto,
      publicadoEm: dados.publicadoEm,
      valor: BigInt(dados.valorCentavos),
      emendas: dados.emendas,
      codigosDasEmendas: [...new Set(dados.emendas.map((e) => e.codigoDaEmenda))].sort(),
      capturaId: dados.capturaId,
      ocorridoEm: new Date(envelope.ocorridoEm),
    };
    await this.banco.executor
      .insert(convenio)
      .values({ convenioId: envelope.idDoAgregado, ...estado })
      .onConflictDoUpdate({
        target: convenio.convenioId,
        set: estado,
        setWhere: lte(convenio.ocorridoEm, estado.ocorridoEm),
      });
  }
}
