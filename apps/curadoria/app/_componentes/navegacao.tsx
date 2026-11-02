'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** A navegação do painel; o link da seção atual leva `aria-current`, que o CSS sublinha. */
export function Navegacao(): ReactNode {
  const caminho = usePathname();
  const registrando = caminho === '/promessas/nova';
  const atual = (ativo: boolean) => (ativo ? { 'aria-current': 'page' as const } : {});
  return (
    <nav aria-label="Painel" className="navegacao">
      <Link
        href="/"
        {...atual(!registrando && (caminho === '/' || caminho.startsWith('/promessas/')))}
      >
        Promessas
      </Link>
      <Link href="/promessas/nova" {...atual(registrando)}>
        Registrar promessa
      </Link>
    </nav>
  );
}
