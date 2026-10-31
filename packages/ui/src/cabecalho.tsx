'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

import type { Campo } from './capitulo';

/**
 * A barra do site. Fixa no topo, toma a cor do capítulo que passa por baixo dela, para a página se
 * ler como uma sequência de cartazes. Sem script, fica na cor do papel.
 */
export function Cabecalho({ children }: { children: ReactNode }): ReactNode {
  const barra = useRef<HTMLElement>(null);
  const [campo, setCampo] = useState<Campo>('papel');

  useEffect(() => {
    const capitulos = [...document.querySelectorAll<HTMLElement>('[data-campo]')].filter(
      (el) => el !== barra.current,
    );
    if (capitulos.length === 0 || !('IntersectionObserver' in window)) return;
    const altura = barra.current?.offsetHeight ?? 72;
    // Uma faixa de 1px logo abaixo da barra: o capítulo que a cruza é o que está por baixo dela.
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          const cor = (entrada.target as HTMLElement).dataset['campo'];
          if (entrada.isIntersecting && cor) setCampo(cor as Campo);
        }
      },
      { rootMargin: `-${String(altura)}px 0px -${String(window.innerHeight - altura - 1)}px 0px` },
    );
    for (const capitulo of capitulos) observador.observe(capitulo);
    return () => {
      observador.disconnect();
    };
  }, []);

  return (
    <header ref={barra} className="cabecalho" data-campo={campo}>
      <div className="cabecalho__miolo">{children}</div>
    </header>
  );
}
