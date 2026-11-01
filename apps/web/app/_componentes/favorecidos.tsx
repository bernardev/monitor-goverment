import type {
  ConvenioDaEmenda,
  FavorecidoDaEmenda,
  FavorecidosDaEmenda,
} from '@prometeu/contracts';
import { Ranking } from '@prometeu/ui';
import type { ReactNode } from 'react';

import { Fonte } from './fonte';
import {
  dia,
  documentoDoFavorecido,
  mes,
  nomeDoFavorecido,
  reais,
  reaisResumidos,
} from './formatacao';

/** Quantos favorecidos a página mostra; a API devolve todos. */
const MOSTRADOS = 30;

function periodo(f: FavorecidoDaEmenda): string {
  return f.primeiroMes === f.ultimoMes
    ? `em ${mes(f.primeiroMes)}`
    : `de ${mes(f.primeiroMes)} a ${mes(f.ultimoMes)}`;
}

function lugar(f: FavorecidoDaEmenda): string {
  if (f.municipio && f.uf) return `${f.municipio} - ${f.uf}`;
  return f.municipio ?? f.uf ?? 'local não informado';
}

/** Para quem foi o dinheiro: do favorecido que mais recebeu para o que menos recebeu. */
export function Favorecidos({ favorecidos }: { favorecidos: FavorecidosDaEmenda }): ReactNode {
  const mostrados = favorecidos.itens.slice(0, MOSTRADOS);
  const outros = favorecidos.itens.slice(MOSTRADOS);
  const somados = favorecidos.itens.some((f) => f.documento === null);
  return (
    <div className="pilha">
      <Ranking
        itens={mostrados.map((f) => {
          const documento = documentoDoFavorecido(f);
          return {
            // O identificado é o documento; o somado, o tipo e o lugar.
            chave: [f.tipo, f.documento ?? '', f.uf ?? '', f.municipio ?? ''].join('|'),
            rotulo: nomeDoFavorecido(f),
            detalhe: [documento, f.naturezaJuridica, lugar(f), periodo(f)]
              .filter((parte) => parte !== null)
              .join(' · '),
            valor: Number(BigInt(f.recebidoCentavos) / 100n),
            texto: reaisResumidos(f.recebidoCentavos),
          };
        })}
      />
      {outros.length > 0 && (
        <p className="nota">
          E mais {String(outros.length)} favorecidos, que receberam{' '}
          {reais(outros.reduce((soma, f) => soma + BigInt(f.recebidoCentavos), 0n))}.
        </p>
      )}
      {somados && (
        <p className="nota">
          Pessoas físicas aparecem somadas por município, sem nome nem CPF: o Prometeu acompanha o
          dinheiro, não o cidadão que o recebe.
        </p>
      )}
      <Fonte fonte={favorecidos.fonte} />
    </div>
  );
}

/** Convênios que a emenda ajuda a pagar, do mais recente para o mais antigo. */
export function Convenios({ convenios }: { convenios: readonly ConvenioDaEmenda[] }): ReactNode {
  return (
    <ul className="linhas">
      {convenios.map((c) => (
        <li key={c.numero} className="linha">
          <p className="linha__chave">Convênio {c.numero}</p>
          <div className="linha__corpo">
            <p>
              <strong>{c.convenente}</strong>
              {c.objeto ? `: ${c.objeto}` : ''}
            </p>
            <p className="nota">
              {reais(c.valorCentavos)}
              {c.emendas > 1 ? ` no total, pago por ${String(c.emendas)} emendas` : ''} · publicado
              em {dia(c.publicadoEm)} · {c.localidades.join(', ')}
            </p>
            <Fonte fonte={c.fonte} />
          </div>
        </li>
      ))}
    </ul>
  );
}
