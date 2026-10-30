// Conjuntos fechados da linguagem ubíqua (docs/dominio/linguagem-ubiqua.md). Os arrays existem em
// tempo de execução para que a camada de aplicação valide a entrada contra a mesma lista.

export const TIPOS_DE_FONTE = [
  'plano_de_governo',
  'debate',
  'entrevista',
  'sabatina',
  'discurso',
  'publicacao_oficial',
] as const;
export type TipoDeFonte = (typeof TIPOS_DE_FONTE)[number];

/** Promessa `generica` é registrada assim mesmo: a falta de compromisso verificável é informação. */
export const MENSURABILIDADES = ['mensuravel', 'parcialmente_mensuravel', 'generica'] as const;
export type Mensurabilidade = (typeof MENSURABILIDADES)[number];

/** `fora_da_competencia` não impede o acompanhamento; vira contexto educativo (invariante 7). */
export const COMPETENCIAS = ['propria', 'compartilhada', 'fora_da_competencia'] as const;
export type Competencia = (typeof COMPETENCIAS)[number];
