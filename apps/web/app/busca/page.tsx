import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { buscarMunicipios, listarObras, listarParlamentares } from '../_api/cliente';
import { nomeDoCargo } from '../_componentes/formatacao';
import { ItemDeObra } from '../_componentes/obras';

export const metadata: Metadata = { title: 'Busca | Prometeu' };

interface Props {
  readonly searchParams: Promise<{ q?: string }>;
}

/** Quantos resultados de cada tipo; o resto está nas listas com filtro. */
const POR_TIPO = 10;

export default async function PaginaDeBusca({ searchParams }: Props): Promise<ReactNode> {
  const termo = ((await searchParams).q ?? '').trim().slice(0, 80);
  const valido = termo.length >= 2;
  const [parlamentares, municipios, obras] = valido
    ? await Promise.all([
        listarParlamentares({ nome: termo, pagina: 1, itens: POR_TIPO }),
        buscarMunicipios(termo),
        listarObras({ nome: termo, pagina: 1, itens: POR_TIPO }),
      ])
    : [undefined, [], undefined];
  const nada =
    valido && parlamentares?.total === 0 && municipios.length === 0 && obras?.total === 0;

  return (
    <main>
      <h1>Busca</h1>
      <form method="get" action="/busca" role="search">
        <label htmlFor="q">Parlamentar, município ou obra</label>{' '}
        <input id="q" name="q" type="search" defaultValue={termo} minLength={2} required />{' '}
        <button type="submit">Buscar</button>
      </form>
      {!valido && <p>Escreva ao menos duas letras. Acento e maiúsculas não importam.</p>}
      {nada && <p>Nada encontrado para “{termo}”.</p>}

      {parlamentares && parlamentares.total > 0 && (
        <section>
          <h2>Parlamentares</h2>
          <ul className="lista">
            {parlamentares.itens.map((p) => (
              <li key={p.pessoaId}>
                <Link href={`/parlamentares/${p.pessoaId}`}>{p.nome}</Link>{' '}
                <span>
                  {p.siglaPartido ?? 'sem partido'}
                  {p.uf ? `-${p.uf}` : ''} · {nomeDoCargo(p.cargo)}
                </span>
              </li>
            ))}
          </ul>
          {parlamentares.total > POR_TIPO && (
            <p className="fonte">E mais {parlamentares.total - POR_TIPO}: refine a busca.</p>
          )}
        </section>
      )}

      {municipios.length > 0 && (
        <section>
          <h2>Municípios</h2>
          <ul className="lista">
            {municipios.map((m) => (
              <li key={m.codigoIbge}>
                <Link href={`/municipios/${m.codigoIbge}`}>
                  {m.nome} - {m.uf}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {obras && obras.total > 0 && (
        <section>
          <h2>Obras</h2>
          <ul className="lista">
            {obras.itens.map((o) => (
              <ItemDeObra key={o.obraId} obra={o} />
            ))}
          </ul>
          {obras.total > POR_TIPO && (
            <p className="fonte">E mais {obras.total - POR_TIPO}: refine a busca.</p>
          )}
        </section>
      )}
    </main>
  );
}
