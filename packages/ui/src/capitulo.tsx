import type { ReactNode } from 'react';

/** As cores do site; cada uma significa um assunto (ADR-0017). */
export type Campo = 'papel' | 'grafite' | 'aco' | 'areia';

/**
 * Um capítulo: largura inteira, uma cor plana e um verbo no pretérito como título, sozinho na
 * linha. Abaixo dele, a frase com os números e, ao lado, o que a prova: uma barra, um calendário.
 * Sem `ao lado` nem conteúdo, o capítulo encolhe: um fato que não houve não ocupa uma tela.
 */
export function Capitulo({
  id,
  campo,
  verbo,
  frase,
  aoLado,
  nota,
  children,
}: {
  id: string;
  campo: Campo;
  /** `Votou.`: com o ponto, porque é uma frase. */
  verbo: string;
  /** A frase que o verbo abre, com os números. */
  frase: ReactNode;
  aoLado?: ReactNode;
  /** De onde vem e o que a contagem cobre; fecha o capítulo. */
  nota?: ReactNode;
  children?: ReactNode;
}): ReactNode {
  const vazio = aoLado === undefined && children === undefined;
  return (
    <section
      id={id}
      className="capitulo"
      data-campo={campo}
      data-vazio={vazio}
      aria-labelledby={`${id}-verbo`}
    >
      <h2 id={`${id}-verbo`} className="verbo capitulo__verbo surge">
        {verbo}
      </h2>
      <div className="capitulo__miolo">
        <p className="destaque capitulo__frase surge">{frase}</p>
        {aoLado !== undefined && <div className="capitulo__lado surge">{aoLado}</div>}
      </div>
      {children !== undefined && <div className="capitulo__resto surge">{children}</div>}
      {nota !== undefined && <div className="capitulo__nota nota">{nota}</div>}
    </section>
  );
}
