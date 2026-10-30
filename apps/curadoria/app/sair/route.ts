import { NextResponse } from 'next/server';

import { enderecoDeSaida } from '../_sessao/oidc';
import { apagarSessao } from '../_sessao/sessao';

/** POST, e não GET: um link ou imagem de outro site não consegue deslogar ninguém. */
export async function POST(): Promise<NextResponse> {
  await apagarSessao();
  return NextResponse.redirect(await enderecoDeSaida(), 303);
}
