import { Chapeu } from '@prometeu/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Uma página de lista, como a editoria de um jornal: o chapéu, o título, o que a lista é em palavras
 * simples e os filtros em linha; abaixo, quantos itens há, de que período, os itens entre fios, a
 * fonte e a paginação.
 */
export function PaginaDeLista({
  chapeu = 'Prometeu',
  titulo,
  descricao,
  explica,
  filtros,
  contagem,
  periodo,
  fonte,
  paginacao,
  children,
}: {
  chapeu?: string;
  titulo: string;
  descricao?: ReactNode;
  /** Um `<Explica>` com o termo técnico que a lista usa. */
  explica?: ReactNode;
  /** Um `<form className="filtros">`, ou as abas de uma escolha só. */
  filtros?: ReactNode;
  contagem?: ReactNode;
  /** O período a que a lista se refere, à direita da contagem. */
  periodo?: string | undefined;
  /** O fim da lista: de onde vieram os dados. */
  fonte?: ReactNode;
  paginacao?: DadosDaPaginacao;
  children: ReactNode;
}): ReactNode {
  return (
    <main className="reportagem editoria">
      <header className="editoria__topo">
        <Chapeu>{chapeu}</Chapeu>
        <h1>{titulo}</h1>
        {descricao !== undefined && <p className="editoria__descricao">{descricao}</p>}
        {explica}
        {filtros}
      </header>
      <div className="editoria__corpo">
        {contagem !== undefined && (
          <div className="editoria__cabeca">
            <p className="editoria__contagem">{contagem}</p>
            {periodo !== undefined && <span className="secao__periodo">{periodo}</span>}
          </div>
        )}
        {children}
        {fonte !== undefined && <div className="secao__fonte">{fonte}</div>}
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
      {pagina > 1 ? (
        <Link href={endereco(pagina - 1)} rel="prev">
          ← Anterior
        </Link>
      ) : (
        <span />
      )}
      <span>
        Página {pagina} de {ultima}
      </span>
      {pagina < ultima ? (
        <Link href={endereco(pagina + 1)} rel="next">
          Próxima →
        </Link>
      ) : (
        <span />
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
