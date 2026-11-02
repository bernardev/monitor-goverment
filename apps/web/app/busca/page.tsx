import { Secao } from '@prometeu/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { buscarMunicipios, listarObras, listarParlamentares } from '../_api/cliente';
import { FonteDaSecao } from '../_componentes/fonte';
import { nomeDoCargo, plural } from '../_componentes/formatacao';
import { ItemDeObra } from '../_componentes/obras';
import { PaginaDeLista } from '../_componentes/pagina-de-lista';

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
    <PaginaDeLista
      chapeu="Procurar"
      titulo="Busca"
      descricao="Um parlamentar, uma cidade ou uma obra, pelo nome. Acento e maiúsculas não importam."
      filtros={
        <form method="get" action="/busca" role="search" className="busca">
          <label htmlFor="q" className="oculto">
            Parlamentar, município ou obra
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={termo}
            minLength={2}
            required
            placeholder="Um político, uma cidade, uma obra"
          />
          <button type="submit" className="botao">
            Buscar
          </button>
        </form>
      }
      {...(valido
        ? {
            contagem: nada
              ? `Nada encontrado para “${termo}”. Tente só o nome ou o sobrenome.`
              : `Resultados para “${termo}”`,
          }
        : {})}
    >
      {!valido && (
        <p>
          Escreva pelo menos duas letras do nome: de um deputado ou senador, de uma cidade ou de uma
          obra. A busca olha só o nome, não o assunto.
        </p>
      )}

      {parlamentares && parlamentares.total > 0 && (
        <Secao
          id="parlamentares"
          titulo="Parlamentares"
          periodo={plural(parlamentares.total, 'resultado', 'resultados')}
          fonte={<p className="fonte">Fonte: Câmara dos Deputados e Senado Federal.</p>}
        >
          <ul className="lista lista--fios lista--colunas">
            {parlamentares.itens.map((p) => (
              <li key={p.pessoaId}>
                <Link href={`/parlamentares/${p.pessoaId}`}>{p.nome}</Link>
                <span>
                  {p.siglaPartido ?? 'sem partido'}
                  {p.uf ? `-${p.uf}` : ''} · {nomeDoCargo(p.cargo)}
                </span>
              </li>
            ))}
          </ul>
          {parlamentares.total > POR_TIPO && (
            <p className="nota">
              E mais {parlamentares.total - POR_TIPO}: refine a busca ou{' '}
              <Link href="/parlamentares">veja a lista completa</Link>.
            </p>
          )}
        </Secao>
      )}

      {municipios.length > 0 && (
        <Secao
          id="cidades"
          titulo="Cidades"
          periodo={plural(municipios.length, 'resultado', 'resultados')}
          fonte={
            <p className="fonte">
              Fonte: Portal da Transparência e Obrasgov.br. Só entram cidades que aparecem como
              destino de emenda ou local de obra.
            </p>
          }
        >
          <ul className="lista lista--fios lista--colunas">
            {municipios.map((m) => (
              <li key={m.codigoIbge}>
                <Link href={`/municipios/${m.codigoIbge}`}>{m.nome}</Link> · {m.uf}
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {obras && obras.total > 0 && (
        <Secao
          id="obras"
          titulo="Obras"
          periodo={plural(obras.total, 'resultado', 'resultados')}
          fonte={
            obras.itens[0] && <FonteDaSecao fonte={obras.itens[0].fonte} publicador="Obrasgov.br" />
          }
        >
          <ul className="lista lista--fios">
            {obras.itens.map((o) => (
              <ItemDeObra key={o.obraId} obra={o} />
            ))}
          </ul>
          {obras.total > POR_TIPO && (
            <p className="nota">
              E mais {obras.total - POR_TIPO}: refine a busca ou{' '}
              <Link href="/obras">veja a lista completa</Link>.
            </p>
          )}
        </Secao>
      )}
    </PaginaDeLista>
  );
}
