import type { EnvelopeDeEvento } from '@prometeu/contracts';
import type { BancoDoContexto } from '@prometeu/infraestrutura';
import type { ObraPublicada } from '@prometeu/obras';
import { lte } from 'drizzle-orm';

import { obra } from './esquema.js';

/**
 * Eventos que esta projeção acompanha. Todos trazem o estado completo da obra; `ObraParalisada`
 * vem junto com `ObraAtualizada` e não muda a projeção.
 */
export const EVENTOS_DE_OBRA = ['ObraRegistrada', 'ObraAtualizada'] as const;

/**
 * Mantém a projeção `obra`. Vale o evento mais novo: a ordem de chegada não importa, e reaplicar o
 * mesmo evento não muda nada.
 */
export class ProjetorDeObras {
  constructor(private readonly banco: BancoDoContexto) {}

  async aplicar(envelope: EnvelopeDeEvento): Promise<void> {
    const dados = envelope.dados as unknown as ObraPublicada;
    const estado = {
      idNaFonte: dados.idNaFonte,
      nome: dados.nome,
      situacao: dados.situacao,
      uf: dados.uf,
      percentualCentesimos: dados.medicao?.percentualCentesimos ?? null,
      investimentoPrevisto: BigInt(dados.investimentoPrevistoCentavos),
      codigosDasEmendas: [...new Set(dados.emendas.map((e) => e.codigoDaEmenda))].sort(),
      estado: dados,
      capturaId: dados.capturaId,
      ocorridoEm: new Date(envelope.ocorridoEm),
    };
    await this.banco.executor
      .insert(obra)
      .values({ obraId: envelope.idDoAgregado, ...estado })
      .onConflictDoUpdate({
        target: obra.obraId,
        set: estado,
        setWhere: lte(obra.ocorridoEm, estado.ocorridoEm),
      });
  }
}
