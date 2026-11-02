import type { CSSProperties, ReactNode } from 'react';

import { atributosDaContagem, type Contagem } from './medidas';

/** O rótulo de editoria acima de um título: caixa alta, em azul. */
export function Chapeu({ children }: { children: ReactNode }): ReactNode {
  return <p className="chapeu">{children}</p>;
}

/**
 * Uma seção de dado: título com fio grosso em cima, o período à direita e a fonte no fim. O período
 * e a fonte são o que torna o número conferível.
 */
export function Secao({
  id,
  titulo,
  periodo,
  fonte,
  children,
}: {
  id: string;
  titulo: string;
  periodo?: string;
  fonte?: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="secao" data-surge="entra">
      <div className="secao__cabeca">
        <h2 id={`${id}-titulo`} className="secao__titulo">
          {titulo}
        </h2>
        {periodo !== undefined && <span className="secao__periodo">{periodo}</span>}
      </div>
      {children}
      {fonte !== undefined && <div className="secao__fonte">{fonte}</div>}
    </section>
  );
}

/** Um número-chave com o que ele mede e o período a que se refere. */
export interface NumeroChave {
  /** O texto final, já formatado; com `contagem`, é o que aparece sem JavaScript. */
  readonly valor: string;
  readonly rotulo: string;
  readonly periodo: string;
  readonly contagem?: Contagem;
}

/** De dois a quatro números lado a lado, entre fios. Sem dado, o `valor` é "—" e não conta. */
export function FaixaDeNumeros({ itens }: { itens: readonly NumeroChave[] }): ReactNode {
  return (
    <div
      className="faixa"
      style={{ '--colunas': itens.length } as CSSProperties}
      data-surge="entra"
    >
      {itens.map((item) => (
        <div key={item.rotulo} className="faixa__item">
          <p className="faixa__valor">
            <span {...atributosDaContagem(item.contagem)}>{item.valor}</span>
          </p>
          <p className="faixa__rotulo">{item.rotulo}</p>
          <p className="faixa__periodo">{item.periodo}</p>
        </div>
      ))}
    </div>
  );
}

/** Uma chamada de matéria: chapéu, título que leva à página, linha fina e fonte. */
export function Chamada({
  chapeu,
  titulo,
  href,
  linhaFina,
  fonte,
  tamanho,
}: {
  chapeu: string;
  titulo: string;
  href: string;
  linhaFina?: ReactNode;
  fonte?: ReactNode;
  tamanho: 'manchete' | 'secundaria' | 'lista';
}): ReactNode {
  return (
    <article className={`chamada chamada--${tamanho}`} data-surge="entra">
      <Chapeu>{chapeu}</Chapeu>
      <h3 className="chamada__titulo">
        <a href={href}>{titulo}</a>
      </h3>
      {linhaFina !== undefined && <p className="chamada__fina">{linhaFina}</p>}
      {fonte !== undefined && <p className="chamada__fonte">{fonte}</p>}
    </article>
  );
}

/** Uma explicação curta de um termo técnico, no tom de quem lê o jornal. */
export function Explica({ termo, children }: { termo: string; children: ReactNode }): ReactNode {
  return (
    <p className="explica">
      <strong>{termo}:</strong> {children}
    </p>
  );
}
