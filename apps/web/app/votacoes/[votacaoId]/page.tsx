import type {
  OpcaoDeVoto,
  ParlamentarSemVoto,
  SituacaoSemVoto,
  VotacaoNominalDetalhada,
} from '@prometeu/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { buscarVotacao } from '../../_api/cliente';
import { Fonte } from '../../_componentes/fonte';
import {
  dia,
  nomeDaCasa,
  nomeDaOpcao,
  nomeDaSituacaoSemVoto,
  nomeDoMotivo,
  nomeDoResultado,
} from '../../_componentes/formatacao';
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

  return (
    <main>
      <p>
        <Link href="/votacoes">← Votações nominais</Link>
      </p>
      <article>
        <h1>Votação de {dia(votacao.dia)}</h1>
        <p>{nomeDaCasa(votacao.casa)}, plenário.</p>
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
            Contam só os votos registrados.{' '}
            {votacao.relacaoCompleta
              ? 'O Senado lista todos os senadores em exercício; quem não votou aparece abaixo, com o motivo informado pela casa.'
              : 'A Câmara não lista quem não votou: quem não aparece aqui não é, por isso, ausente.'}{' '}
            O resultado é o declarado pela casa: algumas matérias precisam de maioria absoluta ou
            qualificada, e não só de mais votos Sim do que Não.
          </p>
        </section>

        <section>
          <h2>Votos</h2>
          {agrupar(votacao.votos, (v) => v.opcao).map(([opcao, votos]) => (
            <Grupo key={opcao} titulo={nomeDaOpcao(opcao)} pessoas={votos} />
          ))}
          <Fonte fonte={votacao.fonteDosVotos} />
        </section>

        {votacao.semVoto.length > 0 && <SemVoto votacao={votacao} />}
      </article>
    </main>
  );
}

function SemVoto({ votacao }: { votacao: VotacaoNominalDetalhada }): ReactNode {
  return (
    <section>
      <h2>Não votaram</h2>
      {agrupar(votacao.semVoto, (s) => s.situacao).map(([situacao, pessoas]) => (
        <Grupo
          key={situacao}
          titulo={nomeDaSituacaoSemVoto(situacao)}
          pessoas={pessoas}
          detalhe={detalheSemVoto}
        />
      ))}
    </section>
  );
}

function detalheSemVoto(p: ParlamentarSemVoto): string {
  const motivo = p.motivo ? `${nomeDoMotivo(p.motivo.categoria)}; ` : '';
  return `${motivo}registro da casa: “${p.registroNaFonte}”`;
}

interface Pessoa {
  readonly pessoaId: string;
  readonly nome: string | null;
  readonly siglaPartido: string | null;
}

function Grupo<P extends Pessoa>({
  titulo,
  pessoas,
  detalhe,
}: {
  titulo: string;
  pessoas: readonly P[];
  detalhe?: (p: P) => string;
}): ReactNode {
  return (
    <div>
      <h3>
        {titulo} ({pessoas.length})
      </h3>
      <ul className="lista">
        {pessoas.map((p) => (
          <li key={p.pessoaId}>
            <Link href={`/parlamentares/${p.pessoaId}`}>{p.nome ?? 'Nome em processamento'}</Link>{' '}
            <span>
              {p.siglaPartido ?? 'partido não informado'}, no dia da votação
              {detalhe ? `. ${detalhe(p)}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function agrupar<T, K extends OpcaoDeVoto | SituacaoSemVoto>(
  itens: readonly T[],
  chave: (item: T) => K,
): [K, T[]][] {
  const grupos = new Map<K, T[]>();
  for (const item of itens) grupos.set(chave(item), [...(grupos.get(chave(item)) ?? []), item]);
  return [...grupos];
}
