import { COM_ACENTO, SEM_ACENTO } from './esquema.js';

const ACENTUADAS = new RegExp(`[${COM_ACENTO}]`, 'g');

/** Palavras que aparecem em quase toda promessa e todo fato, e não dizem do que se trata. */
const VAZIAS = new Set([
  'para', 'pelo', 'pela', 'pelos', 'pelas', 'como', 'sobre', 'entre', 'mais', 'menos', 'todo',
  'toda', 'todos', 'todas', 'cada', 'seus', 'suas', 'esse', 'essa', 'esses', 'essas', 'este',
  'esta', 'estes', 'estas', 'isso', 'isto', 'aquele', 'aquela', 'quando', 'onde', 'qual', 'quais',
  'nossa', 'nosso', 'nossos', 'nossas', 'sera', 'serao', 'fazer', 'garantir', 'ampliar', 'criar',
  'governo', 'federal', 'nacional', 'brasil', 'pais', 'outros', 'outras', 'demais', 'ainda', 'tambem',
  'desde', 'ate', 'apos', 'ante', 'contra', 'sem', 'com', 'dos', 'das', 'nos', 'nas', 'uma', 'umas',
  'altera', 'dispoe', 'institui', 'providencias', 'lei', 'artigo', 'diversas',
]); // prettier-ignore

/**
 * Palavras com o mesmo começo são a mesma ideia: `construcao`, `construir`. O plural sai antes, para
 * as curtas: `obras` e `obra`.
 */
const RAIZ = 6;

export interface Termo {
  readonly raiz: string;
  readonly palavra: string;
}

/** As palavras que dizem do que o texto trata, sem acento, em minúsculas e pela raiz. */
export function termos(texto: string): Termo[] {
  const vistos = new Map<string, Termo>();
  const normalizado = texto.replace(ACENTUADAS, (l) => SEM_ACENTO.charAt(COM_ACENTO.indexOf(l)));
  for (const palavra of normalizado.toLowerCase().split(/[^a-z0-9]+/)) {
    if (palavra.length < 4 || VAZIAS.has(palavra) || /^\d+$/.test(palavra)) continue;
    const raiz = (
      palavra.length > 4 && palavra.endsWith('s') ? palavra.slice(0, -1) : palavra
    ).slice(0, RAIZ);
    if (!vistos.has(raiz)) vistos.set(raiz, { raiz, palavra });
  }
  return [...vistos.values()];
}

/**
 * A parte das palavras da promessa que aparece no fato, de 0 a 1, e quais são. Simples de propósito:
 * a curadoria vê por que um fato apareceu no topo, e nada é decidido por esta conta.
 */
export function relevancia(
  daPromessa: readonly Termo[],
  doFato: readonly Termo[],
): { relevancia: number; termosEmComum: string[] } {
  if (daPromessa.length === 0) return { relevancia: 0, termosEmComum: [] };
  const raizes = new Set(doFato.map((t) => t.raiz));
  const comuns = daPromessa.filter((t) => raizes.has(t.raiz)).map((t) => t.palavra);
  return {
    relevancia: Math.round((comuns.length / daPromessa.length) * 100) / 100,
    termosEmComum: comuns,
  };
}
