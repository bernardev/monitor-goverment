import Link from 'next/link';
import type { ReactNode } from 'react';

export default function PaginaInicial(): ReactNode {
  return (
    <main>
      <h1>Prometeu</h1>
      <p>Prometeu, cumpriu? Acompanhe cada promessa até a entrega, com fonte em cada etapa.</p>
      <ul>
        <li>
          <Link href="/parlamentares">Parlamentares</Link>
        </li>
        <li>
          <Link href="/votacoes">Votações nominais</Link>
        </li>
        <li>
          <Link href="/proposicoes">Proposições</Link>
        </li>
        <li>
          <Link href="/emendas">Emendas parlamentares</Link>
        </li>
      </ul>
    </main>
  );
}
