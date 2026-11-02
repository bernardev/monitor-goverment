import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { listarParlamentares } from '../_api/cliente';
import { nomeDoCargo, plural, UFS } from '../_componentes/formatacao';
import { PaginaDeLista } from '../_componentes/pagina-de-lista';

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
    <PaginaDeLista
      chapeu="Congresso"
      titulo="Parlamentares"
      descricao="Os deputados federais e senadores em exercício, com partido e estado. Abra um nome para ver a presença, os votos, as proposições e as emendas. Escolha um estado para ver só os de lá."
      filtros={
        <form method="get" action="/parlamentares" className="filtros">
          <label htmlFor="uf">Estado</label>
          <select id="uf" name="uf" defaultValue={uf ?? ''}>
            <option value="">Todos</option>
            {UFS.map((sigla) => (
              <option key={sigla} value={sigla}>
                {sigla}
              </option>
            ))}
          </select>
          <button type="submit" className="botao">
            Filtrar
          </button>
        </form>
      }
      contagem={`${plural(resultado.total, 'parlamentar', 'parlamentares')}${uf ? ` em ${uf}` : ' em exercício'}`}
      fonte={<p className="fonte">Fonte: Câmara dos Deputados e Senado Federal.</p>}
      paginacao={{ pagina, ultima: ultimaPagina, endereco }}
    >
      <ul className="lista lista--fios lista--colunas">
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
    </PaginaDeLista>
  );
}
