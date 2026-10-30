/**
 * Como o parlamentar votou, em categorias comparáveis entre casas. `presidente_da_sessao` é quem
 * presidia e não vota, salvo para desempatar (Câmara: art. 17 do Regimento Interno; Senado: art. 51
 * do RISF). `secreto` é o voto em votação secreta: a casa registra que o parlamentar votou, não como.
 */
export const OPCOES_DE_VOTO = [
  'sim',
  'nao',
  'abstencao',
  'obstrucao',
  'presidente_da_sessao',
  'secreto',
] as const;
export type OpcaoDeVoto = (typeof OPCOES_DE_VOTO)[number];

/** O que a casa decidiu. `nao_informado` quando a fonte não traz o resultado. */
export const RESULTADOS_DA_VOTACAO = ['aprovada', 'rejeitada', 'nao_informado'] as const;
export type ResultadoDaVotacao = (typeof RESULTADOS_DA_VOTACAO)[number];
