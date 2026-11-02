'use client';

import { useEffect } from 'react';

import { type Contagem, textoDaContagem } from './medidas';

const DURACAO_DA_CONTAGEM = 900;

function contagemDe(el: HTMLElement): Contagem {
  return {
    alvo: Number(el.dataset['conta']),
    casas: Number(el.dataset['casas'] ?? 0),
    prefixo: el.dataset['prefixo'] ?? '',
    sufixo: el.dataset['sufixo'] ?? '',
  };
}

function contar(el: HTMLElement): void {
  const contagem = contagemDe(el);
  const inicio = performance.now();
  const passo = (agora: number): void => {
    const t = Math.min(1, (agora - inicio) / DURACAO_DA_CONTAGEM);
    el.textContent = textoDaContagem(contagem, 1 - (1 - t) ** 3);
    if (t < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}

/**
 * A entrada suave da página: marca `data-visivel` nos `[data-surge]` que entram na tela e conta os
 * `[data-conta]` de zero ao alvo, uma vez cada. O HTML do servidor já traz o texto final e o CSS só
 * esconde sob `html.movimento`, então sem JavaScript, ou com movimento reduzido, tudo aparece pronto.
 * Montado uma vez em cada layout; vale para as páginas que entram depois, na navegação.
 */
export function Movimento(): null {
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const raiz = document.documentElement;
    raiz.classList.add('movimento');

    const preparados = new WeakSet<Element>();
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const { target, isIntersecting } of entradas) {
          if (!isIntersecting) continue;
          observador.unobserve(target);
          const el = target as HTMLElement;
          if (el.dataset['surge'] !== undefined) el.dataset['visivel'] = '1';
          if (el.dataset['conta'] !== undefined) contar(el);
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );

    const varrer = (): void => {
      for (const el of document.querySelectorAll<HTMLElement>('[data-surge], [data-conta]')) {
        if (preparados.has(el)) continue;
        preparados.add(el);
        if (el.dataset['conta'] !== undefined) {
          el.textContent = textoDaContagem(contagemDe(el), 0);
        }
        observador.observe(el);
      }
    };
    varrer();
    // As páginas seguintes chegam por navegação do cliente, sem recarregar o layout.
    // Só nós de elemento: a própria contagem troca texto a cada quadro e não deve varrer a página.
    const mutacoes = new MutationObserver((registros) => {
      if (registros.some((r) => [...r.addedNodes].some((n) => n.nodeType === Node.ELEMENT_NODE))) {
        varrer();
      }
    });
    mutacoes.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutacoes.disconnect();
      observador.disconnect();
      raiz.classList.remove('movimento');
    };
  }, []);

  return null;
}
