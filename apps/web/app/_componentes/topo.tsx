import Link from 'next/link';
import type { ReactNode } from 'react';

/** Título mais longo que isto usa o tamanho menor, para caber em duas linhas. */
const LONGO = 48;

/**
 * O topo de uma página de detalhe: o título, o que ele é em uma frase, o que prova (a fonte) e, ao
 * lado, o número ou a foto que resume. O caminho de volta fica no pé do topo, depois do número, nunca acima de um título.
 */
export function Topo({
  titulo,
  aoLado,
  voltar,
  children,
}: {
  titulo: ReactNode;
  aoLado?: ReactNode;
  voltar: { readonly href: string; readonly texto: string };
  children: ReactNode;
}): ReactNode {
  return (
    <section className="retrato" data-campo="papel" aria-labelledby="titulo">
      <div className="retrato__miolo">
        <div className="retrato__texto">
          <h1
            id="titulo"
            className={
              typeof titulo === 'string' && titulo.length > LONGO
                ? 'retrato__titulo retrato__titulo--longo'
                : 'retrato__titulo'
            }
          >
            {titulo}
          </h1>
          {children}
        </div>
        {aoLado !== undefined && <div className="retrato__lado">{aoLado}</div>}
        <p className="nota retrato__voltar">
          <Link href={voltar.href}>← {voltar.texto}</Link>
        </p>
      </div>
    </section>
  );
}
