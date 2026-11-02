import type {
  EmendasDoParlamentar,
  FonteDoDado,
  FrequenciaDoParlamentar,
} from '@prometeu/contracts';
import { type NumeroChave, textoDaContagem } from '@prometeu/ui';

import {
  pagoAteAgora,
  periodoDasEmendas,
  periodoEmMeses,
  reaisResumidos,
} from '../../_componentes/formatacao';

const NUMERO = new Intl.NumberFormat('pt-BR');
const SEM_DADO = '—';

/** O número com a contagem; o valor é o texto final dela, o mesmo que o servidor entrega sem JavaScript. */
function comContagem(alvo: number, sufixo = ''): Pick<NumeroChave, 'valor' | 'contagem'> {
  const contagem = { alvo, sufixo };
  return { valor: textoDaContagem(contagem, 1), contagem };
}

/** A fonte coletada por último entre os itens listados (emendas ou obras); `undefined` se não há item. */
export function fonteMaisRecente(
  emendas: { readonly itens: readonly { readonly fonte: FonteDoDado }[] } | undefined,
): FonteDoDado | undefined {
  return (emendas?.itens ?? [])
    .map((e) => e.fonte)
    .reduce<FonteDoDado | undefined>(
      (a, b) => (a === undefined || (b.coletadaEm ?? '') > (a.coletadaEm ?? '') ? b : a),
      undefined,
    );
}

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
        ? comContagem(resumo.presencas, ` de ${NUMERO.format(resumo.diasComSessao)}`)
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
        ? comContagem(Number((pago * 100n) / empenhado), '%')
        : { valor: SEM_DADO }),
      rotulo: 'do valor das emendas já pago',
      periodo: periodoDasEmendasDele,
    },
  ];
}
