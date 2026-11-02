import type { ExecucaoDaEmenda, FavorecidoDaEmenda } from '@prometeu/contracts';
import { type ItemDoRanking, type NumeroChave, textoDaContagem } from '@prometeu/ui';

import {
  dataCurta,
  pagoAteAgora,
  periodoEmMeses,
  reais,
  reaisResumidos,
} from '../../_componentes/formatacao';

const SEM_DADO = '—';

/** O período dos números de uma emenda: do orçamento do ano até a coleta, quando a data se sabe. */
export function periodoDaEmenda(ano: number, coletadaEm: string | null): string {
  const orcamento = `orçamento de ${String(ano)}`;
  return coletadaEm === null ? orcamento : `${orcamento}, até a coleta de ${dataCurta(coletadaEm)}`;
}

/**
 * Os três números do topo: o que já foi pago, o que foi empenhado e a parte paga. Sem valor
 * empenhado, ficam em "—" e sem contagem; o rótulo e o período ficam.
 */
export function numerosDaEmenda(dados: {
  ano: number;
  execucao: ExecucaoDaEmenda;
  coletadaEm: string | null;
}): NumeroChave[] {
  const empenhado = BigInt(dados.execucao.empenhadoCentavos);
  const pago = pagoAteAgora(dados.execucao);
  const periodo = periodoDaEmenda(dados.ano, dados.coletadaEm);
  const comValor = empenhado > 0n;
  // Centésimos de ponto: 5000 é 50,00%. A conta é em inteiro, como o `percentual` do site.
  const contagem = comValor
    ? { alvo: Number((pago * 10000n) / empenhado) / 100, casas: 2, sufixo: '%' }
    : null;
  return [
    {
      valor: comValor ? reaisResumidos(pago) : SEM_DADO,
      rotulo: 'já pago a quem recebe',
      periodo,
    },
    {
      valor: comValor ? reaisResumidos(empenhado) : SEM_DADO,
      rotulo: 'empenhado (reservado no orçamento)',
      periodo,
    },
    {
      ...(contagem ? { valor: textoDaContagem(contagem, 1), contagem } : { valor: SEM_DADO }),
      rotulo: 'do valor reservado já foi pago',
      periodo,
    },
  ];
}

/** As fases da despesa, na ordem em que o dinheiro anda, cada uma contra o empenhado. */
export function fasesDaEmenda(execucao: ExecucaoDaEmenda): ItemDoRanking[] {
  const fase = (chave: string, rotulo: string, centavos: string | bigint, detalhe?: string) => ({
    chave,
    rotulo,
    ...(detalhe === undefined ? {} : { detalhe }),
    valor: Number(BigInt(centavos) / 100n),
    texto: reais(centavos),
  });
  return [
    fase(
      'empenhado',
      'Reservado no orçamento (empenhado)',
      execucao.empenhadoCentavos,
      'O dinheiro separado para esta despesa',
    ),
    fase(
      'liquidado',
      'Entrega conferida (liquidado)',
      execucao.liquidadoCentavos,
      'O governo verificou que o serviço ou a obra foi entregue',
    ),
    fase('pago', 'Pago no ano do orçamento', execucao.pagoCentavos),
    fase(
      'restos',
      'Passou para pagar nos anos seguintes',
      execucao.restosInscritosCentavos,
      'Reservado e não pago no ano do orçamento',
    ),
    fase('cancelados', 'Cancelado antes de ser pago', execucao.restosCanceladosCentavos),
    fase('restos-pagos', 'Pago nos anos seguintes', execucao.restosPagosCentavos),
    fase('total', 'Pago até agora', pagoAteAgora(execucao), 'No ano do orçamento e depois'),
  ];
}

/** Do primeiro ao último mês em que algum favorecido recebeu. */
export function periodoDosFavorecidos(
  favorecidos: readonly Pick<FavorecidoDaEmenda, 'primeiroMes' | 'ultimoMes'>[],
): string {
  const primeiro = favorecidos.map((f) => f.primeiroMes).sort()[0];
  const ultimo = favorecidos
    .map((f) => f.ultimoMes)
    .sort()
    .at(-1);
  if (primeiro === undefined || ultimo === undefined) return 'nenhum pagamento registrado';
  return periodoEmMeses(primeiro, ultimo);
}
