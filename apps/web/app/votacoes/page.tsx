import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { listarVotacoes } from '../_api/cliente';
import { dia, nomeDoResultado } from '../_componentes/formatacao';

export const metadata: Metadata = {
  title: 'Votações nominais | Prometeu',
  description:
    'Votações nominais do plenário da Câmara dos Deputados, com o placar, o voto de cada deputado e a fonte oficial.',
};

interface Props {
  readonly searchParams: Promise<{ pagina?: string }>;
}

export default async function PaginaDeVotacoes({ searchParams }: Props): Promise<ReactNode> {
  const pagina = Math.max(1, Number.parseInt((await searchParams).pagina ?? '1', 10) || 1);
  const resultado = await listarVotacoes(pagina);
  const ultimaPagina = Math.max(1, Math.ceil(resultado.total / resultado.itensPorPagina));

  return (
    <main>
      <p>
        <Link href="/">← Início</Link>
      </p>
      <h1>Votações nominais</h1>
      <p>
        Votações do plenário em que cada deputado registra o voto, nos últimos 90 dias. As votações
        simbólicas, sem voto por deputado, não aparecem.
      </p>
      <p>
        {resultado.total} {resultado.total === 1 ? 'votação coletada' : 'votações coletadas'}.
      </p>

      <ul className="lista">
        {resultado.itens.map((v) => (
          <li key={v.votacaoId}>
            <strong>{dia(v.dia)}</strong>:{' '}
            <Link href={`/votacoes/${v.votacaoId}`}>{v.descricao}</Link>
            <span>
              {nomeDoResultado(v.resultado)}
              {v.secreta ? ' · votação secreta' : ''} · Sim {v.placar.sim}, Não {v.placar.nao}
            </span>
          </li>
        ))}
      </ul>

      <nav aria-label="Paginação">
        {pagina > 1 && <Link href={`/votacoes?pagina=${String(pagina - 1)}`}>Anterior</Link>}{' '}
        <span>
          Página {pagina} de {ultimaPagina}
        </span>{' '}
        {pagina < ultimaPagina && (
          <Link href={`/votacoes?pagina=${String(pagina + 1)}`}>Próxima</Link>
        )}
      </nav>
    </main>
  );
}
