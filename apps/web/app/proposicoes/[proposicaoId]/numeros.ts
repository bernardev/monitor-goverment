import type { NumeroChave } from '@prometeu/ui';

import { comContagem, data, dia, SEM_DADO } from '../../_componentes/formatacao';

/** `de 3 de março de 2026 a 5 de junho de 2026`, do mais antigo ao mais recente; um dia só vira `em`. */
function intervalo(valores: readonly string[], formatar: (v: string) => string): string | null {
  const ordenados = [...valores].sort();
  const primeiro = ordenados[0];
  const ultimo = ordenados[ordenados.length - 1];
  if (primeiro === undefined || ultimo === undefined) return null;
  const [de, ate] = [formatar(primeiro), formatar(ultimo)];
  return de === ate ? `em ${de}` : `de ${de} a ${ate}`;
}

/** O período dos atos de tramitação coletados. */
export function periodoDosAtos(tramitacoes: readonly { em: string }[]): string {
  return (
    intervalo(
      tramitacoes.map((t) => t.em),
      data,
    ) ?? 'nenhum ato coletado'
  );
}

/** O período das votações nominais coletadas. */
export function periodoDasVotacoes(votacoes: readonly { dia: string }[]): string {
  return (
    intervalo(
      votacoes.map((v) => v.dia),
      dia,
    ) ?? 'nenhuma votação nominal coletada'
  );
}

/** Os números do topo: quantos atos de tramitação e quantas votações nominais foram coletados. */
export function numerosDaProposicao(dados: {
  tramitacoes: readonly { em: string }[];
  votacoes: readonly { dia: string }[];
}): NumeroChave[] {
  const { tramitacoes, votacoes } = dados;
  return [
    {
      ...(tramitacoes.length > 0 ? comContagem(tramitacoes.length) : { valor: SEM_DADO }),
      rotulo:
        tramitacoes.length === 1 ? 'ato de tramitação coletado' : 'atos de tramitação coletados',
      periodo: periodoDosAtos(tramitacoes),
    },
    {
      ...(votacoes.length > 0 ? comContagem(votacoes.length) : { valor: SEM_DADO }),
      rotulo: votacoes.length === 1 ? 'votação nominal coletada' : 'votações nominais coletadas',
      periodo: periodoDasVotacoes(votacoes),
    },
  ];
}
