import type { EmendasDoParlamentar, FrequenciaDoParlamentar } from '@prometeu/contracts';
import type { NumeroChave } from '@prometeu/ui';

import { fonteMaisRecente } from '../../_componentes/fonte-mais-recente';
import {
  comContagem,
  NUMERO,
  pagoAteAgora,
  periodoDasEmendas,
  periodoEmMeses,
  reaisResumidos,
  SEM_DADO,
} from '../../_componentes/formatacao';

/**
 * Os quatro números da faixa do topo: presença, faltas justificadas, emendas e quanto delas já foi
 * pago. Sem dado, o valor é "—" e não conta; o rótulo e o período ficam, para a faixa não mudar de
 * forma.
 */
export function numerosDoParlamentar(dados: {
  frequencia?: FrequenciaDoParlamentar | undefined;
  emendas?: EmendasDoParlamentar | undefined;
}): NumeroChave[] {
  const { frequencia, emendas } = dados;
  const resumo = frequencia && frequencia.resumo.diasComSessao > 0 ? frequencia.resumo : null;
  const periodoDaPresenca = frequencia
    ? periodoEmMeses(frequencia.de, frequencia.ate)
    : 'sem dias de sessão coletados';
  const periodoDasEmendasDele = periodoDasEmendas(fonteMaisRecente(emendas)?.coletadaEm ?? null);

  const empenhado = emendas ? BigInt(emendas.soma.empenhadoCentavos) : 0n;
  const pago = emendas ? pagoAteAgora(emendas.soma) : 0n;
  const comEmendas = emendas !== undefined && emendas.total > 0;

  const semJustificativa = resumo?.ausenciasSemJustificativa ?? 0;
  return [
    {
      ...(resumo
        ? comContagem(resumo.presencas, { sufixo: ` de ${NUMERO.format(resumo.diasComSessao)}` })
        : { valor: SEM_DADO }),
      rotulo: 'dias de sessão em que esteve presente',
      periodo: periodoDaPresenca,
    },
    {
      ...(resumo ? comContagem(resumo.ausenciasJustificadas) : { valor: SEM_DADO }),
      rotulo: resumo
        ? `${resumo.ausenciasJustificadas === 1 ? 'falta justificada' : 'faltas justificadas'} (e ${semJustificativa === 0 ? 'nenhuma' : NUMERO.format(semJustificativa)} sem justificativa)`
        : 'faltas justificadas',
      periodo: periodoDaPresenca,
    },
    {
      ...(comEmendas ? comContagem(emendas.total) : { valor: SEM_DADO }),
      rotulo: comEmendas
        ? `${emendas.total === 1 ? 'emenda indicada' : 'emendas indicadas'}, ${reaisResumidos(empenhado)}`
        : 'emendas indicadas',
      periodo: periodoDasEmendasDele,
    },
    {
      ...(comEmendas && empenhado > 0n
        ? comContagem(Number((pago * 100n) / empenhado), { sufixo: '%' })
        : { valor: SEM_DADO }),
      rotulo: 'do valor das emendas já pago',
      periodo: periodoDasEmendasDele,
    },
  ];
}
