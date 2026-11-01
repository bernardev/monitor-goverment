import type { OpcaoDeVoto, ParlamentarSemVoto, SituacaoSemVoto } from '@prometeu/contracts';
import { Capitulo, Proporcao } from '@prometeu/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { buscarVotacao } from '../../_api/cliente';
import { Fonte } from '../../_componentes/fonte';
import {
  dia,
  identificacao,
  nomeDaCasa,
  nomeDaOpcao,
  nomeDaSituacaoSemVoto,
  nomeDoMotivo,
} from '../../_componentes/formatacao';
import { partesDoPlacar, placarEmFrase } from '../../_componentes/placar';
import { Topo } from '../../_componentes/topo';

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

/** O resultado como verbo do capítulo: a casa aprovou, rejeitou ou só decidiu. */
const VERBO_DO_RESULTADO: Readonly<Record<string, string>> = {
  aprovada: 'Aprovou.',
  rejeitada: 'Rejeitou.',
};

export default async function PaginaDaVotacao({ params }: Props): Promise<ReactNode> {
  const votacao = await buscarVotacao((await params).votacaoId);
  if (!votacao) notFound();
  const casa = nomeDaCasa(votacao.casa);
  const aCasa = `${votacao.casa === 'camara_dos_deputados' ? 'A' : 'O'} ${casa}`;
  const verbo = VERBO_DO_RESULTADO[votacao.resultado] ?? 'Decidiu.';
  const verbo3 = verbo.toLowerCase().replace('.', '');

  return (
    <main className="capitulos">
      <Topo
        titulo={`Votação de ${dia(votacao.dia)}`}
        voltar={{ href: '/votacoes', texto: 'Todas as votações nominais' }}
      >
        <p className="destaque">{votacao.descricao}</p>
        {votacao.proposicoes.length > 0 && (
          <p>
            {casa}, plenário. Sobre{' '}
            {votacao.proposicoes.map((p, i) => (
              <span key={p.codigoNaFonte}>
                {i > 0 ? ', ' : ''}
                {p.proposicaoId ? (
                  <Link href={`/proposicoes/${p.proposicaoId}`}>{identificacao(p)}</Link>
                ) : (
                  identificacao(p)
                )}
              </span>
            ))}
            .
          </p>
        )}
        <Fonte fonte={votacao.fonte} />
      </Topo>

      <Capitulo
        id="resultado"
        campo="areia"
        verbo={verbo}
        frase={
          votacao.secreta
            ? `${aCasa} ${verbo3} em votação secreta: a casa registra quem votou, não como.`
            : `${aCasa} ${verbo3}, com ${placarEmFrase(votacao)}.`
        }
        aoLado={<Proporcao partes={partesDoPlacar(votacao)} />}
        nota={
          <p>
            O resultado é o declarado pela casa: algumas matérias precisam de maioria absoluta ou
            qualificada, e não só de mais votos sim do que não. Contam só os votos registrados.
          </p>
        }
      />

      <Capitulo
        id="votaram"
        campo="aco"
        verbo="Votaram."
        frase={`${String(votacao.votos.length)} parlamentares com voto registrado, com o partido do dia da votação.`}
        nota={
          <>
            <p>
              {votacao.relacaoCompleta
                ? 'O Senado lista todos os senadores em exercício; quem não votou aparece no capítulo seguinte, com o motivo informado pela casa.'
                : 'A Câmara não lista quem não votou: quem não aparece aqui não é, por isso, ausente.'}
            </p>
            <Fonte fonte={votacao.fonteDosVotos} />
          </>
        }
      >
        <div className="pilha">
          {agrupar(votacao.votos, (v) => v.opcao).map(([opcao, votos]) => (
            <Grupo key={opcao} titulo={nomeDaOpcao(opcao)} pessoas={votos} />
          ))}
        </div>
      </Capitulo>

      {votacao.semVoto.length > 0 && (
        <Capitulo
          id="nao-votaram"
          campo="papel"
          verbo="Não votaram."
          frase={`${String(votacao.semVoto.length)} senadores em exercício sem voto registrado, com a situação que a casa informou.`}
        >
          <div className="pilha">
            {agrupar(votacao.semVoto, (s) => s.situacao).map(([situacao, pessoas]) => (
              <Grupo
                key={situacao}
                titulo={nomeDaSituacaoSemVoto(situacao)}
                pessoas={pessoas}
                detalhe={detalheSemVoto}
              />
            ))}
          </div>
        </Capitulo>
      )}
    </main>
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
    <section className="pilha" aria-label={titulo}>
      <h3 className="titulo-de-lista">
        {titulo} ({pessoas.length})
      </h3>
      <ul className="nomes">
        {pessoas.map((p) => (
          <li key={p.pessoaId} title={detalhe?.(p)}>
            <Link href={`/parlamentares/${p.pessoaId}`}>{p.nome ?? 'Nome em processamento'}</Link>{' '}
            <span className="nota">{p.siglaPartido ?? 'sem partido'}</span>
            {detalhe && <span className="nomes__detalhe nota">{detalhe(p)}</span>}
          </li>
        ))}
      </ul>
    </section>
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
