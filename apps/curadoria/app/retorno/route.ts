import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { configuracao } from '../_sessao/configuracao';
import { concluirLogin, enderecoDeRetorno } from '../_sessao/oidc';
import { COOKIE_DO_LOGIN, decifrar, gravarSessao, sessaoDosTokens } from '../_sessao/sessao';

/** Volta do Keycloak: troca o código pelos tokens, conferindo estado e PKCE, e abre a sessão. */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  const jarra = await cookies();
  const login = await decifrar(jarra.get(COOKIE_DO_LOGIN)?.value ?? '');
  jarra.delete(COOKIE_DO_LOGIN);
  const verificador = login?.['verificador'];
  const estado = login?.['estado'];
  if (typeof verificador !== 'string' || typeof estado !== 'string') {
    return NextResponse.redirect(new URL('/?erro=login_expirado', configuracao.enderecoDoPainel));
  }

  // O endereço público do painel, não o interno do servidor, é o que o provedor conhece.
  const url = new URL(enderecoDeRetorno());
  url.search = requisicao.nextUrl.search;
  try {
    const tokens = await concluirLogin(url, verificador, estado);
    if (!tokens.tokenDeRenovacao) throw new Error('Provedor não devolveu token de renovação.');
    await gravarSessao(sessaoDosTokens(tokens.tokenDeAcesso, tokens.tokenDeRenovacao));
  } catch {
    return NextResponse.redirect(new URL('/?erro=login_recusado', configuracao.enderecoDoPainel));
  }
  return NextResponse.redirect(new URL('/', configuracao.enderecoDoPainel));
}
