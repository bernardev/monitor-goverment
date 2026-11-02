import '@prometeu/ui/estilos.css';
import './globais.css';

import { Cabecalho } from '@prometeu/ui';
import type { Metadata } from 'next';
import { Inter, Source_Serif_4 } from 'next/font/google';
import Link from 'next/link';
import type { ReactNode } from 'react';

// Servidas pelo próprio site: nada é pedido ao Google no navegador. Serifa nos títulos, sans no texto.
const fonteTitulo = Source_Serif_4({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--fonte-titulo',
  display: 'swap',
});

const fonteTexto = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--fonte-texto',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Prometeu · Curadoria',
  robots: { index: false, follow: false },
};

export default function LayoutRaiz({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="pt-BR" className={`${fonteTitulo.variable} ${fonteTexto.variable}`}>
      <body>
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
