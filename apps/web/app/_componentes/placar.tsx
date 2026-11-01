import type { OpcaoDeVoto, VotacaoNominalResumo } from '@prometeu/contracts';
import type { Parte, Tom } from '@prometeu/ui';

const ORDEM: readonly OpcaoDeVoto[] = [
  'sim',
  'nao',
  'abstencao',
  'obstrucao',
  'presidente_da_sessao',
  'secreto',
];

/** Como cada opção se lê na legenda do placar. */
export const ROTULO_DA_OPCAO: Readonly<Record<OpcaoDeVoto, string>> = {
  sim: 'sim',
  nao: 'não',
  abstencao: 'abstenção',
  obstrucao: 'obstrução',
  presidente_da_sessao: 'presidindo',
  secreto: 'secreto',
};

/** Sim e não se distinguem pela claridade, nunca por verde e vermelho (ADR-0017). */
export const TOM_DA_OPCAO: Readonly<Record<OpcaoDeVoto, Tom>> = {
  sim: 'forte',
  nao: 'medio',
  abstencao: 'fraco',
  obstrucao: 'fraco',
  presidente_da_sessao: 'fraco',
  secreto: 'fraco',
};

/** As partes do placar, na ordem de sempre; opção sem voto fica de fora. */
export function partesDoPlacar(votacao: Pick<VotacaoNominalResumo, 'placar'>): Parte[] {
  return ORDEM.filter((o) => votacao.placar[o] > 0).map((o) => ({
    rotulo: ROTULO_DA_OPCAO[o],
    valor: votacao.placar[o],
    tom: TOM_DA_OPCAO[o],
  }));
}

/** `78 sim, 2 não`: o placar numa frase. */
export function placarEmFrase(votacao: Pick<VotacaoNominalResumo, 'placar'>): string {
  return partesDoPlacar(votacao)
    .map((p) => `${String(p.valor)} ${p.rotulo}`)
    .join(', ');
}
