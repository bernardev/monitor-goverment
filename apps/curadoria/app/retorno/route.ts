import type { NextRequest, NextResponse } from 'next/server';

import { acesso } from '../_sessao/sessao';

/** Volta do Keycloak: troca o código pelos tokens, conferindo estado e PKCE, e abre a sessão. */
export function GET(requisicao: NextRequest): Promise<NextResponse> {
  return acesso.retorno(requisicao);
}
