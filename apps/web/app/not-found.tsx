import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: 'Não encontrado | Prometeu' };

/** Endereço que não existe ou registro que saiu da base: diz isso e oferece a busca. */
export default function NaoEncontrado(): ReactNode {
  return (
    <main className="capitulos">
      <section className="aviso" data-campo="aco" aria-labelledby="aviso">
        <div className="aviso__miolo">
          <h1 id="aviso" className="verbo">
            Não achamos.
          </h1>
          <p className="destaque">
            Este endereço não existe, ou o registro saiu da fonte oficial depois que o link foi
            criado. Procure pelo nome:
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
        </div>
      </section>
    </main>
  );
}
