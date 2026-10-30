import type { OpcaoDeVoto, VotoNaVotacao } from '@prometeu/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { buscarVotacao } from '../../_api/cliente';
import { Fonte } from '../../_componentes/fonte';
import { dia, nomeDaOpcao, nomeDoResultado } from '../../_componentes/formatacao';
import { Placar } from '../../_componentes/placar';

interface Props {
  readonly params: Promise<{ votacaoId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const votacao = await buscarVotacao((await params).votacaoId);
  return {
    title: votacao
      ? `Votação de ${dia(votacao.dia)} | Prometeu`
      : 'Votação não encontrada | Prometeu',
  };
}

export default async function PaginaDaVotacao({ params }: Props): Promise<ReactNode> {
  const votacao = await buscarVotacao((await params).votacaoId);
  if (!votacao) notFound();

  const porOpcao = new Map<OpcaoDeVoto, VotoNaVotacao[]>();
  for (const voto of votacao.votos) {
    porOpcao.set(voto.opcao, [...(porOpcao.get(voto.opcao) ?? []), voto]);
  }

  return (
    <main>
      <p>
        <Link href="/votacoes">← Votações nominais</Link>
      </p>
      <article>
        <h1>Votação de {dia(votacao.dia)}</h1>
        <p>{votacao.descricao}</p>
        <p>
          <strong>{nomeDoResultado(votacao.resultado)}</strong>
          {votacao.secreta ? '. Votação secreta: a casa registra quem votou, não como.' : '.'}
        </p>
        {votacao.proposicoes.length > 0 && (
          <p>
            Proposições afetadas:{' '}
            {votacao.proposicoes
              .map((p) => `${p.sigla} ${String(p.numero)}/${String(p.ano)}`)
              .join(', ')}
            .
          </p>
        )}
        <Fonte fonte={votacao.fonte} />

        <section>
          <h2>Placar</h2>
          <Placar votacao={votacao} />
          <p className="fonte">
            Contam só os votos registrados; a Câmara não lista quem faltou à votação. O resultado é
            o declarado pela casa: algumas matérias precisam de maioria absoluta ou qualificada (257
            votos para lei complementar, 308 para emenda constitucional), e não só de mais votos Sim
            do que Não.
          </p>
        </section>

        <section>
          <h2>Votos</h2>
          {[...porOpcao].map(([opcao, votos]) => (
            <div key={opcao}>
              <h3>
                {nomeDaOpcao(opcao)} ({votos.length})
              </h3>
              <ul className="lista">
                {votos.map((v) => (
                  <li key={v.pessoaId}>
                    <Link href={`/parlamentares/${v.pessoaId}`}>
                      {v.nome ?? 'Nome em processamento'}
                    </Link>{' '}
                    <span>{v.siglaPartido ?? 'partido não informado'}, no dia da votação</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <Fonte fonte={votacao.fonteDosVotos} />
        </section>
      </article>
    </main>
  );
}
