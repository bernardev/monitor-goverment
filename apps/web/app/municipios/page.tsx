import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { buscarMunicipios } from '../_api/cliente';
import { PaginaDeLista } from '../_componentes/pagina-de-lista';

export const metadata: Metadata = {
  title: 'Meu governo | Prometeu',
  description:
    'Procure sua cidade e veja quem a representa no Congresso, quanto dinheiro de emenda chegou e em que obras ele virou.',
};

interface Props {
  readonly searchParams: Promise<{ nome?: string }>;
}

export default async function Municipios({ searchParams }: Props): Promise<ReactNode> {
  const nome = ((await searchParams).nome ?? '').trim().slice(0, 80);
  const encontrados = await buscarMunicipios(nome);

  return (
    <PaginaDeLista
      titulo="Meu governo"
      descricao="Procure sua cidade: quem a representa no Congresso, quanto dinheiro de emenda chegou e em que obras ele virou."
      filtros={
        <form method="get" action="/municipios" role="search" className="busca">
          <label htmlFor="nome" className="oculto">
            Cidade
          </label>
          <input
            id="nome"
            name="nome"
            type="search"
            defaultValue={nome}
            minLength={2}
            required
            placeholder="Nome da cidade"
          />
          <button type="submit" className="botao">
            Procurar
          </button>
        </form>
      }
      {...(nome.length >= 2
        ? {
            contagem:
              encontrados.length === 0
                ? `Nenhuma cidade com “${nome}” entre as que já receberam emenda ou têm obra coletada.`
                : `${String(encontrados.length)} ${encontrados.length === 1 ? 'cidade' : 'cidades'} com “${nome}”`,
          }
        : {})}
    >
      {encontrados.length > 0 && (
        <ul className="lista">
          {encontrados.map((m) => (
            <li key={m.codigoIbge}>
              <Link href={`/municipios/${m.codigoIbge}`}>{m.nome}</Link>
              <span>{m.uf}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="nota">
        A lista tem as cidades que aparecem como destino de emenda ou local de obra; a lista oficial
        de municípios do IBGE ainda não foi carregada.
      </p>
    </PaginaDeLista>
  );
}
