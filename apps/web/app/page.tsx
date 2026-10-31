import Link from 'next/link';
import type { ReactNode } from 'react';

export default function PaginaInicial(): ReactNode {
  return (
    <main>
      <h1>Prometeu</h1>
      <p>Prometeu, cumpriu? Acompanhe cada promessa até a entrega, com fonte em cada etapa.</p>
      <form method="get" action="/busca" role="search">
        <label htmlFor="q">Procure um parlamentar, um município ou uma obra</label>{' '}
        <input id="q" name="q" type="search" minLength={2} required />{' '}
        <button type="submit">Buscar</button>
      </form>
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
        <li>
          <Link href="/obras">Obras pagas com emendas</Link>
        </li>
        <li>
          <Link href="/fontes">Situação das fontes</Link>
        </li>
      </ul>
    </main>
  );
}
