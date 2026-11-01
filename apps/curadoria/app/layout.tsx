import '@prometeu/ui/estilos.css';
import './globais.css';

import { Cabecalho } from '@prometeu/ui';
import type { Metadata } from 'next';
import { Schibsted_Grotesk } from 'next/font/google';
import Link from 'next/link';
import type { ReactNode } from 'react';

// A mesma família do site (ADR-0017); o painel é mais denso, mas é o mesmo sistema.
const fonte = Schibsted_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--fonte-prometeu',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Prometeu · Curadoria',
  robots: { index: false, follow: false },
};

export default function LayoutRaiz({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="pt-BR" className={fonte.variable}>
      <body data-campo="papel">
        <a href="#conteudo" className="oculto">
          Ir para o conteúdo
        </a>
        <Cabecalho>
          <Link href="/" className="marca">
            Prometeu <span className="marca__painel">curadoria</span>
          </Link>
          <nav aria-label="Painel" className="navegacao">
            <Link href="/">Promessas</Link>
            <Link href="/promessas/nova">Registrar promessa</Link>
          </nav>
          <form method="post" action="/sair">
            <button type="submit" className="botao">
              Sair
            </button>
          </form>
        </Cabecalho>
        <div id="conteudo">{children}</div>
      </body>
    </html>
  );
}
