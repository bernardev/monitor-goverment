/**
 * Algumas fontes só dizem quem é a pessoa pelo nome (o Portal da Transparência nomeia o autor da
 * emenda como `ACACIO FAVACHO`). Este contexto é o único que decide quem é quem: o nome identifica a
 * pessoa só se, comparado sem acento, caixa e pontuação, bate com exatamente um dos candidatos.
 * Homônimos não são identificados; melhor sem ligação do que ligado à pessoa errada.
 */
export function pessoaPeloNome(
  nome: string,
  candidatos: readonly { readonly pessoaId: string; readonly nome: string }[],
): string | undefined {
  const procurado = comparavel(nome);
  if (procurado.length === 0) return undefined;
  const achados = new Set(
    candidatos.filter((c) => comparavel(c.nome) === procurado).map((c) => c.pessoaId),
  );
  return achados.size === 1 ? [...achados][0] : undefined;
}

function comparavel(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}
