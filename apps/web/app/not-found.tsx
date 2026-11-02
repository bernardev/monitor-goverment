import { Chapeu } from '@prometeu/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: 'Página não encontrada | Prometeu' };

/** Endereço que não existe ou registro que saiu da base: diz isso e oferece a busca. */
export default function NaoEncontrado(): ReactNode {
  return (
    <main className="reportagem editoria">
      <header className="editoria__topo">
        <Chapeu>Erro 404</Chapeu>
        <h1>Não achamos esta página</h1>
        <p className="editoria__descricao">
          O endereço pode estar errado, ou o registro saiu da fonte oficial depois que o link foi
          criado. Procure pelo nome de um parlamentar, de uma cidade ou de uma obra:
        </p>
        <form method="get" action="/busca" role="search" className="busca">
          <label htmlFor="q" className="oculto">
            Parlamentar, cidade ou obra
          </label>
          <input
            id="q"
            name="q"
            type="search"
            minLength={2}
            required
            placeholder="Um político, uma cidade, uma obra"
          />
          <button type="submit" className="botao">
            Buscar
          </button>
        </form>
        <p>
          <Link href="/">Voltar ao início</Link>
        </p>
      </header>
    </main>
  );
}
