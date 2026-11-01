import 'server-only';

import { criarAcesso, type Sessao as SessaoDeAcesso } from '@prometeu/acesso';
import { redirect } from 'next/navigation';

import { configuracao } from './configuracao';

const PAPEIS_EDITORIAIS = ['curador', 'revisor', 'editor_chefe'] as const;
export type PapelEditorial = (typeof PAPEIS_EDITORIAIS)[number];
export type Sessao = SessaoDeAcesso<PapelEditorial>;

/** O login do painel (ADR-0014): o cliente `curadoria` no provedor e um cookie só do painel. */
export const acesso = criarAcesso({
  configuracao: {
    get endereco() {
      return configuracao.enderecoDoPainel;
    },
    get emissor() {
      return configuracao.emissor;
    },
    get clienteId() {
      return configuracao.clienteId;
    },
    get clienteSegredo() {
      return configuracao.clienteSegredo;
    },
    get segredoDaSessao() {
      return configuracao.segredoDaSessao;
    },
  },
  papeis: PAPEIS_EDITORIAIS,
  cookie: 'prometeu_painel',
});

export function sessaoAtual(): Promise<Sessao | undefined> {
  return acesso.sessaoAtual();
}

/** Para páginas e ações: sem sessão com papel editorial, volta para o login. */
export async function exigirSessao(): Promise<Sessao> {
  const sessao = await acesso.sessaoAtual();
  if (!sessao || sessao.papeis.length === 0) redirect('/entrar');
  return sessao;
}
