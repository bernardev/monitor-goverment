import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { buscarObra } from '../../_api/cliente';
import { Fonte } from '../../_componentes/fonte';
import { cnpj, dia, reais } from '../../_componentes/formatacao';
import { lugarDaObra, situacaoEMedicao } from '../../_componentes/obras';

interface Props {
  readonly params: Promise<{ obraId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const obra = await buscarObra((await params).obraId);
  return { title: obra ? `${obra.nome} | Prometeu` : 'Obra não encontrada | Prometeu' };
}

const INTERRUPCOES: Readonly<Record<string, string>> = {
  paralisada: 'Paralisada',
  cancelada: 'Cancelada',
  inacabada: 'Declarada inacabada',
};

function periodo(inicio: string | null, fim: string | null): string {
  if (inicio === null && fim === null) return 'não informado';
  return `${inicio ? dia(inicio) : '?'} a ${fim ? dia(fim) : '?'}`;
}

export default async function PaginaDaObra({ params }: Props): Promise<ReactNode> {
  const obra = await buscarObra((await params).obraId);
  if (!obra) notFound();

  return (
    <main>
      <p>
        <Link href="/obras">← Obras</Link>
      </p>
      <article>
        <h1>{obra.nome}</h1>
        <p>
          {[obra.natureza, obra.especie].filter((parte) => parte !== null).join(' · ')} ·{' '}
          {lugarDaObra(obra)}
          {obra.endereco ? ` · ${obra.endereco}` : ''}
        </p>
        {obra.municipios.length > 0 && (
          <p>
            {obra.municipios.length === 1 ? 'Município: ' : 'Municípios: '}
            {obra.municipios.map((m, n) => (
              <span key={m.codigoIbge}>
                {n > 0 ? ', ' : ''}
                <Link href={`/municipios/${m.codigoIbge}`}>{m.nome ?? m.codigoIbge}</Link>
              </span>
            ))}
            .
          </p>
        )}
        {obra.descricao && obra.descricao !== obra.nome && <p>{obra.descricao}</p>}
        <p>
          Projeto {obra.idNaFonte} no Obrasgov.br, o cadastro federal de obras e projetos de
          investimento.
        </p>
        <Fonte fonte={obra.fonte} />

        <section>
          <h2>Situação</h2>
          <dl className="resumo">
            <dt>Situação</dt>
            <dd>{situacaoEMedicao(obra)}</dd>
            <dt>Como a fonte escreve</dt>
            <dd>{obra.situacaoNaFonte}</dd>
            <dt>Prazo previsto</dt>
            <dd>{periodo(obra.inicioPrevisto, obra.fimPrevisto)}</dd>
            <dt>Execução</dt>
            <dd>{periodo(obra.inicioEfetivo, obra.fimEfetivo)}</dd>
            <dt>Investimento previsto</dt>
            <dd>{reais(obra.investimentoPrevistoCentavos)}</dd>
          </dl>
          {obra.medicao === null && (
            <p className="fonte">O Obrasgov.br ainda não registra execução física desta obra.</p>
          )}
          {obra.executores.length > 0 && (
            <p>
              Executada por{' '}
              {obra.executores
                .map((e) =>
                  [e.nome, e.cnpj ? `CNPJ ${cnpj(e.cnpj)}` : null].filter(Boolean).join(', '),
                )
                .join('; ')}
              .
            </p>
          )}
        </section>

        {obra.interrupcoes.length > 0 && (
          <section>
            <h2>Paralisações e cancelamentos</h2>
            <ul className="lista">
              {obra.interrupcoes.map((i) => (
                <li key={`${i.em}|${i.tipo}|${i.justificativa ?? ''}`}>
                  <strong>
                    {INTERRUPCOES[i.tipo] ?? i.tipo} em {dia(i.em)}
                  </strong>
                  {i.justificativa && <span>{i.justificativa}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2>Emendas que pagam a obra</h2>
          <ul className="lista">
            {obra.emendas.map((e) => (
              <li key={`${e.codigoDaEmenda}|${e.numeroDoEmpenho}`}>
                {e.emendaId ? (
                  <Link href={`/emendas/${e.emendaId}`}>Emenda {e.codigoDaEmenda}</Link>
                ) : (
                  `Emenda ${e.codigoDaEmenda}`
                )}
                {e.autor && (
                  <>
                    {' '}
                    de{' '}
                    {e.autor.pessoaId ? (
                      <Link href={`/parlamentares/${e.autor.pessoaId}`}>{e.autor.nome}</Link>
                    ) : (
                      e.autor.nome
                    )}
                  </>
                )}
                <span>
                  Empenho {e.numeroDoEmpenho}: {reais(e.empenhadoCentavos)}
                  {e.emitidoEm ? ` em ${dia(e.emitidoEm)}` : ''}
                  {e.acaoOrcamentaria ? ` · ação ${e.acaoOrcamentaria}` : ''}
                </span>
              </li>
            ))}
          </ul>
          <p className="fonte">
            A ligação vem do próprio empenho, que traz o código da emenda no Portal da
            Transparência.
          </p>
        </section>
      </article>
    </main>
  );
}
