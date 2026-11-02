import type { FonteDoDado } from '@prometeu/contracts';
import type { ReactNode } from 'react';

import { dataEHora } from './formatacao';

/** Toda informação exibida mostra de onde veio (ADR-0009). */
export function Fonte({ fonte }: { fonte: FonteDoDado }): ReactNode {
  if (fonte.url === null || fonte.coletadaEm === null) {
    return <p className="fonte">Fonte: captura {fonte.capturaId} (detalhes em processamento).</p>;
  }
  return (
    <p className="fonte">
      Fonte:{' '}
      <a href={fonte.url} rel="noopener noreferrer external">
        {new URL(fonte.url).hostname}
      </a>
      , coletado em {dataEHora(fonte.coletadaEm)}. Captura {fonte.capturaId}.
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
