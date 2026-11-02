import '@prometeu/ui/estilos.css';

import { Cabecalho, Movimento } from '@prometeu/ui';
import type { Metadata } from 'next';
import { Inter, Source_Serif_4 } from 'next/font/google';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Navegacao } from './_componentes/navegacao';
import { Tour } from './_componentes/tour';

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
  title: 'Prometeu',
  description:
    'Acompanhe o que foi prometido, o que virou lei, o que tem orçamento, o que foi pago e o que foi entregue.',
};

export default function LayoutRaiz({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="pt-BR" className={`${fonteTitulo.variable} ${fonteTexto.variable}`}>
      <body>
        <a href="#conteudo" className="oculto">
          Ir para o conteúdo
        </a>
        <Cabecalho
          marca={
            <Link href="/" className="marca">
              Prometeu
            </Link>
          }
          navegacao={<Navegacao />}
          acoes={
            <Link href="/busca" className="botao" data-tour="busca">
              Buscar político ou cidade
            </Link>
          }
        />
        <div id="conteudo">{children}</div>
        <Tour />
        <Movimento />
        <footer className="rodape">
          <div className="rodape__miolo">
            <p className="rodape__marca" aria-hidden="true">
              Prometeu
            </p>
            <div className="rodape__colunas">
              <ul>
                <li>
                  <Link href="/municipios">Meu governo</Link>
                </li>
                <li>
                  <Link href="/parlamentares">Parlamentares</Link>
                </li>
                <li>
                  <Link href="/votacoes">Votações nominais</Link>
                </li>
                <li>
                  <Link href="/proposicoes">Proposições</Link>
                </li>
              </ul>
              <ul>
                <li>
                  <Link href="/emendas">Emendas parlamentares</Link>
                </li>
                <li>
                  <Link href="/obras">Obras com dinheiro de emenda</Link>
                </li>
                <li>
                  <Link href="/fontes">Situação das fontes</Link>
                </li>
                <li>
                  <Link href="/conta">Minha conta</Link>
                </li>
              </ul>
              <p className="nota rodape__texto">
                Cada número aqui vem de um registro oficial capturado e guardado; nenhum veredito
                sai sem a revisão de uma segunda pessoa.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
