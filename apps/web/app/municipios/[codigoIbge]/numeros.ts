import type { NumeroChave } from '@prometeu/ui';

import {
  comContagem,
  periodoDasEmendas,
  reaisResumidos,
  SEM_DADO,
} from '../../_componentes/formatacao';

/**
 * Os quatro números da faixa do topo: pago, empenhado, emendas e obras. Sem dado, o valor é "—" e
 * não conta; o rótulo e o período ficam, para a faixa não mudar de forma.
 */
export function numerosDaCidade(dados: {
  pagoCentavos: bigint;
  empenhadoCentavos: bigint;
  emendas: number;
  obras: number;
  emendasColetadasEm: string | null;
  obrasColetadasEm: string | null;
}): NumeroChave[] {
  const { pagoCentavos, empenhadoCentavos, emendas, obras } = dados;
  const periodoDasEmendasDaCidade = periodoDasEmendas(dados.emendasColetadasEm);
  const comEmendas = emendas > 0;
  return [
    {
      valor: comEmendas ? reaisResumidos(pagoCentavos) : SEM_DADO,
      rotulo: 'já pago em emendas para a cidade',
      periodo: periodoDasEmendasDaCidade,
    },
    {
      valor: comEmendas ? reaisResumidos(empenhadoCentavos) : SEM_DADO,
      rotulo: 'empenhado (reservado no orçamento) para a cidade',
      periodo: periodoDasEmendasDaCidade,
    },
    {
      ...(comEmendas ? comContagem(emendas) : { valor: SEM_DADO }),
      rotulo: emendas === 1 ? 'emenda com destino à cidade' : 'emendas com destino à cidade',
      periodo: periodoDasEmendasDaCidade,
    },
    {
      ...(obras > 0 ? comContagem(obras) : { valor: SEM_DADO }),
      rotulo: obras === 1 ? 'obra com dinheiro de emenda' : 'obras com dinheiro de emenda',
      periodo: periodoDasEmendas(dados.obrasColetadasEm),
    },
  ];
}
