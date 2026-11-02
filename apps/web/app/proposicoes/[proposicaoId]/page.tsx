import type { TramitacaoDaProposicao } from '@prometeu/contracts';
import { Explica, FaixaDeNumeros, Secao } from '@prometeu/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { buscarProposicao } from '../../_api/cliente';
import { FonteDaSecao } from '../../_componentes/fonte';
import {
  data,
  dataEHora,
  dia,
  identificacao,
  artigoDaCasa,
  nomeDaCasa,
  nomeDoResultado,
  nomeDoTipo,
  NUMERO,
  plural,
} from '../../_componentes/formatacao';
import { GLOSSARIO } from '../../_componentes/glossario';
import { placarEmFrase } from '../../_componentes/placar';
import { Topo } from '../../_componentes/topo';
import { numerosDaProposicao, periodoDasVotacoes, periodoDosAtos } from './numeros';

interface Props {
  readonly params: Promise<{ proposicaoId: string }>;
}

/** Os atos mais recentes ficam à vista; os anteriores, recolhidos. */
const ATOS_A_VISTA = 10;

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
  const { tramitacoes, autores, votacoes, situacao } = proposicao;
  const recentes = tramitacoes.slice(0, ATOS_A_VISTA);
  const anteriores = tramitacoes.slice(ATOS_A_VISTA);
  const casa = nomeDaCasa(proposicao.casa);
  const artigo = artigoDaCasa(proposicao.casa);
  const fonte = <FonteDaSecao fonte={proposicao.fonte} publicador={casa} />;
  // O sumário só lista o que a página mostra.
  const secoes = [
    ['situacao', 'Situação'],
    ['autoria', 'Quem apresentou'],
    ['tramitacao', 'Tramitação'],
    ...(votacoes.length > 0 ? [['votacoes', 'Votações nominais']] : []),
  ] as const;

  return (
    <main className="reportagem">
      <Topo
        chapeu={`${nomeDoTipo(proposicao.sigla)} · ${casa}`}
        titulo={identificacao(proposicao)}
        linhaFina={proposicao.ementa ?? undefined}
        voltar={{ href: '/proposicoes', texto: 'Todas as proposições' }}
      >
        {proposicao.urlDoTexto && (
          <p>
            <a href={proposicao.urlDoTexto} rel="noopener noreferrer external">
              Texto na fonte oficial
            </a>
          </p>
        )}
      </Topo>

      <FaixaDeNumeros itens={numerosDaProposicao({ tramitacoes, votacoes })} />

      <div className="reportagem__explicacoes">
        <p>
          Os números contam só o que já foi coletado d{artigo} {casa}.
        </p>
        <Explica termo="Tramitação">{GLOSSARIO.tramitacao}</Explica>
        {votacoes.length > 0 && (
          <Explica termo="Votação nominal">{GLOSSARIO.votacaoNominal}</Explica>
        )}
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
        id="situacao"
        titulo="Situação"
        periodo={situacao ? `desde ${data(situacao.desde)}` : 'sem situação informada'}
        fonte={fonte}
      >
        {situacao ? (
          <p>
            {situacao.descricao}
            {situacao.orgao ? ` (${situacao.orgao})` : ''}, segundo {artigo} {casa}.
          </p>
        ) : (
          <p>
            {artigo.toUpperCase()} {casa} não informa a situação atual desta proposição.
          </p>
        )}
        {proposicao.normaGerada && <p>Virou norma: {proposicao.normaGerada}.</p>}
      </Secao>

      <Secao
        id="autoria"
        titulo="Quem apresentou"
        periodo={
          proposicao.apresentadaEm
            ? `apresentada em ${data(proposicao.apresentadaEm)}`
            : 'data de apresentação não informada'
        }
        fonte={fonte}
      >
        {autores.length === 0 ? (
          <p>
            {artigo.toUpperCase()} {casa} não informa a autoria.
          </p>
        ) : (
          <>
            <p>
              {`${plural(autores.length, 'autor', 'autores')}, com quem assina à frente primeiro.`}
            </p>
            <ul className="nomes">
              {autores.map((a, i) => (
                <li key={`${a.nome}-${String(i)}`}>
                  {a.pessoaId ? (
                    <Link href={`/parlamentares/${a.pessoaId}`}>{a.nome}</Link>
                  ) : (
                    a.nome
                  )}{' '}
                  <span className="nota">
                    {a.tipoNaFonte}
                    {a.proponente ? '' : ', assina junto'}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Secao>

      <Secao
        id="tramitacao"
        titulo="Tramitação"
        periodo={periodoDosAtos(tramitacoes)}
        fonte={fonte}
      >
        {tramitacoes.length === 0 ? (
          <p>Nenhum ato de tramitação coletado.</p>
        ) : (
          <>
            <p>
              {`${plural(tramitacoes.length, 'ato', 'atos')}, do mais recente para o mais antigo.`}
            </p>
            <div className="pilha">
              <Atos atos={recentes} quando={quando} />
              {anteriores.length > 0 && (
                <details className="recolhido">
                  <summary>
                    {anteriores.length === 1
                      ? 'Ver o ato anterior'
                      : `Ver os ${NUMERO.format(anteriores.length)} atos anteriores`}
                  </summary>
                  <Atos atos={anteriores} quando={quando} />
                </details>
              )}
            </div>
          </>
        )}
      </Secao>

      {votacoes.length > 0 && (
        <Secao
          id="votacoes"
          titulo="Votações nominais"
          periodo={periodoDasVotacoes(votacoes)}
          fonte={<FonteDaSecao fonte={votacoes[0]?.fonte} publicador={casa} />}
        >
          <p>
            {`${plural(votacoes.length, 'votação nominal coletada', 'votações nominais coletadas')} sobre ela, da mais recente para a mais antiga.`}
          </p>
          <ul className="linhas">
            {votacoes.map((v) => (
              <li key={v.votacaoId} className="linha">
                <p className="linha__chave">{nomeDoResultado(v.resultado)}</p>
                <div className="linha__corpo">
                  <Link href={`/votacoes/${v.votacaoId}`}>{v.descricao}</Link>
                  <p className="nota">
                    {dia(v.dia)}
                    {v.secreta ? ' · votação secreta' : ` · ${placarEmFrase(v)}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Secao>
      )}
    </main>
  );
}

function Atos({
  atos,
  quando,
}: {
  atos: readonly TramitacaoDaProposicao[];
  quando: (iso: string) => string;
}): ReactNode {
  return (
    <ol className="linhas">
      {atos.map((t, i) => (
        <li key={`${t.em}-${String(i)}`} className="linha">
          <p className="linha__chave">{quando(t.em)}</p>
          <div className="linha__corpo">
            <p>{t.descricao}</p>
            {t.despacho && t.despacho !== t.descricao && <p>{t.despacho}</p>}
            {t.orgao && <p className="nota">{t.orgao}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
