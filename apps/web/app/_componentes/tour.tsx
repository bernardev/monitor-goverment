'use client';

import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import {
  CHAVE_DO_TOUR,
  COOKIE_DE_BOAS_VINDAS,
  type Caixa,
  deveAbrir,
  posicaoDoCartao,
} from './tour-regras';

/** Cada passo destaca um item marcado com `data-tour` no cabeçalho; sem alvo, o cartão fica no meio. */
const PASSOS: readonly { alvo?: string; titulo: string; texto: string }[] = [
  {
    titulo: 'Boas-vindas ao Prometeu',
    texto:
      'Aqui você confere o que cada político fez depois de eleito, com documento oficial. Em um minuto, veja o que dá para fazer.',
  },
  {
    alvo: 'meu-governo',
    titulo: 'Comece pela sua cidade',
    texto:
      'Em Meu governo, procure sua cidade: quanto dinheiro de emenda chegou, em que obras virou e quem representa você no Congresso.',
  },
  {
    alvo: 'parlamentares',
    titulo: 'Cada político tem uma página',
    texto:
      'Se foi às sessões e o motivo de cada falta, como votou, o que propôs e para onde mandou dinheiro do orçamento.',
  },
  {
    alvo: 'votacoes',
    titulo: 'Votações, nome a nome',
    texto: 'As votações da Câmara e do Senado, com o resultado e o voto de cada parlamentar.',
  },
  {
    alvo: 'emendas',
    titulo: 'Para onde foi o dinheiro',
    texto:
      'Emenda é o dinheiro do orçamento federal que deputados e senadores mandam para estados e cidades. Veja quanto foi pago e quem recebeu.',
  },
  {
    alvo: 'obras',
    titulo: 'A obra ficou pronta?',
    texto: 'Obras pagas com emendas: quanto já foi feito e, se pararam, o motivo informado.',
  },
  {
    alvo: 'busca',
    titulo: 'Procure pelo nome',
    texto: 'Um político, uma cidade ou uma obra. Acento e maiúsculas não importam.',
  },
  {
    alvo: 'conta',
    titulo: 'Acompanhe quem quiser',
    texto:
      'Na página de um político ou de uma cidade, clique em Acompanhar. Tudo o que você acompanha fica reunido em Minha conta.',
  },
  {
    titulo: 'Tudo com fonte',
    texto:
      'Cada número diz de onde saiu e quando foi coletado. O Prometeu não tem partido nem dá nota: mostra o registro.',
  },
];

const EVENTO = 'prometeu:tour';
const FOLGA = 6;

/**
 * O tour de boas-vindas: abre sozinho uma vez, logo depois do primeiro login neste navegador, e de
 * novo quando a pessoa pede em Minha conta. Sem script, simplesmente não aparece.
 */
