import type { NextRequest, NextResponse } from 'next/server';

import { acesso } from '../_sessao/sessao';

/** Volta do provedor: confere estado e PKCE, abre a sessão e volta para onde a pessoa estava. */
export function GET(requisicao: NextRequest): Promise<NextResponse> {
  return acesso.retorno(requisicao);
}
