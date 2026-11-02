import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Chapeu, Explica, FaixaDeNumeros } from '@prometeu/ui';
import type { ReactNode } from 'react';

import {
  buscarParlamentar,
  emendasDoParlamentar,
  frequenciaDoParlamentar,
  listarObras,
  proposicoesDoParlamentar,
  votosDoParlamentar,
} from '../../_api/cliente';
import { Acompanhar } from '../../_componentes/acompanhar';
import { Fonte } from '../../_componentes/fonte';
import { data, nomeDoCargo } from '../../_componentes/formatacao';
import { GLOSSARIO } from '../../_componentes/glossario';
import { numerosDoParlamentar } from './numeros';
import {
  Autorias,
  Emendas,
  Obras,
  type ObrasDoParlamentar,
  Presenca,
  Promessas,
  SECOES,
  Votos,
} from './secoes';

interface Props {
  readonly params: Promise<{ pessoaId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const perfil = await buscarParlamentar((await params).pessoaId);
  return { title: perfil ? `${perfil.nome} | Prometeu` : 'Parlamentar não encontrado | Prometeu' };
}

/** As obras pagas pelas emendas da pessoa: as maiores e quantas há em cada situação. */
async function obrasDoParlamentar(pessoaId: string): Promise<ObrasDoParlamentar> {
  const total = (situacao: 'concluida' | 'em_execucao' | 'paralisada') =>
    listarObras({ autor: pessoaId, situacao, pagina: 1, itens: 1 }).then((p) => p.total);
  const [maiores, concluidas, emExecucao, paralisadas] = await Promise.all([
    listarObras({ autor: pessoaId, pagina: 1, itens: 6 }),
    total('concluida'),
    total('em_execucao'),
    total('paralisada'),
  ]);
  return { maiores, concluidas, emExecucao, paralisadas };
}

export default async function PerfilDoParlamentar({ params }: Props): Promise<ReactNode> {
  const { pessoaId } = await params;
  const [perfil, frequencia, votos, autorias, emendas, obras] = await Promise.all([
    buscarParlamentar(pessoaId),
    frequenciaDoParlamentar(pessoaId),
    votosDoParlamentar(pessoaId),
    proposicoesDoParlamentar(pessoaId),
    emendasDoParlamentar(pessoaId),
    obrasDoParlamentar(pessoaId),
  ]);
  if (!perfil) notFound();

  // A frequência diária só é coletada na Câmara; no Senado, a ausência e o motivo vêm em cada
  // votação. Sem presença, a faixa fica só com os números de emendas.
  const comPresenca = frequencia !== undefined && perfil.cargo !== 'senador';
  const numeros = numerosDoParlamentar({ frequencia, emendas });
  // O sumário só lista o que a página mostra.
  const aparece: Readonly<Record<keyof typeof SECOES, boolean>> = {
    promessas: true,
    presenca: comPresenca,
    votacoes: votos !== undefined,
    projetos: autorias !== undefined,
    emendas: emendas !== undefined,
    obras: true,
  };
  const secoes = Object.entries(SECOES).filter(([id]) => aparece[id as keyof typeof SECOES]);
  const partidoEUf = [perfil.siglaPartido ?? 'sem partido', perfil.uf].filter(Boolean).join('-');

  return (
    <main className="reportagem">
      <header className="reportagem__cabeca">
        {perfil.urlDaFoto && (
          <img
            className="reportagem__foto"
            src={perfil.urlDaFoto}
            alt={`Foto oficial de ${perfil.nome}`}
          />
        )}
        <div className="reportagem__texto">
          <Chapeu>
            {nomeDoCargo(perfil.cargo)}
            {perfil.mandato && !perfil.mandato.fim ? ' · em exercício' : ''}
          </Chapeu>
          <h1>{perfil.nome}</h1>
          <div className="reportagem__acoes">
            <p className="reportagem__fina">
              {partidoEUf}
              {perfil.mandato ? ` · mandato desde ${data(perfil.mandato.inicio)}` : ''}
            </p>
            <Acompanhar tipo="parlamentar" id={pessoaId} volta={`/parlamentares/${pessoaId}`} />
          </div>
          <Fonte fonte={perfil.mandato?.fonte ?? perfil.fonte} />
        </div>
      </header>

      <FaixaDeNumeros itens={comPresenca ? numeros : numeros.slice(2)} />
      <p className="reportagem__nota">
        {comPresenca
          ? 'Os números de presença contam só os dias de sessão já coletados da Câmara. '
          : ''}
        Os de emendas somam as emendas individuais ligadas a este parlamentar.
      </p>

      <div className="reportagem__explicacoes">
        {comPresenca && (
          <>
            <Explica termo="Sessão">{GLOSSARIO.sessao}</Explica>
            <Explica termo="Falta justificada">{GLOSSARIO.faltaJustificada}</Explica>
          </>
        )}
        <Explica termo="Emenda">{GLOSSARIO.emenda}</Explica>
        <Explica termo="Empenhado">{GLOSSARIO.empenhado}</Explica>
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

      <Promessas />
      {comPresenca && <Presenca frequencia={frequencia} />}
      {votos && <Votos votos={votos} />}
      {autorias && <Autorias autorias={autorias} />}
      {emendas && <Emendas emendas={emendas} />}
      <Obras obras={obras} />
    </main>
  );
}
