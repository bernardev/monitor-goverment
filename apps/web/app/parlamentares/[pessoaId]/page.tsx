import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { buscarParlamentar } from '../../_api/cliente';
import { Fonte } from '../../_componentes/fonte';
import { data, nomeDoCargo } from '../../_componentes/formatacao';

interface Props {
  readonly params: Promise<{ pessoaId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const perfil = await buscarParlamentar((await params).pessoaId);
  return { title: perfil ? `${perfil.nome} | Prometeu` : 'Parlamentar não encontrado | Prometeu' };
}

export default async function PerfilDoParlamentar({ params }: Props): Promise<ReactNode> {
  const perfil = await buscarParlamentar((await params).pessoaId);
  if (!perfil) notFound();

  return (
    <main>
      <p>
        <Link href="/parlamentares">← Parlamentares</Link>
      </p>
      <article>
        <header className="perfil">
          {perfil.urlDaFoto && (
            <img
              src={perfil.urlDaFoto}
              alt={`Foto oficial de ${perfil.nome}`}
              width={120}
              height={160}
            />
          )}
          <div>
            <h1>{perfil.nome}</h1>
            <p>
              {nomeDoCargo(perfil.cargo)}
              {perfil.uf ? ` por ${perfil.uf}` : ''} · {perfil.siglaPartido ?? 'sem partido'}
            </p>
          </div>
        </header>
        <Fonte fonte={perfil.fonte} />

        {perfil.mandato && (
          <section>
            <h2>Mandato</h2>
            <p>
              {nomeDoCargo(perfil.mandato.cargo)}, de {data(perfil.mandato.inicio)}
              {perfil.mandato.fim ? ` a ${data(perfil.mandato.fim)}` : ' (em curso)'}.
            </p>
            <Fonte fonte={perfil.mandato.fonte} />
          </section>
        )}
      </article>
    </main>
  );
}
