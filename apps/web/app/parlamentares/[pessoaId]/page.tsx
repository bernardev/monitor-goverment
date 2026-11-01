import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
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
import {
  Autorias,
  Emendas,
  Obras,
  type ObrasDoParlamentar,
  Presenca,
  Promessas,
  VERBOS,
  Votos,
} from './capitulos';

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
  // votação.
  const comPresenca = frequencia !== undefined && perfil.cargo !== 'senador';
  const capitulos = Object.entries(VERBOS).filter(([id]) => id !== 'compareceu' || comPresenca);

  return (
    <main className="capitulos">
      <section className="retrato" data-campo="papel" aria-labelledby="nome">
        <div className="retrato__miolo">
          <div className="retrato__texto">
            <h1 id="nome" className="retrato__nome">
              {perfil.nome}
            </h1>
            <p className="destaque">
              {nomeDoCargo(perfil.cargo)}
              {perfil.uf ? ` por ${perfil.uf}` : ''} · {perfil.siglaPartido ?? 'sem partido'}
              {perfil.mandato
                ? `. Mandato de ${data(perfil.mandato.inicio)}${perfil.mandato.fim ? ` a ${data(perfil.mandato.fim)}` : ', em curso'}.`
                : '.'}
            </p>
            <nav aria-label="O que fez">
              <ul className="sumario">
                {capitulos.map(([id, verbo]) => (
                  <li key={id}>
                    <a href={`#${id}`}>{verbo}</a>
                  </li>
                ))}
              </ul>
            </nav>
            <Acompanhar tipo="parlamentar" id={pessoaId} volta={`/parlamentares/${pessoaId}`} />
            <Fonte fonte={perfil.mandato?.fonte ?? perfil.fonte} />
          </div>
          {perfil.urlDaFoto && (
            <figure className="retrato__foto">
              <img src={perfil.urlDaFoto} alt={`Foto oficial de ${perfil.nome}`} />
            </figure>
          )}
        </div>
      </section>

      <Promessas />
      {comPresenca && <Presenca frequencia={frequencia} />}
      {votos && <Votos votos={votos} />}
      {autorias && <Autorias autorias={autorias} />}
      {emendas && <Emendas emendas={emendas} />}
      <Obras obras={obras} />
    </main>
  );
}
