'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Uma fonte ou a API fora do ar não pode virar tela em branco: diz o que houve, sem detalhe técnico,
 * e deixa tentar de novo.
 */
export default function Erro({ reset }: { error: Error; reset: () => void }): ReactNode {
  return (
    <main className="capitulos">
      <section className="aviso" data-campo="areia" aria-labelledby="aviso">
        <div className="aviso__miolo">
          <h1 id="aviso" className="verbo">
            Falhou.
          </h1>
          <p className="destaque">
            Não conseguimos montar esta página agora. Os dados continuam guardados; costuma ser uma
            falha passageira ao consultá-los.
          </p>
          <p>
            <button type="button" className="botao" onClick={reset}>
              Tentar de novo
            </button>
          </p>
          <p>
            <Link href="/">Voltar ao início</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
