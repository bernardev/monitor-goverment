import { Chapeu } from '@prometeu/ui';
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
      <main className="reportagem painel">
        <header className="editoria__topo">
          <Chapeu>Curadoria</Chapeu>
          <h1>Painel editorial</h1>
        </header>
        {erro && <p role="alert">{ERROS[erro] ?? 'Não foi possível entrar.'}</p>}
        {sessao && <p>Sua conta não tem papel editorial.</p>}
        <p>
          <a href="/entrar" className="botao">
            Entrar
          </a>
        </p>
      </main>
    );
  }

  const promessas = await editorial.listar();
  return (
    <main className="reportagem painel">
      <header className="editoria__topo">
        <Chapeu>Curadoria</Chapeu>
        <h1>Promessas</h1>
        <p className="editoria__descricao">
          Você entrou como {sessao.nome} ({sessao.papeis.join(', ')}). As pendências mostram o que
          espera revisão e os fatos que mudaram desde a última análise.
        </p>
        {sessao.papeis.includes('curador') && (
          <Link href="/promessas/nova" className="botao">
            Registrar promessa
          </Link>
        )}
      </header>
      <div className="rolagem">
        <table className="tabela">
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
                <td data-rotulo="Estágio:">{rotulo(ESTAGIOS, p.estagio)}</td>
                <td data-rotulo="Veredito:">{rotulo(VEREDITOS, p.vereditoVigente)}</td>
                <td data-rotulo="Pendências:">
                  {[
                    p.aguardandoRevisao ? 'Veredito aguardando revisão' : '',
                    p.reavaliacoesPendentes > 0
                      ? `${String(p.reavaliacoesPendentes)} ${p.reavaliacoesPendentes === 1 ? 'fato mudou' : 'fatos mudaram'}`
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {promessas.length === 0 && <p>Nenhuma promessa registrada ainda.</p>}
    </main>
  );
}
