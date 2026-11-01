import type { NextRequest, NextResponse } from 'next/server';

import { acesso } from '../_sessao/sessao';

/** Começa o login no Keycloak. Verificador PKCE e estado ficam num cookie cifrado de 10 minutos. */
export function GET(requisicao: NextRequest): Promise<NextResponse> {
  return acesso.entrar(requisicao);
}
