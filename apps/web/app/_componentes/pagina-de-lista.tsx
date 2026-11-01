import type { Campo } from '@prometeu/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Uma página de lista: o topo na cor do assunto, com o título, o que a lista é e os filtros; abaixo,
 * quantos itens há, os itens e a paginação.
 */
export function PaginaDeLista({
  campo = 'papel',
  titulo,
  descricao,
  filtros,
  contagem,
  paginacao,
  children,
}: {
  campo?: Campo;
  titulo: string;
  descricao?: ReactNode;
  /** Um `<form className="filtros">`, ou as abas de uma escolha só. */
  filtros?: ReactNode;
  contagem?: ReactNode;
  paginacao?: DadosDaPaginacao;
  children: ReactNode;
}): ReactNode {
  return (
    <main className="capitulos">
      <header className="topo-da-lista" data-campo={campo}>
        <div className="topo-da-lista__miolo">
          <h1 className="retrato__titulo">{titulo}</h1>
          {descricao !== undefined && <p className="destaque">{descricao}</p>}
          {filtros}
        </div>
      </header>
      <div className="corpo-da-lista">
        {contagem !== undefined && <p className="contagem">{contagem}</p>}
        {children}
        {paginacao !== undefined && <Paginacao {...paginacao} />}
      </div>
    </main>
  );
}

export interface DadosDaPaginacao {
  readonly pagina: number;
  readonly ultima: number;
  /** O endereço da outra página, com os mesmos filtros. */
  readonly endereco: (pagina: number) => string;
}

export function Paginacao({ pagina, ultima, endereco }: DadosDaPaginacao): ReactNode {
  if (ultima <= 1) return null;
  return (
    <nav aria-label="Paginação" className="paginacao">
      {pagina > 1 && (
        <Link href={endereco(pagina - 1)} className="botao botao--secundario" rel="prev">
          ← Anterior
        </Link>
      )}
      <span>
        Página {pagina} de {ultima}
      </span>
      {pagina < ultima && (
        <Link href={endereco(pagina + 1)} className="botao botao--secundario" rel="next">
          Próxima →
        </Link>
      )}
    </nav>
  );
}

/** Uma escolha só entre poucas opções (Câmara, Senado): abas, sem formulário. */
export function Abas({
  rotulo,
  opcoes,
}: {
  rotulo: string;
  opcoes: readonly { readonly texto: string; readonly href: string; readonly atual: boolean }[];
}): ReactNode {
  return (
    <nav aria-label={rotulo} className="abas">
      {opcoes.map((o) => (
        <Link key={o.href} href={o.href} aria-current={o.atual ? 'page' : undefined}>
          {o.texto}
        </Link>
      ))}
    </nav>
  );
}
