import '@prometeu/ui/estilos.css';

import { Cabecalho } from '@prometeu/ui';
import type { Metadata } from 'next';
import { Schibsted_Grotesk } from 'next/font/google';
import Link from 'next/link';
import type { ReactNode } from 'react';

// A única família do site (ADR-0017), servida pelo próprio site: nada é pedido ao Google no navegador.
const fonte = Schibsted_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--fonte-prometeu',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Prometeu',
  description:
    'Acompanhe o que foi prometido, o que virou lei, o que tem orçamento, o que foi pago e o que foi entregue.',
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
            Prometeu
          </Link>
          <nav aria-label="Principal" className="navegacao">
            <Link href="/municipios">Meu governo</Link>
            <Link href="/parlamentares">Parlamentares</Link>
            <Link href="/votacoes">Votações</Link>
            <Link href="/emendas">Emendas</Link>
            <Link href="/obras">Obras</Link>
            <Link href="/conta">Minha conta</Link>
          </nav>
          <Link href="/busca" className="botao">
            Buscar político ou cidade
          </Link>
        </Cabecalho>
        <div id="conteudo">{children}</div>
        <footer className="rodape" data-campo="grafite">
          <div className="rodape__miolo">
            <p className="rodape__marca" aria-hidden="true">
              Prometeu.
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
                  <Link href="/obras">Obras pagas com emendas</Link>
                </li>
                <li>
                  <Link href="/fontes">Situação das fontes</Link>
                </li>
              </ul>
              <p className="nota rodape__texto">
                O nome é o verbo. Cada número aqui vem de um registro oficial capturado e guardado;
                nenhum veredito sai sem a revisão de uma segunda pessoa.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
