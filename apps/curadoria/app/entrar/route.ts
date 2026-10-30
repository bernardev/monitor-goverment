import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { iniciarLogin } from '../_sessao/oidc';
import { cifrar, COOKIE_DO_LOGIN } from '../_sessao/sessao';

/** Começa o login no Keycloak. Verificador PKCE e estado ficam num cookie cifrado de 10 minutos. */
export async function GET(): Promise<NextResponse> {
  const { url, verificador, estado } = await iniciarLogin();
  (await cookies()).set(COOKIE_DO_LOGIN, await cifrar({ verificador, estado }, '10m'), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return NextResponse.redirect(url);
}
