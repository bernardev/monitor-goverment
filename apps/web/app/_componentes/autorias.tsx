import type { AutoriaDoParlamentar, Pagina } from '@prometeu/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { identificacao, nomeDaCasa } from './formatacao';

/** As proposições de autoria do parlamentar, as movimentadas por último primeiro. */
export function Autorias({ autorias }: { autorias: Pagina<AutoriaDoParlamentar> }): ReactNode {
  return (
    <section>
      <h2>Proposições de autoria</h2>
      {autorias.total === 0 ? (
        <p>Nenhuma proposição coletada com este parlamentar entre os autores.</p>
      ) : (
        <>
          <p>
            Proposições coletadas com este parlamentar entre os autores: {autorias.total}
            {autorias.total > autorias.itens.length
              ? `. As ${String(autorias.itens.length)} movimentadas por último:`
              : '.'}
          </p>
          <ul className="lista">
            {autorias.itens.map(({ proposicao: p, proponente }) => (
              <li key={p.proposicaoId}>
                <Link href={`/proposicoes/${p.proposicaoId}`}>{identificacao(p)}</Link>
                {p.ementa ? `: ${p.ementa}` : ''}
                <span>
                  {nomeDaCasa(p.casa)}
                  {p.situacao ? ` · ${p.situacao.descricao}` : ''}
                  {proponente ? '' : ' · assina junto'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="fonte">
        Só entram as proposições normativas (PEC, PLP, PL, MPV e PDL) que se moveram desde o início
        da coleta.
      </p>
    </section>
  );
}
