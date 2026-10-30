import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { listarParlamentares } from '../_api/cliente';
import { nomeDoCargo, UFS } from '../_componentes/formatacao';

export const metadata: Metadata = {
  title: 'Parlamentares | Prometeu',
  description:
    'Deputados federais e senadores em exercício, com partido, estado e a fonte oficial de cada dado.',
};

interface Props {
  readonly searchParams: Promise<{ uf?: string; pagina?: string }>;
}

export default async function PaginaDeParlamentares({ searchParams }: Props): Promise<ReactNode> {
  const busca = await searchParams;
  const uf = UFS.find((sigla) => sigla === busca.uf?.toUpperCase());
  const pagina = Math.max(1, Number.parseInt(busca.pagina ?? '1', 10) || 1);
  const resultado = await listarParlamentares({ uf, pagina });
  const ultimaPagina = Math.max(1, Math.ceil(resultado.total / resultado.itensPorPagina));
  const endereco = (outra: number) =>
    `/parlamentares?${new URLSearchParams({ ...(uf ? { uf } : {}), pagina: String(outra) }).toString()}`;

  return (
    <main>
      <h1>Parlamentares</h1>
      <form method="get" action="/parlamentares">
        <label htmlFor="uf">Estado</label>{' '}
        <select id="uf" name="uf" defaultValue={uf ?? ''}>
          <option value="">Todos</option>
          {UFS.map((sigla) => (
            <option key={sigla} value={sigla}>
              {sigla}
            </option>
          ))}
        </select>{' '}
        <button type="submit">Filtrar</button>
      </form>

      <p>
        {resultado.total} {resultado.total === 1 ? 'parlamentar' : 'parlamentares'}
        {uf ? ` em ${uf}` : ''}.
      </p>

      <ul className="lista">
        {resultado.itens.map((p) => (
          <li key={p.pessoaId}>
            <Link href={`/parlamentares/${p.pessoaId}`}>{p.nome}</Link>{' '}
            <span>
              {p.siglaPartido ?? 'sem partido'}
              {p.uf ? `-${p.uf}` : ''} · {nomeDoCargo(p.cargo)}
            </span>
          </li>
        ))}
      </ul>

      <nav aria-label="Paginação">
        {pagina > 1 && <Link href={endereco(pagina - 1)}>Anterior</Link>}{' '}
        <span>
          Página {pagina} de {ultimaPagina}
        </span>{' '}
        {pagina < ultimaPagina && <Link href={endereco(pagina + 1)}>Próxima</Link>}
      </nav>
    </main>
  );
}
