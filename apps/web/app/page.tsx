import Link from 'next/link';
import type { ReactNode } from 'react';

export default function PaginaInicial(): ReactNode {
  return (
    <main>
      <h1>Prometeu</h1>
      <p>Prometeu, cumpriu? Acompanhe cada promessa até a entrega, com fonte em cada etapa.</p>
      <p>
        <Link href="/parlamentares">Ver os parlamentares</Link>
      </p>
    </main>
  );
}