export function Tour(): ReactNode {
  const [passo, setPasso] = useState<number | null>(null);
  const [alvo, setAlvo] = useState<Caixa | null>(null);
  const [posicao, setPosicao] = useState({ top: 0, left: 0 });
  const cartao = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let visto: string | null = null;
    try {
      visto = localStorage.getItem(CHAVE_DO_TOUR);
    } catch {
      // Armazenamento bloqueado: o tour abre, só não lembra que já foi visto.
    }
    if (deveAbrir(document.cookie, visto)) setPasso(0);
    document.cookie = `${COOKIE_DE_BOAS_VINDAS}=; Max-Age=0; Path=/`;
    const abrir = () => {
      setPasso(0);
    };
    window.addEventListener(EVENTO, abrir);
    return () => {
      window.removeEventListener(EVENTO, abrir);
    };
  }, []);

  useLayoutEffect(() => {
    if (passo === null) return;
    const medir = () => {
      const marca = PASSOS[passo]?.alvo;
      const caixa = marca
        ? document.querySelector(`[data-tour="${marca}"]`)?.getBoundingClientRect()
        : undefined;
      const visivel = caixa && caixa.width > 0 && caixa.height > 0 ? caixa : null;
      setAlvo(visivel);
      setPosicao(
        posicaoDoCartao(
          visivel,
          { width: cartao.current?.offsetWidth ?? 0, height: cartao.current?.offsetHeight ?? 0 },
          { width: window.innerWidth, height: window.innerHeight },
        ),
      );
    };
    medir();
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, { passive: true });
    return () => {
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir);
    };
  }, [passo]);

  useEffect(() => {
    if (passo !== null) cartao.current?.querySelector<HTMLElement>('[data-principal]')?.focus();
  }, [passo]);

  if (passo === null) return null;
  const atual = PASSOS[passo];
  if (!atual) return null;
  const ultimo = passo === PASSOS.length - 1;

  const fechar = () => {
    setPasso(null);
    try {
      localStorage.setItem(CHAVE_DO_TOUR, 'sim');
    } catch {
      // Sem armazenamento, o tour volta a abrir só se houver um novo login.
    }
  };

  // Esc fecha; Tab circula só entre os botões do cartão enquanto o tour está aberto.
  const teclado = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.key === 'Escape') fechar();
    if (evento.key !== 'Tab') return;
    const botoes = [...(cartao.current?.querySelectorAll<HTMLElement>('button') ?? [])];
    const [primeiro, ultimoBotao] = [botoes[0], botoes.at(-1)];
    if (evento.shiftKey && document.activeElement === primeiro) {
      evento.preventDefault();
      ultimoBotao?.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimoBotao) {
      evento.preventDefault();
      primeiro?.focus();
    }
  };

  const foco = alvo && {
    top: alvo.top - FOLGA,
    left: alvo.left - FOLGA,
    width: alvo.width + 2 * FOLGA,
    height: alvo.height + 2 * FOLGA,
  };

  return (
    <div className="tour">
      {foco ? (
        <>
          {/* O véu em quatro faixas em volta do item, deixando-o aceso. */}
          <div className="tour__veu" style={{ top: 0, left: 0, right: 0, height: foco.top }} />
          <div
            className="tour__veu"
            style={{ top: foco.top + foco.height, left: 0, right: 0, bottom: 0 }}
          />
          <div
            className="tour__veu"
            style={{ top: foco.top, left: 0, width: foco.left, height: foco.height }}
          />
          <div
            className="tour__veu"
            style={{ top: foco.top, left: foco.left + foco.width, right: 0, height: foco.height }}
          />
          <div className="tour__foco" style={foco} />
        </>
      ) : (
        <div className="tour__veu" style={{ inset: 0 }} />
      )}
      <div
        ref={cartao}
        className="tour__cartao"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-titulo"
        aria-describedby="tour-texto"
        style={posicao}
        onKeyDown={teclado}
      >
        <p className="tour__passo">
          {passo + 1} de {PASSOS.length}
        </p>
        <h2 id="tour-titulo">{atual.titulo}</h2>
        <p id="tour-texto">{atual.texto}</p>
        {/* No telefone a navegação sai do cabeçalho e fica no rodapé. */}
        {atual.alvo && !alvo && (
          <p className="tour__passo">No telefone, este atalho fica no rodapé da página.</p>
        )}
        <div className="tour__acoes">
          {!ultimo && (
            <button type="button" className="botao--texto" onClick={fechar}>
              Pular
            </button>
          )}
          {passo > 0 && (
            <button
              type="button"
              className="botao botao--secundario"
              onClick={() => {
                setPasso(passo - 1);
              }}
            >
              Voltar
            </button>
          )}
          <button
            type="button"
            className="botao"
            data-principal
            onClick={() => {
              if (ultimo) fechar();
              else setPasso(passo + 1);
            }}
          >
            {ultimo ? 'Começar' : 'Próximo'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Em Minha conta: abre o tour de novo. */
export function Rever(): ReactNode {
  return (
    <button
      type="button"
      className="botao botao--secundario"
      onClick={() => {
        window.dispatchEvent(new Event(EVENTO));
      }}
    >
      Ver o tour de novo
    </button>
  );
}
