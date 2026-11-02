import { Chapeu } from '@prometeu/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * O cabeçalho de uma página de detalhe, como o de uma reportagem: o chapéu, o título e a linha fina
 * que diz do que se trata. O caminho de volta fica no fim, nunca acima do título.
 */
export function Topo({
  chapeu,
  titulo,
  linhaFina,
  voltar,
  children,
}: {
  chapeu: string;
  titulo: string;
  linhaFina?: ReactNode;
  voltar: { readonly href: string; readonly texto: string };
  children?: ReactNode;
}): ReactNode {
  return (
    <header className="reportagem__cabeca">
      <div className="reportagem__texto">
        <Chapeu>{chapeu}</Chapeu>
        <h1>{titulo}</h1>
        {linhaFina !== undefined && <p className="reportagem__fina">{linhaFina}</p>}
        {children}
        <p className="nota">
          <Link href={voltar.href}>← {voltar.texto}</Link>
        </p>
      </div>
    </header>
  );
}
