import type { OpcaoDeVoto, VotacaoNominalResumo } from '@prometeu/contracts';
import type { ReactNode } from 'react';

import { nomeDaOpcao } from './formatacao';

const ORDEM: readonly OpcaoDeVoto[] = [
  'sim',
  'nao',
  'abstencao',
  'obstrucao',
  'presidente_da_sessao',
  'secreto',
];

/** Votos registrados por opção; opção sem voto não aparece. */
export function Placar({ votacao }: { votacao: VotacaoNominalResumo }): ReactNode {
  const opcoes = ORDEM.filter((o) => votacao.placar[o] > 0);
  return (
    <dl className="resumo">
      {opcoes.map((opcao) => (
        <Linha key={opcao} nome={nomeDaOpcao(opcao)} votos={votacao.placar[opcao]} />
      ))}
    </dl>
  );
}

function Linha({ nome, votos }: { nome: string; votos: number }): ReactNode {
  return (
    <>
      <dt>{nome}</dt>
      <dd>{votos}</dd>
    </>
  );
}
