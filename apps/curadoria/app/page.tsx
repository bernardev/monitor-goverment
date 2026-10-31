import Link from 'next/link';
import type { ReactNode } from 'react';

import { editorial } from './_api/cliente';
import { ESTAGIOS, rotulo, VEREDITOS } from './_componentes/rotulos';
import { sessaoAtual } from './_sessao/sessao';

const ERROS: Readonly<Record<string, string>> = {
  login_expirado: 'O login demorou demais. Tente de novo.',
  login_recusado: 'Não foi possível concluir o login. Tente de novo.',
};

interface Props {
  readonly searchParams: Promise<{ erro?: string }>;
}

export default async function PainelEditorial({ searchParams }: Props): Promise<ReactNode> {
  const sessao = await sessaoAtual();
  const { erro } = await searchParams;

  if (!sessao || sessao.papeis.length === 0) {
    return (
      <main>
        <h1>Painel editorial</h1>
        {erro && <p role="alert">{ERROS[erro] ?? 'Não foi possível entrar.'}</p>}
        {sessao && <p>Sua conta não tem papel editorial.</p>}
        <p>
          <a href="/entrar">Entrar</a>
        </p>
      </main>
    );
  }

  const promessas = await editorial.listar();
  return (
    <main>
      <header className="topo">
        <h1>Painel editorial</h1>
        <form method="post" action="/sair">
          {sessao.nome} ({sessao.papeis.join(', ')}) <button type="submit">Sair</button>
        </form>
      </header>
      {sessao.papeis.includes('curador') && (
        <p>
          <Link href="/promessas/nova">Registrar promessa</Link>
        </p>
      )}
      <table>
        <thead>
          <tr>
            <th>Promessa</th>
            <th>Estágio</th>
            <th>Veredito</th>
            <th>Pendências</th>
          </tr>
        </thead>
        <tbody>
          {promessas.map((p) => (
            <tr key={p.promessaId}>
              <td>
                <Link href={`/promessas/${p.promessaId}`}>{p.texto}</Link>
              </td>
              <td>{rotulo(ESTAGIOS, p.estagio)}</td>
              <td>{rotulo(VEREDITOS, p.vereditoVigente)}</td>
              <td>
                {[
                  p.aguardandoRevisao ? 'Veredito aguardando revisão' : '',
                  p.reavaliacoesPendentes > 0
                    ? `${String(p.reavaliacoesPendentes)} ${p.reavaliacoesPendentes === 1 ? 'fato mudou' : 'fatos mudaram'}`
                    : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {promessas.length === 0 && <p>Nenhuma promessa registrada ainda.</p>}
    </main>
  );
}
