import type { TramitacaoDaProposicao } from '@prometeu/contracts';
import { Capitulo, Cifra } from '@prometeu/ui';
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
import { placarEmFrase } from '../../_componentes/placar';
import { Topo } from '../../_componentes/topo';

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

  return (
    <main className="capitulos">
      <Topo
        titulo={identificacao(proposicao)}
        voltar={{ href: '/proposicoes', texto: 'Todas as proposições' }}
        aoLado={
          <Cifra
            valor={String(tramitacoes.length)}
            legenda={`${tramitacoes.length === 1 ? 'ato' : 'atos'} de tramitação coletados${proposicao.apresentadaEm ? ` desde a apresentação, em ${data(proposicao.apresentadaEm)}` : ''}.`}
          />
        }
      >
        {proposicao.ementa && <p className="destaque">{proposicao.ementa}</p>}
        <p>
          {nomeDoTipo(proposicao.sigla)} na {nomeDaCasa(proposicao.casa)}.
          {situacao
            ? ` Situação: ${situacao.descricao}${situacao.orgao ? ` (${situacao.orgao})` : ''}, desde ${data(situacao.desde)}.`
            : ''}
          {proposicao.normaGerada ? ` Virou norma: ${proposicao.normaGerada}.` : ''}
        </p>
        {proposicao.urlDoTexto && (
          <p>
            <a href={proposicao.urlDoTexto} rel="noopener noreferrer external">
              Texto na fonte oficial
            </a>
          </p>
        )}
        <Fonte fonte={proposicao.fonte} />
      </Topo>

      <Capitulo
        id="propuseram"
        campo="aco"
        verbo="Propuseram."
        frase={
          autores.length === 0
            ? 'A casa não informa a autoria.'
            : `${String(autores.length)} ${autores.length === 1 ? 'autor' : 'autores'}, com quem assina à frente primeiro.`
        }
      >
        {autores.length > 0 && (
          <ul className="nomes">
            {autores.map((a, i) => (
              <li key={`${a.nome}-${String(i)}`}>
                {a.pessoaId ? <Link href={`/parlamentares/${a.pessoaId}`}>{a.nome}</Link> : a.nome}{' '}
                <span className="nota">
                  {a.tipoNaFonte}
                  {a.proponente ? '' : ', assina junto'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Capitulo>

      <Capitulo
        id="tramitou"
        campo="papel"
        verbo="Tramitou."
        frase={
          tramitacoes.length === 0
            ? 'Nenhum ato de tramitação coletado.'
            : `${String(tramitacoes.length)} ${tramitacoes.length === 1 ? 'ato' : 'atos'}, do mais recente para o mais antigo.`
        }
      >
        {tramitacoes.length > 0 && (
          <div className="pilha">
            <Atos atos={recentes} quando={quando} />
            {anteriores.length > 0 && (
              <details className="recolhido">
                <summary>Ver os {anteriores.length} atos anteriores</summary>
                <Atos atos={anteriores} quando={quando} />
              </details>
            )}
          </div>
        )}
      </Capitulo>

      {votacoes.length > 0 && (
        <Capitulo
          id="foi-votada"
          campo="aco"
          verbo="Foi votada."
          frase={`${String(votacoes.length)} ${votacoes.length === 1 ? 'votação nominal coletada' : 'votações nominais coletadas'} sobre ela, da mais recente para a mais antiga.`}
        >
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
        </Capitulo>
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
            {(t.orgao ?? (t.despacho && t.despacho !== t.descricao)) && (
              <p className="nota">
                {[t.orgao, t.despacho !== t.descricao ? t.despacho : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
