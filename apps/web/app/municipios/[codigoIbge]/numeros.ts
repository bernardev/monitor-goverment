import { type NumeroChave, textoDaContagem } from '@prometeu/ui';

import { periodoDasEmendas, reaisResumidos } from '../../_componentes/formatacao';

const SEM_DADO = '—';

/** O número com a contagem; o valor é o texto final dela, o mesmo que o servidor entrega sem JavaScript. */
function comContagem(alvo: number): Pick<NumeroChave, 'valor' | 'contagem'> {
  const contagem = { alvo };
  return { valor: textoDaContagem(contagem, 1), contagem };
}

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
      rotulo: obras === 1 ? 'obra paga com emendas' : 'obras pagas com emendas',
      periodo: periodoDasEmendas(dados.obrasColetadasEm),
    },
  ];
}
