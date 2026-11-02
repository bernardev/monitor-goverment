/** A seção da navegação a que o caminho pertence, por prefixo: `/parlamentares/123` é `/parlamentares`. */
export function secaoAtual(caminho: string, secoes: readonly string[]): string | undefined {
  return secoes.find((s) => caminho === s || caminho.startsWith(`${s}/`));
}
