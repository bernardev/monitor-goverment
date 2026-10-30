import 'server-only';

import { createHash } from 'node:crypto';

import { decodeJwt, EncryptJWT, jwtDecrypt } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { configuracao } from './configuracao';
import { renovar } from './oidc';

const COOKIE = 'prometeu_sessao';
/** Verificador PKCE e estado entre a ida ao provedor e a volta. */
export const COOKIE_DO_LOGIN = 'prometeu_login';
const PAPEIS_EDITORIAIS = ['curador', 'revisor', 'editor_chefe'] as const;
export type PapelEditorial = (typeof PAPEIS_EDITORIAIS)[number];

/**
 * Sessão do painel num cookie cifrado (JWE) e `httpOnly`: os tokens ficam no servidor do painel e
 * nunca chegam ao JavaScript do navegador (ADR-0014).
 */
export interface Sessao {
  readonly tokenDeAcesso: string;
  readonly tokenDeRenovacao: string;
  /** Segundos desde a época Unix. */
  readonly expiraEm: number;
  readonly pessoaId: string;
  readonly nome: string;
  readonly papeis: readonly PapelEditorial[];
}

function chave(): Uint8Array {
  return createHash('sha256').update(configuracao.segredoDaSessao).digest();
}

export async function cifrar(conteudo: Record<string, unknown>, validade: string): Promise<string> {
  return new EncryptJWT(conteudo)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(validade)
    .encrypt(chave());
}

export async function decifrar(valor: string): Promise<Record<string, unknown> | undefined> {
  try {
    return (await jwtDecrypt(valor, chave())).payload;
  } catch {
    return undefined;
  }
}

/** Monta a sessão a partir dos tokens do provedor; o token de acesso traz pessoa e papéis. */
export function sessaoDosTokens(tokenDeAcesso: string, tokenDeRenovacao: string): Sessao {
  const conteudo = decodeJwt(tokenDeAcesso) as {
    sub?: string;
    exp?: number;
    name?: string;
    preferred_username?: string;
    realm_access?: { roles?: string[] };
  };
  const declarados = conteudo.realm_access?.roles ?? [];
  return {
    tokenDeAcesso,
    tokenDeRenovacao,
    expiraEm: conteudo.exp ?? 0,
    pessoaId: conteudo.sub ?? '',
    nome: conteudo.name ?? conteudo.preferred_username ?? 'Pessoa sem nome',
    papeis: PAPEIS_EDITORIAIS.filter((papel) => declarados.includes(papel)),
  };
}

export async function gravarSessao(sessao: Sessao): Promise<void> {
  (await cookies()).set(COOKIE, await cifrar({ ...sessao }, '10h'), {
    httpOnly: true,
    sameSite: 'lax',
    secure: configuracao.enderecoDoPainel.startsWith('https://'),
    path: '/',
    maxAge: 10 * 60 * 60,
  });
}

export async function apagarSessao(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** Sessão válida, renovando o token de acesso quando faltar menos de 30 s; `undefined` sem login. */
export async function sessaoAtual(): Promise<Sessao | undefined> {
  const valor = (await cookies()).get(COOKIE)?.value;
  const sessao = valor ? ((await decifrar(valor)) as Sessao | undefined) : undefined;
  if (!sessao) return undefined;
  if (sessao.expiraEm - 30 > Date.now() / 1000) return sessao;
  let renovada: Sessao;
  try {
    const tokens = await renovar(sessao.tokenDeRenovacao);
    renovada = sessaoDosTokens(
      tokens.tokenDeAcesso,
      tokens.tokenDeRenovacao ?? sessao.tokenDeRenovacao,
    );
  } catch {
    return undefined;
  }
  // Em páginas o Next não deixa gravar cookie; a renovação vale para esta requisição e é gravada na
  // próxima ação (formulário) ou rota.
  try {
    await gravarSessao(renovada);
  } catch {
    /* página: segue com a sessão renovada só em memória */
  }
  return renovada;
}

/** Para páginas e ações: sem sessão com papel editorial, volta para o login. */
export async function exigirSessao(): Promise<Sessao> {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.papeis.length === 0) redirect('/entrar');
  return sessao;
}
