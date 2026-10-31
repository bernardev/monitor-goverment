import type { ObraResumo } from '@prometeu/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { dia, nomeDaSituacaoDaObra, percentual, reais } from './formatacao';

/** Onde fica a obra: os municípios, ou a UF quando a fonte não dá o município. */
export function lugarDaObra(o: Pick<ObraResumo, 'municipios' | 'uf'>): string {
  const nomes = o.municipios.map((m) => m.nome).filter((nome) => nome !== null);
  const [primeiro, ...outros] = nomes;
  if (primeiro === undefined) return o.uf ?? 'Local não informado';
  const lugar = outros.length === 0 ? primeiro : `${primeiro} e mais ${String(outros.length)}`;
  return o.uf ? `${lugar} - ${o.uf}` : lugar;
}

/** `Em execução · 23,35% em 21/10/2026`. */
export function situacaoEMedicao(o: Pick<ObraResumo, 'situacao' | 'medicao'>): string {
  const situacao = nomeDaSituacaoDaObra(o.situacao);
  if (o.medicao === null) return situacao;
  const quando = o.medicao.em ? ` em ${dia(o.medicao.em)}` : '';
  return `${situacao} · ${percentual(o.medicao.percentualCentesimos)} executado${quando}`;
}

/** Uma obra numa lista: o que é, onde fica, em que pé está e quanto custa. */
export function ItemDeObra({ obra: o }: { obra: ObraResumo }): ReactNode {
  return (
    <li>
      <Link href={`/obras/${o.obraId}`}>{o.nome}</Link>
      <span>
        {situacaoEMedicao(o)} · {lugarDaObra(o)}
      </span>
      <span>Investimento previsto {reais(o.investimentoPrevistoCentavos)}</span>
    </li>
  );
}
