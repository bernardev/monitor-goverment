import type { NextRequest, NextResponse } from 'next/server';

import { COOKIE_DE_BOAS_VINDAS, loginConcluido } from '../_componentes/tour-regras';
import { acesso } from '../_sessao/sessao';

/**
 * Volta do provedor: confere estado e PKCE, abre a sessão e volta para onde a pessoa estava. Com o
 * login concluído, deixa um aviso curto para o navegador abrir o tour de boas-vindas.
 */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  const resposta = await acesso.retorno(requisicao);
  if (loginConcluido(resposta.headers.get('location'))) {
    resposta.cookies.set(COOKIE_DE_BOAS_VINDAS, '1', { path: '/', maxAge: 600, sameSite: 'lax' });
  }
  return resposta;
}
