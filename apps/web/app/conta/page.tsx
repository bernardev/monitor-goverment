import type { AcompanhamentoDoCidadao } from '@prometeu/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { acompanhamentos } from '../_api/conta';
import { data } from '../_componentes/formatacao';
import { PaginaDeLista } from '../_componentes/pagina-de-lista';
import { sessaoDoCidadao } from '../_sessao/sessao';
import { alternarAcompanhamento, apagarMeusDados } from './acoes';

export const metadata: Metadata = {
  title: 'Minha conta | Prometeu',
  robots: { index: false, follow: false },
};

interface Props {
  readonly searchParams: Promise<{ erro?: string; apagado?: string }>;
}

const ENDERECO: Readonly<Record<AcompanhamentoDoCidadao['tipo'], string>> = {
  parlamentar: '/parlamentares',
  municipio: '/municipios',
};

export default async function MinhaConta({ searchParams }: Props): Promise<ReactNode> {
  const { erro, apagado } = await searchParams;
  const sessao = await sessaoDoCidadao();

  if (sessao === null) {
    return (
      <PaginaDeLista titulo="Minha conta">
        <p>
          Você entrou com uma conta da equipe, sem o papel de cidadão, e por isso ela não acompanha
          políticos nem cidades no site. Saia e entre com uma conta de cidadão, ou peça à
          administração que dê esse papel à sua conta.
        </p>
        <form method="post" action="/sair">
          <button type="submit" className="botao botao--secundario">
            Sair
          </button>
        </form>
      </PaginaDeLista>
    );
  }

  if (!sessao) {
    return (
      <PaginaDeLista titulo="Minha conta">
        <p>
          Com uma conta gratuita, você acompanha os políticos e as cidades que quiser e encontra
          todos em um lugar só. A conta guarda só o que você acompanha: nada de nome, CPF ou
          endereço.
        </p>
        <p>
          <a href="/entrar?volta=/conta" className="botao">
            Entrar ou criar conta
          </a>
        </p>
      </PaginaDeLista>
    );
  }

  const itens = await acompanhamentos(sessao);
  const politicos = itens.filter((a) => a.tipo === 'parlamentar');
  const cidades = itens.filter((a) => a.tipo === 'municipio');

  return (
    <PaginaDeLista titulo="Minha conta">
      <p>Você entrou como {sessao.nome}.</p>
      {apagado && <p role="status">Pronto: apagamos tudo o que você acompanhava.</p>}

      <section aria-labelledby="politicos">
        <h2 id="politicos">Políticos que acompanho</h2>
        <Lista
          itens={politicos}
          vazio={
            <>
              Nenhum ainda. Abra a página de um <Link href="/parlamentares">parlamentar</Link> e
              clique em Acompanhar.
            </>
          }
        />
      </section>

      <section aria-labelledby="cidades">
        <h2 id="cidades">Cidades que acompanho</h2>
        <Lista
          itens={cidades}
          vazio={
            <>
              Nenhuma ainda. <Link href="/municipios">Procure sua cidade</Link> e clique em
              Acompanhar.
            </>
          }
        />
      </section>

      <section aria-labelledby="dados">
        <h2 id="dados">Seus dados</h2>
        <p>
          A plataforma guarda só a lista acima, ligada ao identificador do seu login. Apagar leva a
          lista inteira, sem volta; a conta de login continua existindo e pode ser usada de novo.
        </p>
        {erro === 'confirmacao' && <p role="alert">Marque a confirmação para apagar.</p>}
        <form action={apagarMeusDados} className="pilha">
          <label className="confirmacao">
            <input type="checkbox" name="confirmo" value="sim" required /> Quero apagar tudo o que
            acompanho
          </label>
          <p>
            <button type="submit" className="botao">
              Apagar meus dados
            </button>
          </p>
        </form>
        <form method="post" action="/sair">
          <button type="submit" className="botao botao--secundario">
            Sair
          </button>
        </form>
      </section>
    </PaginaDeLista>
  );
}

function Lista({
  itens,
  vazio,
}: {
  itens: readonly AcompanhamentoDoCidadao[];
  vazio: ReactNode;
}): ReactNode {
  if (itens.length === 0) return <p>{vazio}</p>;
  return (
    <ul className="lista">
      {itens.map((a) => (
        <li key={`${a.tipo}:${a.id}`}>
          <Link href={`${ENDERECO[a.tipo]}/${a.id}`}>{a.titulo ?? 'Não está mais na base'}</Link>
          <span>
            {a.detalhe ? `${a.detalhe} · ` : ''}desde {data(a.desde)}
          </span>
          <form action={alternarAcompanhamento.bind(null, a.tipo, a.id, '/conta', true)}>
            <button type="submit" className="botao--texto">
              Deixar de acompanhar
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
