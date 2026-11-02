import type { VotacaoNominalResumo } from '@prometeu/contracts';
import type { NumeroChave } from '@prometeu/ui';

import { comContagem, dia, plural } from '../../_componentes/formatacao';

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

/**
 * A frase da seção "Como votou cada um": quantos nomes a lista da casa traz. É a lista, não o placar
 * (o placar vem da própria casa e pode diferir). Votação secreta sem nomes diz que o voto foi secreto.
 */
export function textoDosVotos(votos: { secreta: boolean; nomes: number }): string {
  const { secreta, nomes } = votos;
  if (nomes === 0) {
    return secreta
      ? 'Votação secreta: a casa não informa o voto de cada um.'
      : 'A lista de votos da casa não traz nenhum nome.';
  }
  return secreta
    ? `${plural(nomes, 'parlamentar', 'parlamentares')} na lista de quem votou; o voto de cada um é secreto.`
    : `${plural(nomes, 'nome', 'nomes')} na lista de votos da casa, com o partido do dia da votação.`;
}
