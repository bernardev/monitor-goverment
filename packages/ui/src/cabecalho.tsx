import type { ReactNode } from 'react';

/**
 * A cabeça do jornal: a marca em serifa, as ações à direita e a navegação entre um fio fino e um fio
 * duplo. Abaixo de 640 px a navegação vai para um `<details>`, que abre e fecha sem JavaScript; no
 * desktop o CSS a mostra sempre aberta, e os links existem uma vez só no DOM.
 */
export function Cabecalho({
  marca,
  navegacao,
  acoes,
}: {
  marca: ReactNode;
  navegacao: ReactNode;
  acoes?: ReactNode;
}): ReactNode {
  return (
    <header className="cabecalho">
      <div className="cabecalho__miolo">
        <div className="cabecalho__marca">{marca}</div>
        {acoes !== undefined && <div className="cabecalho__acoes">{acoes}</div>}
        <details className="cabecalho__menu">
          <summary>Menu</summary>
          {navegacao}
        </details>
      </div>
    </header>
  );
}
