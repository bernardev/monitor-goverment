import type { EmendaResumo } from '@prometeu/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { nomeDaModalidade, nomeDoTipoDeEmenda, pagoAteAgora, reais } from './formatacao';

/** `Emenda 0001/2026`: o número é por autor e por ano, como o Portal da Transparência escreve. */
export function identificacaoDaEmenda(e: { numero: string; ano: number }): string {
  return `Emenda ${e.numero}/${String(e.ano)}`;
}

/** `Individual, transferência especial`: o tipo e a modalidade de cada destinação. */
export function tipoEModalidade(e: Pick<EmendaResumo, 'tipo' | 'modalidades'>): string {
  return [nomeDoTipoDeEmenda(e.tipo), ...e.modalidades.map(nomeDaModalidade)].join(', ');
}

/** Onde a emenda aplica o dinheiro, sem despejar dezenas de localidades numa linha. */
export function destinos(localidades: readonly string[]): string {
  const [primeira, segunda, ...outras] = localidades;
  if (primeira === undefined) return 'Destino não informado';
  if (segunda === undefined) return primeira;
  if (outras.length === 0) return `${primeira} e ${segunda}`;
  return `${primeira}, ${segunda} e mais ${String(outras.length)}`;
}

/** Uma emenda numa lista: quem indicou, para onde, quanto foi empenhado e quanto já foi pago. */
export function ItemDeEmenda({
  emenda: e,
  comAutor = true,
}: {
  emenda: EmendaResumo;
  comAutor?: boolean;
}): ReactNode {
  return (
    <li>
      <Link href={`/emendas/${e.emendaId}`}>{identificacaoDaEmenda(e)}</Link>
      {comAutor ? ` · ${e.autor.nome}` : ''}
      <span>
        {tipoEModalidade(e)} · {destinos(e.localidades)}
      </span>
      <span>
        Empenhado {reais(e.execucao.empenhadoCentavos)} · pago até agora{' '}
        {reais(pagoAteAgora(e.execucao))}
      </span>
    </li>
  );
}
