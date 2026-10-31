import type { ReactNode } from 'react';

import { type DiaMarcado, porcentagens, porMes } from './medidas';

/** Um número que fala sozinho, com a legenda do que foi medido logo abaixo. */
export function Cifra({ valor, legenda }: { valor: string; legenda: ReactNode }): ReactNode {
  return (
    <div className="cifra">
      <p className="cifra__valor">{valor}</p>
      <p className="cifra__legenda">{legenda}</p>
    </div>
  );
}

/** Tom de uma parte da barra, do mais forte ao mais fraco dentro do campo. */
export type Tom = 'forte' | 'medio' | 'fraco' | 'vazio';

export interface Parte {
  readonly rotulo: string;
  readonly valor: number;
  readonly tom: Tom;
  /** Como a parte se lê na legenda, quando o número cru não serve (`R$ 89,5 milhões pagos`). */
  readonly texto?: string;
}

function legendaDa(p: Parte): string {
  return p.texto ?? `${String(p.valor)} ${p.rotulo}`;
}

/**
 * Uma barra dividida nas partes de um todo, com a legenda em texto: as partes se distinguem pela
 * claridade e pelo rótulo, nunca só pela cor.
 */
export function Proporcao({ partes }: { partes: readonly Parte[] }): ReactNode {
  const visiveis = partes.filter((p) => p.valor > 0);
  const larguras = porcentagens(visiveis.map((p) => p.valor));
  const descricao = visiveis.map(legendaDa).join(', ');
  return (
    <figure className="proporcao">
      <div className="proporcao__barra" role="img" aria-label={descricao}>
        {visiveis.map((p, i) => (
          <span
            key={p.rotulo}
            className="proporcao__parte"
            data-tom={p.tom}
            style={{ flexBasis: `${String(larguras[i] ?? 0)}%` }}
          />
        ))}
      </div>
      <figcaption className="proporcao__legenda">
        {visiveis.map((p) => (
          <span key={p.rotulo} className="proporcao__item">
            <span className="proporcao__amostra" data-tom={p.tom} aria-hidden="true" />
            {legendaDa(p)}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/** Um dia marcado no calendário: o tom e o que ele quer dizer, para quem não vê a cor. */
export interface Marca {
  readonly tom: Tom;
  readonly descricao: string;
}

/** Os dias com registro, um quadrado por dia, agrupados por mês. */
export function Calendario({
  dias,
  rotulo,
  legenda,
}: {
  dias: readonly DiaMarcado<Marca>[];
  rotulo: string;
  legenda: ReactNode;
}): ReactNode {
  return (
    <figure className="calendario">
      <div role="img" aria-label={rotulo} className="calendario__meses">
        {porMes(dias).map((mes) => (
          <div key={mes.nome} className="calendario__mes">
            <span className="calendario__nome">{mes.nome}</span>
            <span className="calendario__dias">
              {mes.dias.map((d) => (
                <span
                  key={d.dia}
                  className="calendario__dia"
                  data-tom={d.valor.tom}
                  title={`${d.dia.split('-').reverse().join('/')}: ${d.valor.descricao}`}
                />
              ))}
            </span>
          </div>
        ))}
      </div>
      <figcaption className="nota">{legenda}</figcaption>
    </figure>
  );
}

export const ESTAGIOS = ['Prometida', 'Ato', 'Orçamento', 'Execução', 'Entrega'] as const;

/** A cadeia de entrega de uma promessa, acesa até o estágio que tem evidência confirmada. */
export function CadeiaDeEntrega({ alcancados }: { alcancados: number }): ReactNode {
  return (
    <ol className="cadeia" aria-label="Cadeia de entrega">
      {ESTAGIOS.map((estagio, i) => (
        <li key={estagio} className="cadeia__estagio" data-aceso={i < alcancados}>
          {estagio}
        </li>
      ))}
    </ol>
  );
}
