'use client';

import { Chapeu } from '@prometeu/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Uma fonte ou a API fora do ar não pode virar tela em branco: diz o que houve, sem detalhe técnico,
 * e deixa tentar de novo.
 */
export default function Erro({ reset }: { error: Error; reset: () => void }): ReactNode {
  return (
    <main className="reportagem editoria">
      <header className="editoria__topo">
        <Chapeu>Erro</Chapeu>
        <h1>Não conseguimos carregar esta página</h1>
        <p className="editoria__descricao">
          Os dados continuam guardados; costuma ser uma falha passageira ao consultá-los. Tente de
          novo em instantes.
        </p>
        <p>
          <button type="button" className="botao" onClick={reset}>
            Tentar de novo
          </button>
        </p>
        <p>
          <Link href="/">Voltar ao início</Link>
        </p>
      </header>
    </main>
  );
}
