import type { OpcaoDeVoto, VotacaoNominalResumo } from '@prometeu/contracts';
import type { Parte, Tom } from '@prometeu/ui';

/** A ordem de sempre: sim, não e as demais. */
export const ORDEM_DAS_OPCOES: readonly OpcaoDeVoto[] = [
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

/** Sim e não se distinguem pela claridade e pelo rótulo escrito, nunca por verde e vermelho. */
export const TOM_DA_OPCAO: Readonly<Record<OpcaoDeVoto, Tom>> = {
  sim: 'forte',
  nao: 'medio',
  abstencao: 'fraco',
  obstrucao: 'fraco',
  presidente_da_sessao: 'fraco',
  secreto: 'fraco',
};

/** `3 abstenções`: a contagem escrita, no singular ou no plural. */
const TEXTO_DA_OPCAO: Readonly<Record<OpcaoDeVoto, (n: number) => string>> = {
  sim: (n) => `${String(n)} sim`,
  nao: (n) => `${String(n)} não`,
  abstencao: (n) => `${String(n)} ${n === 1 ? 'abstenção' : 'abstenções'}`,
  obstrucao: (n) => `${String(n)} ${n === 1 ? 'obstrução' : 'obstruções'}`,
  presidente_da_sessao: (n) => `${String(n)} presidindo a sessão`,
  secreto: (n) => `${String(n)} ${n === 1 ? 'voto secreto' : 'votos secretos'}`,
};

/** As partes do placar, na ordem de sempre; opção sem voto fica de fora. */
export function partesDoPlacar(votacao: Pick<VotacaoNominalResumo, 'placar'>): Parte[] {
  return ORDEM_DAS_OPCOES.filter((o) => votacao.placar[o] > 0).map((o) => ({
    rotulo: ROTULO_DA_OPCAO[o],
    valor: votacao.placar[o],
    tom: TOM_DA_OPCAO[o],
    texto: TEXTO_DA_OPCAO[o](votacao.placar[o]),
  }));
}

/** `78 sim, 2 não`: o placar numa frase. */
export function placarEmFrase(votacao: Pick<VotacaoNominalResumo, 'placar'>): string {
  return ORDEM_DAS_OPCOES.filter((o) => votacao.placar[o] > 0)
    .map((o) => TEXTO_DA_OPCAO[o](votacao.placar[o]))
    .join(', ');
}
