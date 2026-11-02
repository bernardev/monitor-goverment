import type { FonteDoDado } from '@prometeu/contracts';
import type { ReactNode } from 'react';

import { dataEHora } from './formatacao';

/** O domínio de uma fonte http(s); endereço inválido não derruba a página, só perde o link. */
function dominioDe(url: string): string | null {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'http:' || protocol === 'https:' ? hostname : null;
  } catch {
    return null;
  }
}

/** O texto da fonte sem o parágrafo, para caber numa linha fina ou numa chamada. */
export function FonteEmLinha({ fonte }: { fonte: FonteDoDado }): ReactNode {
  if (fonte.url === null || fonte.coletadaEm === null) {
    return <>Fonte: captura {fonte.capturaId} (detalhes em processamento).</>;
  }
  const dominio = dominioDe(fonte.url);
  return (
    <>
      Fonte:{' '}
      {dominio === null ? (
        fonte.url
      ) : (
        <a href={fonte.url} rel="noopener noreferrer external">
          {dominio}
        </a>
      )}
      , coletado em {dataEHora(fonte.coletadaEm)}. Captura {fonte.capturaId}.
    </>
  );
}

/** Toda informação exibida mostra de onde veio (ADR-0009). */
export function Fonte({ fonte }: { fonte: FonteDoDado }): ReactNode {
  return (
    <p className="fonte">
      <FonteEmLinha fonte={fonte} />
    </p>
  );
}

/**
 * O fim de toda seção de dado: a captura quando há uma; sem dado ainda, o nome de quem publica, para
 * a seção vazia também dizer de onde o dado viria.
 */
export function FonteDaSecao({
  fonte,
  publicador,
}: {
  fonte?: FonteDoDado | undefined;
  publicador: string;
}): ReactNode {
  return fonte ? (
    <Fonte fonte={fonte} />
  ) : (
    <p className="fonte">Fonte: {publicador}. Ainda sem registro coletado.</p>
  );
}
