import type { SituacaoDaObra } from '@prometeu/contracts';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { listarObras } from '../_api/cliente';
import { nomeDaSituacaoDaObra, UFS } from '../_componentes/formatacao';
import { ItemDeObra } from '../_componentes/obras';
import { PaginaDeLista } from '../_componentes/pagina-de-lista';

export const metadata: Metadata = {
  title: 'Obras pagas com emendas | Prometeu',
  description:
    'Obras federais pagas com emendas parlamentares: em que pé estão, quanto já foi executado e quais emendas as pagam.',
};

interface Props {
  readonly searchParams: Promise<{ pagina?: string; uf?: string; situacao?: string }>;
}

const SITUACOES: readonly SituacaoDaObra[] = [
  'planejada',
  'em_execucao',
  'paralisada',
  'concluida',
  'cancelada',
  'inacabada',
];

export default async function PaginaDeObras({ searchParams }: Props): Promise<ReactNode> {
  const busca = await searchParams;
  const pagina = Math.max(1, Number.parseInt(busca.pagina ?? '1', 10) || 1);
  const uf = UFS.find((u) => u === busca.uf);
  const situacao = SITUACOES.find((s) => s === busca.situacao);
  const resultado = await listarObras({ uf, situacao, pagina });
  const ultimaPagina = Math.max(1, Math.ceil(resultado.total / resultado.itensPorPagina));
  const endereco = (outra: number) =>
    `/obras?${new URLSearchParams({
      ...(uf ? { uf } : {}),
      ...(situacao ? { situacao } : {}),
      pagina: String(outra),
    }).toString()}`;

  return (
    <PaginaDeLista
      titulo="Obras pagas com emendas"
      descricao="Obras do cadastro federal (Obrasgov.br) com empenho de emenda parlamentar de 2023 em diante, da de maior investimento previsto para a de menor."
      filtros={
        <form method="get" action="/obras" className="filtros">
          <label htmlFor="situacao">Situação</label>
          <select id="situacao" name="situacao" defaultValue={situacao ?? ''}>
            <option value="">Todas</option>
            {SITUACOES.map((s) => (
              <option key={s} value={s}>
                {nomeDaSituacaoDaObra(s)}
              </option>
            ))}
          </select>
          <label htmlFor="uf">UF</label>
          <select id="uf" name="uf" defaultValue={uf ?? ''}>
            <option value="">Todas</option>
            {UFS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <button type="submit" className="botao">
            Filtrar
          </button>
        </form>
      }
      contagem={`${String(resultado.total)} ${resultado.total === 1 ? 'obra' : 'obras'}`}
      paginacao={{ pagina, ultima: ultimaPagina, endereco }}
    >
      <ul className="lista">
        {resultado.itens.map((o) => (
          <ItemDeObra key={o.obraId} obra={o} />
        ))}
      </ul>
    </PaginaDeLista>
  );
}
