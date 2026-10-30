// Rótulos da linguagem ubíqua (docs/dominio/linguagem-ubiqua.md) para a interface da curadoria.

export const VEREDITOS: Readonly<Record<string, string>> = {
  nao_iniciada: 'Não iniciada',
  em_andamento: 'Em andamento',
  travada: 'Travada',
  cumprida: 'Cumprida',
  cumprida_parcialmente: 'Cumprida parcialmente',
  nao_cumprida: 'Não cumprida',
};

export const ESTAGIOS: Readonly<Record<string, string>> = {
  prometida: 'Prometida',
  ato: 'Ato',
  orcamento: 'Orçamento',
  execucao: 'Execução',
  entrega: 'Entrega',
};

export const TIPOS_DE_FONTE: Readonly<Record<string, string>> = {
  plano_de_governo: 'Plano de governo (TSE)',
  debate: 'Debate',
  entrevista: 'Entrevista',
  sabatina: 'Sabatina',
  discurso: 'Discurso',
  publicacao_oficial: 'Publicação oficial',
};

export const MENSURABILIDADES: Readonly<Record<string, string>> = {
  mensuravel: 'Mensurável',
  parcialmente_mensuravel: 'Parcialmente mensurável',
  generica: 'Genérica',
};

export const COMPETENCIAS: Readonly<Record<string, string>> = {
  propria: 'Própria do cargo',
  compartilhada: 'Compartilhada',
  fora_da_competencia: 'Fora da competência',
};

export const rotulo = (tabela: Readonly<Record<string, string>>, valor: string): string =>
  tabela[valor] ?? valor;

export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
] as const; // prettier-ignore
