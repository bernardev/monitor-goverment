import type { EmendaResumo, EmendasDoParlamentar } from '@prometeu/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { nomeDoTipoDeEmenda, pagoAteAgora, reais } from './formatacao';

/** `Emenda 0001/2026`: o número é por autor e por ano, como o Portal da Transparência escreve. */
export function identificacaoDaEmenda(e: { numero: string; ano: number }): string {
  return `Emenda ${e.numero}/${String(e.ano)}`;
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
        {nomeDoTipoDeEmenda(e.tipo)} · {destinos(e.localidades)}
      </span>
      <span>
        Empenhado {reais(e.execucao.empenhadoCentavos)} · pago até agora{' '}
        {reais(pagoAteAgora(e.execucao))}
      </span>
    </li>
  );
}

/** As emendas de que o parlamentar é autor, com a execução somada de todas. */
export function Emendas({ emendas }: { emendas: EmendasDoParlamentar }): ReactNode {
  return (
    <section>
      <h2>Emendas ao orçamento</h2>
      {emendas.total === 0 ? (
        <p>Nenhuma emenda coletada com este parlamentar como autor.</p>
      ) : (
        <>
          <dl className="resumo">
            <dt>Emendas</dt>
            <dd>{emendas.total}</dd>
            <dt>Empenhado</dt>
            <dd>{reais(emendas.soma.empenhadoCentavos)}</dd>
            <dt>Pago até agora</dt>
            <dd>{reais(pagoAteAgora(emendas.soma))}</dd>
          </dl>
          {emendas.total > emendas.itens.length && (
            <p>As {emendas.itens.length} do orçamento mais recente, de maior empenho primeiro:</p>
          )}
          <ul className="lista">
            {emendas.itens.map((e) => (
              <ItemDeEmenda key={e.emendaId} emenda={e} comAutor={false} />
            ))}
          </ul>
        </>
      )}
      <p className="fonte">
        Emendas individuais desde o orçamento de 2023, do Portal da Transparência. O Portal
        identifica o autor só pelo nome: a emenda é ligada ao parlamentar quando o nome corresponde
        a um único deputado ou senador em exercício no ano anterior ao do orçamento, quando a emenda
        é proposta. Pago até agora soma o pago no ano do orçamento e o pago depois, como restos a
        pagar.
      </p>
    </section>
  );
}
