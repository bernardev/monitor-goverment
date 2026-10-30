import 'server-only';

import * as oidc from 'openid-client';

import { configuracao } from './configuracao';

let descoberta: Promise<oidc.Configuration> | undefined;

/** Metadados do provedor (OIDC discovery), buscados uma vez por processo. */
function provedor(): Promise<oidc.Configuration> {
  descoberta ??= oidc
    .discovery(
      new URL(configuracao.emissor),
      configuracao.clienteId,
      configuracao.clienteSegredo,
      undefined,
      // HTTP só no Keycloak local; em produção o emissor é https. A biblioteca marca a função como
      // obsoleta justamente para que esse uso salte aos olhos.
      configuracao.emissor.startsWith('http://localhost')
        ? // eslint-disable-next-line @typescript-eslint/no-deprecated
          { execute: [oidc.allowInsecureRequests] }
        : undefined,
    )
    .catch((erro: unknown) => {
      descoberta = undefined;
      throw erro;
    });
  return descoberta;
}

export const enderecoDeRetorno = (): string => `${configuracao.enderecoDoPainel}/retorno`;

export interface InicioDoLogin {
  readonly url: URL;
  readonly verificador: string;
  readonly estado: string;
}

/** Fluxo de código de autorização com PKCE (ADR-0014). */
export async function iniciarLogin(): Promise<InicioDoLogin> {
  const verificador = oidc.randomPKCECodeVerifier();
  const estado = oidc.randomState();
  const url = oidc.buildAuthorizationUrl(await provedor(), {
    redirect_uri: enderecoDeRetorno(),
    scope: 'openid profile',
    code_challenge: await oidc.calculatePKCECodeChallenge(verificador),
    code_challenge_method: 'S256',
    state: estado,
  });
  return { url, verificador, estado };
}

export interface Tokens {
  readonly tokenDeAcesso: string;
  readonly tokenDeRenovacao: string | undefined;
}

export async function concluirLogin(
  urlDeRetorno: URL,
  verificador: string,
  estado: string,
): Promise<Tokens> {
  const resposta = await oidc.authorizationCodeGrant(await provedor(), urlDeRetorno, {
    pkceCodeVerifier: verificador,
    expectedState: estado,
  });
  return { tokenDeAcesso: resposta.access_token, tokenDeRenovacao: resposta.refresh_token };
}

export async function renovar(tokenDeRenovacao: string): Promise<Tokens> {
  const resposta = await oidc.refreshTokenGrant(await provedor(), tokenDeRenovacao);
  return { tokenDeAcesso: resposta.access_token, tokenDeRenovacao: resposta.refresh_token };
}

/** Encerra também a sessão no provedor, para que "sair" valha de fato. */
export async function enderecoDeSaida(): Promise<URL> {
  return oidc.buildEndSessionUrl(await provedor(), {
    client_id: configuracao.clienteId,
    post_logout_redirect_uri: configuracao.enderecoDoPainel,
  });
}
