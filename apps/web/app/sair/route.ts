import type { NextResponse } from 'next/server';

import { acesso } from '../_sessao/sessao';

/** POST, e não GET: um link ou imagem de outro site não consegue deslogar ninguém. */
export function POST(): Promise<NextResponse> {
  return acesso.sair();
}
