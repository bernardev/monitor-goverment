import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { buscarMunicipio, listarEmendas, listarObras } from '../../_api/cliente';
import { ItemDeEmenda } from '../../_componentes/emendas';
import { ItemDeObra } from '../../_componentes/obras';

interface Props {
  readonly params: Promise<{ codigoIbge: string }>;
  readonly searchParams: Promise<{ pagina?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const municipio = await buscarMunicipio((await params).codigoIbge);
  return {
    title: municipio
      ? `${municipio.nome} - ${municipio.uf} | Prometeu`
      : 'Município não encontrado | Prometeu',
  };
}

export default async function PaginaDoMunicipio({
  params,
  searchParams,
}: Props): Promise<ReactNode> {
  const { codigoIbge } = await params;
  const municipio = await buscarMunicipio(codigoIbge);
  if (!municipio) notFound();
  const pagina = Math.max(1, Number.parseInt((await searchParams).pagina ?? '1', 10) || 1);
  const [emendas, obras] = await Promise.all([
    listarEmendas({ municipio: codigoIbge, pagina }),
    listarObras({ municipio: codigoIbge, pagina: 1, itens: 100 }),
  ]);
  const ultimaPagina = Math.max(1, Math.ceil(emendas.total / emendas.itensPorPagina));
  const endereco = (outra: number) => `/municipios/${codigoIbge}?pagina=${String(outra)}`;

  return (
    <main>
      <p>
        <Link href="/busca">← Busca</Link>
      </p>
      <h1>
        {municipio.nome} - {municipio.uf}
      </h1>
      <p>Código IBGE {municipio.codigoIbge}.</p>

      <section>
        <h2>Obras pagas com emendas</h2>
        {obras.total === 0 ? (
          <p>Nenhuma obra ligada a emenda neste município.</p>
        ) : (
          <>
            <p>
              {obras.total} {obras.total === 1 ? 'obra' : 'obras'}, da de maior investimento para a
              de menor.
            </p>
            <ul className="lista">
              {obras.itens.map((o) => (
                <ItemDeObra key={o.obraId} obra={o} />
              ))}
            </ul>
          </>
        )}
      </section>

      <section>
        <h2>Emendas com destino ao município</h2>
        <p>
          {emendas.total} {emendas.total === 1 ? 'emenda' : 'emendas'} com ao menos uma destinação
          aqui. As que vão para a UF inteira ou para vários municípios não entram.
        </p>
        <ul className="lista">
          {emendas.itens.map((e) => (
            <ItemDeEmenda key={e.emendaId} emenda={e} />
          ))}
        </ul>
        <nav aria-label="Paginação">
          {pagina > 1 && <Link href={endereco(pagina - 1)}>Anterior</Link>}{' '}
          <span>
            Página {pagina} de {ultimaPagina}
          </span>{' '}
          {pagina < ultimaPagina && <Link href={endereco(pagina + 1)}>Próxima</Link>}
        </nav>
      </section>
    </main>
  );
}
