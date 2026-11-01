/**
 * Para onde voltar depois do login: só um caminho deste mesmo app. `//outro.site` e `/\outro.site`
 * são lidos pelo navegador como outro endereço, e seriam um redirecionamento aberto.
 */
export function caminhoDeVolta(pedido: string | null | undefined): string {
  if (!pedido?.startsWith('/') || pedido.startsWith('//') || pedido.startsWith('/\\')) return '/';
  // Nada de esquema escondido em caracteres de controle ou espaço no começo.
  for (let i = 0; i < pedido.length; i++) if (pedido.charCodeAt(i) < 0x20) return '/';
  return /\s/.test(pedido) ? '/' : pedido;
}
