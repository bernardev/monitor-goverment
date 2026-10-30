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
