import type { FrequenciaPublicada } from '@prometeu/atividade-legislativa';
import type { EnvelopeDeEvento } from '@prometeu/contracts';
import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { lte } from 'drizzle-orm';

import { frequencia } from './esquema.js';

/** Eventos que esta projeção acompanha. Todos trazem o estado completo do dia. */
export const EVENTOS_DE_FREQUENCIA = [
  'PresencaRegistrada',
  'AusenciaRegistrada',
  'FrequenciaRetificada',
] as const;

/**
 * Mantém a projeção `frequencia` a partir dos eventos de Atividade Legislativa. Vale o evento mais
 * novo: a ordem de chegada não importa, e reaplicar o mesmo evento não muda nada.
 */
export class ProjetorDeFrequencia {
  constructor(private readonly banco: BancoDoContexto) {}

  async aplicar(envelope: EnvelopeDeEvento): Promise<void> {
    const dados = envelope.dados as unknown as FrequenciaPublicada;
    const estado = {
      pessoaId: dados.pessoaId,
      casa: dados.casa,
      dia: dados.dia,
      situacao: dados.situacao,
      motivoCategoria: dados.motivo?.categoria ?? null,
      motivoDescricao: dados.motivo?.descricaoNaFonte ?? null,
      registroNaFonte: dados.registroNaFonte,
      sessoes: dados.sessoes,
      capturaId: dados.capturaId,
      ocorridoEm: new Date(envelope.ocorridoEm),
    };
    await this.banco.executor
      .insert(frequencia)
      .values({ registroId: envelope.idDoAgregado, ...estado })
      .onConflictDoUpdate({
        target: frequencia.registroId,
        set: estado,
        setWhere: lte(frequencia.ocorridoEm, estado.ocorridoEm),
      });
  }
}
