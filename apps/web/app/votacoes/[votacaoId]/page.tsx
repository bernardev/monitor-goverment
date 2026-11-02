import type { OpcaoDeVoto, ParlamentarSemVoto, SituacaoSemVoto } from '@prometeu/contracts';
import { Explica, FaixaDeNumeros, Proporcao, Secao } from '@prometeu/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { buscarVotacao } from '../../_api/cliente';
import { FonteDaSecao } from '../../_componentes/fonte';
import {
  artigoDaCasa,
  dia,
  identificacao,
  nomeDaCasa,
  nomeDaOpcao,
  nomeDaSituacaoSemVoto,
  nomeDoMotivo,
  nomeDoResultado,
  plural,
} from '../../_componentes/formatacao';
import { GLOSSARIO } from '../../_componentes/glossario';
import { ORDEM_DAS_OPCOES, partesDoPlacar, placarEmFrase } from '../../_componentes/placar';
import { Topo } from '../../_componentes/topo';
import { numerosDaVotacao, textoDosVotos } from './numeros';

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
  const casa = nomeDaCasa(votacao.casa);
  const artigo = artigoDaCasa(votacao.casa);
  const periodo = dia(votacao.dia);
  const numeros = numerosDaVotacao(votacao);
  const resultado =
    votacao.resultado === 'nao_informado'
      ? 'A casa não informou o resultado.'
      : `Resultado declarado pela casa: ${nomeDoResultado(votacao.resultado).toLowerCase()}.`;
  const secoes = [
    ['placar', 'Placar'],
    ['votos', 'Como votou cada um'],
    ['sem-voto', 'Quem não votou'],
  ] as const;

  return (
    <main className="reportagem">
      <Topo
        chapeu={`Votações · ${casa}`}
        titulo={`Votação de ${periodo}`}
        linhaFina={votacao.descricao}
        voltar={{ href: '/votacoes', texto: 'Todas as votações nominais' }}
      >
        {votacao.proposicoes.length > 0 && (
          <p>
            Sobre{' '}
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
      </Topo>

      {numeros.length > 0 && <FaixaDeNumeros itens={numeros} />}

      <div className="reportagem__explicacoes">
        <Explica termo="Votação nominal">{GLOSSARIO.votacaoNominal}</Explica>
      </div>

      <nav aria-label="Nesta página">
        <ul className="indice">
          {secoes.map(([id, titulo]) => (
            <li key={id}>
              <a href={`#${id}`}>{titulo}</a>
            </li>
          ))}
        </ul>
      </nav>

      <Secao
        id="placar"
        titulo="Placar"
        periodo={periodo}
        fonte={<FonteDaSecao fonte={votacao.fonte} publicador={casa} />}
      >
        <p>
          {votacao.secreta
            ? `Votação secreta: ${artigo} ${casa} registra quem votou, não como. `
            : `Placar informado ${artigo === 'a' ? 'pela' : 'pelo'} ${casa}: ${placarEmFrase(votacao)}. `}
          {resultado}
        </p>
        <Proporcao partes={partesDoPlacar(votacao)} />
        <p>
          O resultado é o declarado pela casa: algumas matérias precisam de maioria absoluta ou
          qualificada, e não só de mais votos sim do que não. Contam só os votos registrados.
        </p>
      </Secao>

      <Secao
        id="votos"
        titulo="Como votou cada um"
        periodo={periodo}
        fonte={<FonteDaSecao fonte={votacao.fonteDosVotos} publicador={casa} />}
      >
        <p>{textoDosVotos({ secreta: votacao.secreta, nomes: votacao.votos.length })}</p>
        <div className="pilha">
          {agrupar(votacao.votos, (v) => v.opcao)
            .sort(([a], [b]) => ORDEM_DAS_OPCOES.indexOf(a) - ORDEM_DAS_OPCOES.indexOf(b))
            .map(([opcao, votos]) => (
              <Grupo key={opcao} titulo={nomeDaOpcao(opcao)} pessoas={votos} />
            ))}
        </div>
      </Secao>

      <Secao
        id="sem-voto"
        titulo="Quem não votou"
        periodo={periodo}
        fonte={<FonteDaSecao fonte={votacao.fonteDosVotos} publicador={casa} />}
      >
        {!votacao.relacaoCompleta ? (
          <p>
            {artigo.toUpperCase()} {casa} lista só quem votou: não informa quem não votou. Quem não
            aparece na lista acima não é, por isso, ausente.
          </p>
        ) : votacao.semVoto.length === 0 ? (
          <p>Todos os parlamentares em exercício têm voto registrado.</p>
        ) : (
          <>
            <p>
              {`${plural(votacao.semVoto.length, 'parlamentar em exercício sem voto registrado', 'parlamentares em exercício sem voto registrado')}, com a situação que ${artigo} ${casa} informou.`}
            </p>
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
          </>
        )}
      </Secao>
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
        {titulo}: {pessoas.length}
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
