import type { TipoDeProposicao } from '@prometeu/contracts';
import { Explica } from '@prometeu/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { listarProposicoes } from '../_api/cliente';
import { FonteDaSecao } from '../_componentes/fonte';
import {
  data,
  dataEHora,
  identificacao,
  nomeDaCasa,
  nomeDoTipo,
  plural,
} from '../_componentes/formatacao';
import { GLOSSARIO } from '../_componentes/glossario';
import { PaginaDeLista } from '../_componentes/pagina-de-lista';

export const metadata: Metadata = {
  title: 'Proposições | Prometeu',
  description:
    'Propostas de emenda à Constituição, projetos de lei, medidas provisórias e decretos legislativos na Câmara e no Senado, com autoria, situação e tramitação.',
};

interface Props {
  readonly searchParams: Promise<{ pagina?: string; casa?: string; tipo?: string }>;
}

const CASAS = ['camara', 'senado'] as const;
const TIPOS: readonly TipoDeProposicao[] = ['PEC', 'PLP', 'PL', 'MPV', 'PDL'];

export default async function PaginaDeProposicoes({ searchParams }: Props): Promise<ReactNode> {
  const busca = await searchParams;
  const pagina = Math.max(1, Number.parseInt(busca.pagina ?? '1', 10) || 1);
  const casa = CASAS.find((c) => c === busca.casa);
  const tipo = TIPOS.find((t) => t === busca.tipo);
  const resultado = await listarProposicoes({ casa, tipo, pagina });
  const ultimaPagina = Math.max(1, Math.ceil(resultado.total / resultado.itensPorPagina));
  const endereco = (outra: number) =>
    `/proposicoes?${new URLSearchParams({
      ...(casa ? { casa } : {}),
      ...(tipo ? { tipo } : {}),
      pagina: String(outra),
    }).toString()}`;

  return (
    <PaginaDeLista
      chapeu="Congresso"
      titulo="Proposições"
      descricao="Propostas que podem virar lei ou outra norma, da que se moveu por último à mais parada. Requerimentos, pareceres e outros documentos de trâmite não aparecem."
      explica={<Explica termo="Tramitação">{GLOSSARIO.tramitacao}</Explica>}
      filtros={
        <form method="get" action="/proposicoes" className="filtros">
          <label htmlFor="casa">Casa</label>
          <select id="casa" name="casa" defaultValue={casa ?? ''}>
            <option value="">As duas</option>
            <option value="camara">Câmara</option>
            <option value="senado">Senado</option>
          </select>
          <label htmlFor="tipo">Tipo</label>
          <select id="tipo" name="tipo" defaultValue={tipo ?? ''}>
            <option value="">Todos</option>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {nomeDoTipo(t)}
              </option>
            ))}
          </select>
          <button type="submit" className="botao">
            Filtrar
          </button>
        </form>
      }
      contagem={plural(resultado.total, 'proposição coletada', 'proposições coletadas')}
      fonte={
        resultado.itens[0] && (
          <FonteDaSecao fonte={resultado.itens[0].fonte} publicador="Câmara e Senado" />
        )
      }
      paginacao={{ pagina, ultima: ultimaPagina, endereco }}
    >
      <ul className="lista lista--fios">
        {resultado.itens.map((p) => (
          <li key={p.proposicaoId}>
            <Link href={`/proposicoes/${p.proposicaoId}`}>{identificacao(p)}</Link>
            {p.ementa ? `: ${p.ementa}` : ''}
            <span>
              {nomeDaCasa(p.casa)}
              {p.situacao ? ` · ${p.situacao.descricao}` : ''}
              {p.ultimaTramitacaoEm
                ? ` · último ato em ${(p.casa === 'senado_federal' ? data : dataEHora)(p.ultimaTramitacaoEm)}`
                : ''}
            </span>
          </li>
        ))}
      </ul>
    </PaginaDeLista>
  );
}
