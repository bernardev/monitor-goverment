import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { buscarProposicao } from '../../_api/cliente';
import { Fonte } from '../../_componentes/fonte';
import {
  data,
  dataEHora,
  dia,
  identificacao,
  nomeDaCasa,
  nomeDoResultado,
  nomeDoTipo,
} from '../../_componentes/formatacao';

interface Props {
  readonly params: Promise<{ proposicaoId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const proposicao = await buscarProposicao((await params).proposicaoId);
  return {
    title: proposicao
      ? `${identificacao(proposicao)} | Prometeu`
      : 'Proposição não encontrada | Prometeu',
  };
}

export default async function PaginaDaProposicao({ params }: Props): Promise<ReactNode> {
  const proposicao = await buscarProposicao((await params).proposicaoId);
  if (!proposicao) notFound();
  // O Senado informa só o dia de cada situação: mostrar a hora seria inventar.
  const quando = proposicao.casa === 'senado_federal' ? data : dataEHora;

  return (
    <main>
      <p>
        <Link href="/proposicoes">← Proposições</Link>
      </p>
      <article>
        <h1>{identificacao(proposicao)}</h1>
        <p>
          {nomeDoTipo(proposicao.sigla)} na {nomeDaCasa(proposicao.casa)}
          {proposicao.apresentadaEm
            ? `, com apresentação em ${data(proposicao.apresentadaEm)}`
            : ''}
          .
        </p>
        {proposicao.ementa && <p>{proposicao.ementa}</p>}
        {proposicao.situacao && (
          <p>
            <strong>Situação:</strong> {proposicao.situacao.descricao}
            {proposicao.situacao.orgao ? ` (${proposicao.situacao.orgao})` : ''}, desde{' '}
            {data(proposicao.situacao.desde)}.
          </p>
        )}
        {proposicao.normaGerada && (
          <p>
            <strong>Virou norma:</strong> {proposicao.normaGerada}.
          </p>
        )}
        {proposicao.urlDoTexto && (
          <p>
            <a href={proposicao.urlDoTexto} rel="noopener noreferrer external">
              Texto na fonte oficial
            </a>
          </p>
        )}
        <Fonte fonte={proposicao.fonte} />

        <section>
          <h2>Autoria</h2>
          {proposicao.autores.length === 0 ? (
            <p>A casa não informa a autoria.</p>
          ) : (
            <ul className="lista">
              {proposicao.autores.map((a, i) => (
                <li key={`${a.nome}-${String(i)}`}>
                  {a.pessoaId ? (
                    <Link href={`/parlamentares/${a.pessoaId}`}>{a.nome}</Link>
                  ) : (
                    a.nome
                  )}
                  <span>
                    {a.tipoNaFonte}
                    {a.proponente ? '' : ' · assina junto'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {proposicao.votacoes.length > 0 && (
          <section>
            <h2>Votações nominais</h2>
            <ul className="lista">
              {proposicao.votacoes.map((v) => (
                <li key={v.votacaoId}>
                  <strong>{dia(v.dia)}</strong>:{' '}
                  <Link href={`/votacoes/${v.votacaoId}`}>{v.descricao}</Link>
                  <span>{nomeDoResultado(v.resultado)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2>Tramitação</h2>
          {proposicao.tramitacoes.length === 0 ? (
            <p>Nenhum ato de tramitação coletado.</p>
          ) : (
            <ol className="lista" reversed>
              {proposicao.tramitacoes.map((t, i) => (
                <li key={`${t.em}-${String(i)}`}>
                  <strong>{quando(t.em)}</strong>
                  {t.orgao ? ` · ${t.orgao}` : ''}: {t.descricao}
                  {t.despacho && t.despacho !== t.descricao && <span>{t.despacho}</span>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </article>
    </main>
  );
}
