import type { NextRequest, NextResponse } from 'next/server';

import { acesso } from '../_sessao/sessao';

/** Começa o login (ou o cadastro) no provedor; `?volta=` diz para onde voltar. */
export function GET(requisicao: NextRequest): Promise<NextResponse> {
  return acesso.entrar(requisicao);
}
