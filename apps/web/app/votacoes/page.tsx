import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { listarVotacoes } from '../_api/cliente';
import { dia, nomeDaCasa, nomeDoResultado } from '../_componentes/formatacao';
import { Abas, PaginaDeLista } from '../_componentes/pagina-de-lista';

export const metadata: Metadata = {
  title: 'Votações nominais | Prometeu',
  description:
    'Votações nominais do plenário da Câmara e do Senado, com o placar, o voto de cada parlamentar e a fonte oficial.',
};

interface Props {
  readonly searchParams: Promise<{ pagina?: string; casa?: string }>;
}

const CASAS = ['camara', 'senado'] as const;

export default async function PaginaDeVotacoes({ searchParams }: Props): Promise<ReactNode> {
  const busca = await searchParams;
  const pagina = Math.max(1, Number.parseInt(busca.pagina ?? '1', 10) || 1);
  const casa = CASAS.find((c) => c === busca.casa);
  const resultado = await listarVotacoes(pagina, casa);
  const ultimaPagina = Math.max(1, Math.ceil(resultado.total / resultado.itensPorPagina));
  const endereco = (outra: number, outraCasa = casa) =>
    `/votacoes?${new URLSearchParams({
      ...(outraCasa ? { casa: outraCasa } : {}),
      pagina: String(outra),
    }).toString()}`;

  return (
    <PaginaDeLista
      campo="aco"
      titulo="Votações nominais"
      descricao="Votações do plenário em que cada parlamentar registra o voto, nos últimos 90 dias. As simbólicas, sem voto por parlamentar, não aparecem."
      filtros={
        <Abas
          rotulo="Casa"
          opcoes={[
            { texto: 'Todas', href: '/votacoes', atual: casa === undefined },
            { texto: 'Câmara', href: endereco(1, 'camara'), atual: casa === 'camara' },
            { texto: 'Senado', href: endereco(1, 'senado'), atual: casa === 'senado' },
          ]}
        />
      }
      contagem={`${String(resultado.total)} ${resultado.total === 1 ? 'votação coletada' : 'votações coletadas'}`}
      paginacao={{ pagina, ultima: ultimaPagina, endereco: (outra) => endereco(outra) }}
    >
      <ul className="lista">
        {resultado.itens.map((v) => (
          <li key={v.votacaoId}>
            <strong>{dia(v.dia)}</strong>:{' '}
            <Link href={`/votacoes/${v.votacaoId}`}>{v.descricao}</Link>
            <span>
              {nomeDaCasa(v.casa)} · {nomeDoResultado(v.resultado)}
              {v.secreta
                ? ' · votação secreta'
                : ` · Sim ${String(v.placar.sim)}, Não ${String(v.placar.nao)}`}
            </span>
          </li>
        ))}
      </ul>
    </PaginaDeLista>
  );
}
