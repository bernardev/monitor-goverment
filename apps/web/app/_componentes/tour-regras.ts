/**
 * As regras do tour de boas-vindas, sem React: quando abrir e onde pôr o cartão. O login concluído
 * deixa um cookie curto; o navegador abre o tour uma vez e guarda que já viu.
 */
export const COOKIE_DE_BOAS_VINDAS = 'prometeu_boas_vindas';
export const CHAVE_DO_TOUR = 'prometeu_tour_visto';

/** O login falho volta para `/?erro=login_...`; qualquer outro destino é login concluído. */
export function loginConcluido(destino: string | null): boolean {
  return destino !== null && !/[?&]erro=login_/.test(destino);
}

export function deveAbrir(cookies: string, visto: string | null): boolean {
  return (
    new RegExp(`(?:^|;\\s*)${COOKIE_DE_BOAS_VINDAS}=1(?:;|$)`).test(cookies) && visto !== 'sim'
  );
}

export interface Caixa {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

const DISTANCIA = 16;

/**
 * Onde fica o cartão: logo abaixo do item destacado, ou acima se não couber; sem item (ou com ele
 * escondido, como a navegação no telefone), no meio da tela. Sempre inteiro dentro da janela.
 */
export function posicaoDoCartao(
  alvo: Caixa | null,
  cartao: { readonly width: number; readonly height: number },
  janela: { readonly width: number; readonly height: number },
): { top: number; left: number } {
  const limite = (valor: number, maximo: number) => Math.max(DISTANCIA, Math.min(valor, maximo));
  const maxLeft = janela.width - cartao.width - DISTANCIA;
  const maxTop = janela.height - cartao.height - DISTANCIA;
  if (!alvo) {
    return {
      top: limite((janela.height - cartao.height) / 2, maxTop),
      left: limite((janela.width - cartao.width) / 2, maxLeft),
    };
  }
  const abaixo = alvo.top + alvo.height + DISTANCIA;
  const top =
    abaixo + cartao.height <= janela.height - DISTANCIA
      ? abaixo
      : alvo.top - DISTANCIA - cartao.height;
  return { top: limite(top, maxTop), left: limite(alvo.left, maxLeft) };
}
