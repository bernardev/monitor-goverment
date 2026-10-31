import type { EnvelopeDeEvento } from '@prometeu/contracts';
import type { FavorecidosPublicados } from '@prometeu/financas-publicas';
import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { lte } from 'drizzle-orm';

import { type FavorecidoProjetado, favorecidosDaEmenda } from './esquema.js';

/** Eventos que esta projeção acompanha. Todos trazem a lista completa. */
export const EVENTOS_DE_FAVORECIDOS = [
  'FavorecidosDaEmendaRegistrados',
  'FavorecidosDaEmendaAtualizados',
] as const;

/**
 * Mantém a projeção `favorecidos_da_emenda`, com os meses de cada favorecido somados. Vale o evento
 * mais novo: a ordem de chegada não importa, e reaplicar o mesmo evento não muda nada.
 */
export class ProjetorDeFavorecidos {
  constructor(private readonly banco: BancoDoContexto) {}

  async aplicar(envelope: EnvelopeDeEvento): Promise<void> {
    const dados = envelope.dados as unknown as FavorecidosPublicados;
    const favorecidos = somarPorFavorecido(dados.recebimentos);
    const estado = {
      favorecidos,
      recebido: favorecidos.reduce((soma, f) => soma + BigInt(f.recebidoCentavos), 0n),
      capturaId: dados.capturaId,
      ocorridoEm: new Date(envelope.ocorridoEm),
    };
    await this.banco.executor
      .insert(favorecidosDaEmenda)
      .values({ codigoDaEmenda: dados.codigoDaEmenda, ...estado })
      .onConflictDoUpdate({
        target: favorecidosDaEmenda.codigoDaEmenda,
        set: estado,
        setWhere: lte(favorecidosDaEmenda.ocorridoEm, estado.ocorridoEm),
      });
  }
}

/**
 * Um item por favorecido, com o recebido em todos os meses. O identificado é o documento; o somado,
 * o tipo e o município. Nome e natureza jurídica são os do mês mais recente.
 */
function somarPorFavorecido(
  recebimentos: FavorecidosPublicados['recebimentos'],
): FavorecidoProjetado[] {
  const porFavorecido = new Map<string, FavorecidoProjetado>();
  const emMesOrdem = [...recebimentos].sort((a, b) => (a.mes < b.mes ? -1 : a.mes > b.mes ? 1 : 0));
  for (const { mes, favorecido: f, valorCentavos } of emMesOrdem) {
    const chave =
      f.documento === null
        ? [f.tipo, f.uf ?? '', f.municipio ?? ''].join('|')
        : [f.tipo, f.documento].join('|');
    const anterior = porFavorecido.get(chave);
    porFavorecido.set(chave, {
      ...f,
      recebidoCentavos: (
        BigInt(anterior?.recebidoCentavos ?? '0') + BigInt(valorCentavos)
      ).toString(),
      primeiroMes: anterior?.primeiroMes ?? mes,
      ultimoMes: mes,
    });
  }
  return [...porFavorecido.values()].sort((a, b) => {
    const diferenca = BigInt(b.recebidoCentavos) - BigInt(a.recebidoCentavos);
    if (diferenca !== 0n) return diferenca > 0n ? 1 : -1;
    return (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR');
  });
}
