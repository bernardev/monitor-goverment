import type {
  ConvenioDaEmenda,
  FavorecidoDaEmenda,
  FavorecidosDaEmenda,
} from '@prometeu/contracts';
import type { ReactNode } from 'react';

import { Fonte } from './fonte';
import { dia, documentoDoFavorecido, mes, nomeDoFavorecido, reais } from './formatacao';

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
export function Favorecidos({
  favorecidos,
}: {
  favorecidos: FavorecidosDaEmenda | null;
}): ReactNode {
  if (favorecidos === null) {
    return <p>O Portal da Transparência ainda não registrou pagamentos desta emenda.</p>;
  }
  const mostrados = favorecidos.itens.slice(0, MOSTRADOS);
  const outros = favorecidos.itens.slice(MOSTRADOS);
  const somados = favorecidos.itens.some((f) => f.documento === null);
  return (
    <>
      <p>
        {reais(favorecidos.recebidoCentavos)} recebidos por{' '}
        {favorecidos.itens.length === 1
          ? 'um favorecido'
          : `${String(favorecidos.itens.length)} favorecidos`}
        .
      </p>
      <ul className="lista">
        {mostrados.map((f) => {
          const documento = documentoDoFavorecido(f);
          return (
            // O identificado é o documento; o somado, o tipo e o lugar.
            <li key={[f.tipo, f.documento ?? '', f.uf ?? '', f.municipio ?? ''].join('|')}>
              <strong>{nomeDoFavorecido(f)}</strong>
              {documento ? ` · ${documento}` : ''}
              <span>
                {[f.naturezaJuridica, lugar(f)].filter((parte) => parte !== null).join(' · ')}
              </span>
              <span>
                Recebeu {reais(f.recebidoCentavos)} {periodo(f)}
              </span>
            </li>
          );
        })}
      </ul>
      {outros.length > 0 && (
        <p className="fonte">
          E mais {String(outros.length)} favorecidos, que receberam{' '}
          {reais(outros.reduce((soma, f) => soma + BigInt(f.recebidoCentavos), 0n))}.
        </p>
      )}
      {somados && (
        <p className="fonte">
          Pessoas físicas aparecem somadas por município, sem nome nem CPF: o Prometeu acompanha o
          dinheiro, não o cidadão que o recebe.
        </p>
      )}
      <Fonte fonte={favorecidos.fonte} />
    </>
  );
}

/** Convênios que a emenda ajuda a pagar, do mais recente para o mais antigo. */
export function Convenios({ convenios }: { convenios: readonly ConvenioDaEmenda[] }): ReactNode {
  if (convenios.length === 0) {
    return <p>Nenhum convênio desta emenda no Portal da Transparência.</p>;
  }
  return (
    <ul className="lista">
      {convenios.map((c) => (
        <li key={c.numero}>
          <strong>Convênio {c.numero}</strong> · {c.convenente}
          {c.objeto && <span>{c.objeto}</span>}
          <span>
            {reais(c.valorCentavos)}
            {c.emendas > 1 ? ` no total, pago por ${String(c.emendas)} emendas` : ''} · publicado em{' '}
            {dia(c.publicadoEm)} · {c.localidades.join(', ')}
          </span>
          <Fonte fonte={c.fonte} />
        </li>
      ))}
    </ul>
  );
}
