import type { VotacaoNominalResumo } from '@prometeu/contracts';
import { type NumeroChave, textoDaContagem } from '@prometeu/ui';

import { dia } from '../../_componentes/formatacao';

/** O número com a contagem; o valor é o texto final dela, o mesmo que o servidor entrega sem JavaScript. */
function comContagem(alvo: number): Pick<NumeroChave, 'valor' | 'contagem'> {
  const contagem = { alvo };
  return { valor: textoDaContagem(contagem, 1), contagem };
}

/**
 * Os números do topo: votos sim, votos não e os outros. Na votação secreta a casa não diz como cada
 * um votou, então não há faixa.
 */
export function numerosDaVotacao(
  votacao: Pick<VotacaoNominalResumo, 'placar' | 'secreta' | 'dia'>,
): NumeroChave[] {
  if (votacao.secreta) return [];
  const { sim, nao, abstencao, obstrucao, presidente_da_sessao: presidia } = votacao.placar;
  const outros = abstencao + obstrucao + presidia;
  const periodo = `em ${dia(votacao.dia)}`;
  return [
    { ...comContagem(sim), rotulo: sim === 1 ? 'voto sim' : 'votos sim', periodo },
    { ...comContagem(nao), rotulo: nao === 1 ? 'voto não' : 'votos não', periodo },
    {
      ...comContagem(outros),
      rotulo: `${outros === 1 ? 'outro registro' : 'outros registros'} (abstenção, obstrução ou presidente da sessão)`,
      periodo,
    },
  ];
}
