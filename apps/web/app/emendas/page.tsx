import type { TipoDeEmenda } from '@prometeu/contracts';
import { Explica } from '@prometeu/ui';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { listarEmendas } from '../_api/cliente';
import { ItemDeEmenda } from '../_componentes/emendas';
import { FonteDaSecao } from '../_componentes/fonte';
import { nomeDoTipoDeEmenda, periodoDasEmendas, plural, UFS } from '../_componentes/formatacao';
import { GLOSSARIO } from '../_componentes/glossario';
import { PaginaDeLista } from '../_componentes/pagina-de-lista';

export const metadata: Metadata = {
  title: 'Emendas parlamentares | Prometeu',
  description:
    'Emendas de deputados, senadores, bancadas e comissões ao orçamento federal: quem indicou, para onde vai o dinheiro e quanto já foi empenhado e pago.',
};

interface Props {
  readonly searchParams: Promise<{ pagina?: string; ano?: string; tipo?: string; uf?: string }>;
}

const TIPOS: readonly TipoDeEmenda[] = ['individual', 'bancada', 'comissao', 'relator'];

/** A coleta começa no orçamento de 2023; o do ano seguinte é votado no fim do ano corrente. */
const PRIMEIRO_ANO = 2023;

export default async function PaginaDeEmendas({ searchParams }: Props): Promise<ReactNode> {
  const busca = await searchParams;
  const anos = Array.from(
    { length: new Date().getUTCFullYear() + 2 - PRIMEIRO_ANO },
    (_, i) => new Date().getUTCFullYear() + 1 - i,
  );
  const pagina = Math.max(1, Number.parseInt(busca.pagina ?? '1', 10) || 1);
  const ano = anos.find((a) => String(a) === busca.ano);
  const tipo = TIPOS.find((t) => t === busca.tipo);
  const uf = UFS.find((u) => u === busca.uf);
  const resultado = await listarEmendas({ ano, tipo, uf, pagina });
  const ultimaPagina = Math.max(1, Math.ceil(resultado.total / resultado.itensPorPagina));
  const endereco = (outra: number) =>
    `/emendas?${new URLSearchParams({
      ...(ano ? { ano: String(ano) } : {}),
      ...(tipo ? { tipo } : {}),
      ...(uf ? { uf } : {}),
      pagina: String(outra),
    }).toString()}`;

  return (
    <PaginaDeLista
      chapeu="Dinheiro público"
      titulo="Emendas parlamentares"
      descricao="Quem indicou para onde vai o dinheiro do orçamento federal: deputados, senadores, bancadas e comissões. Do orçamento mais recente para o mais antigo; no mesmo ano, a de maior valor empenhado primeiro."
      explica={
        <>
          <Explica termo="Emenda">{GLOSSARIO.emenda}</Explica>
          <Explica termo="Empenhado">{GLOSSARIO.empenhado}</Explica>
          <Explica termo="Pago">{GLOSSARIO.pago}</Explica>
        </>
      }
      filtros={
        <form method="get" action="/emendas" className="filtros">
          <label htmlFor="ano">Orçamento</label>
          <select id="ano" name="ano" defaultValue={ano ?? ''}>
            <option value="">Todos</option>
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <label htmlFor="tipo">Tipo</label>
          <select id="tipo" name="tipo" defaultValue={tipo ?? ''}>
            <option value="">Todos</option>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {nomeDoTipoDeEmenda(t)}
              </option>
            ))}
          </select>
          <label htmlFor="uf">Destino</label>
          <select id="uf" name="uf" defaultValue={uf ?? ''}>
            <option value="">Todas as UFs</option>
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
      contagem={plural(resultado.total, 'emenda coletada', 'emendas coletadas')}
      periodo={
        resultado.itens[0] &&
        (ano
          ? `orçamento de ${String(ano)}`
          : periodoDasEmendas(resultado.itens[0].fonte.coletadaEm))
      }
      fonte={
        resultado.itens[0] && (
          <FonteDaSecao fonte={resultado.itens[0].fonte} publicador="Portal da Transparência" />
        )
      }
      paginacao={{ pagina, ultima: ultimaPagina, endereco }}
    >
      <ul className="lista lista--fios">
        {resultado.itens.map((e) => (
          <ItemDeEmenda key={e.emendaId} emenda={e} />
        ))}
      </ul>
    </PaginaDeLista>
  );
}
