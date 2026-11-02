'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { secaoAtual } from './navegacao-regras';

const ITENS = [
  { href: '/municipios', rotulo: 'Meu governo', tour: 'meu-governo' },
  { href: '/parlamentares', rotulo: 'Parlamentares', tour: 'parlamentares' },
  { href: '/votacoes', rotulo: 'Votações', tour: 'votacoes' },
  { href: '/emendas', rotulo: 'Emendas', tour: 'emendas' },
  { href: '/obras', rotulo: 'Obras', tour: 'obras' },
  { href: '/conta', rotulo: 'Minha conta', tour: 'conta' },
] as const;

/** A navegação principal; o link da seção em que a pessoa está leva `aria-current`, que o CSS sublinha. */
export function Navegacao(): ReactNode {
  const atual = secaoAtual(
    usePathname(),
    ITENS.map((i) => i.href),
  );
  return (
    <nav aria-label="Principal" className="navegacao">
      {ITENS.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          data-tour={i.tour}
          {...(i.href === atual ? { 'aria-current': 'page' as const } : {})}
        >
          {i.rotulo}
        </Link>
      ))}
    </nav>
  );
}
