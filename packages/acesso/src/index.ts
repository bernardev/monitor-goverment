import 'server-only';

import { createHash } from 'node:crypto';

import { decodeJwt, EncryptJWT, jwtDecrypt } from 'jose';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import * as oidc from 'openid-client';

import { caminhoDeVolta } from './volta';

export { caminhoDeVolta } from './volta';

/** O que muda de um app para outro. Lido a cada uso: o ambiente só existe em tempo de execução. */
export interface ConfiguracaoDeAcesso {
  /** Endereço público do app, sem barra no fim: `http://localhost:3002`. */
  readonly endereco: string;
  readonly emissor: string;
  readonly clienteId: string;
  readonly clienteSegredo: string;
  /** Ao menos 32 caracteres; cifra o cookie da sessão. */
  readonly segredoDaSessao: string;
}

/**
 * A sessão num cookie cifrado (JWE) e `httpOnly`: os tokens ficam no servidor do app e nunca chegam
 * ao JavaScript do navegador (ADR-0014).
 */
export interface Sessao<P extends string> {
  readonly tokenDeAcesso: string;
  readonly tokenDeRenovacao: string;
  /** Segundos desde a época Unix. */
  readonly expiraEm: number;
  readonly pessoaId: string;
  readonly nome: string;
  /** Só os papéis que o app reconhece. */
  readonly papeis: readonly P[];
}

export interface Acesso<P extends string> {
  /** Sessão válida, renovando o token quando faltar menos de 30 s; `undefined` sem login. */
  sessaoAtual(): Promise<Sessao<P> | undefined>;
  /** `GET /entrar?volta=/caminho`: começa o login no provedor. */
  entrar(requisicao: NextRequest): Promise<NextResponse>;
  /** `GET /retorno`: troca o código pelos tokens, conferindo estado e PKCE, e abre a sessão. */
  retorno(requisicao: NextRequest): Promise<NextResponse>;
  /** `POST /sair`: fecha a sessão aqui e no provedor. POST para que um link de outro site não deslogue. */
  sair(): Promise<NextResponse>;
}

/**
 * Login OIDC com código de autorização e PKCE, e a sessão em cookie, para um app Next. Cada app tem o
 * seu cliente no provedor e o seu cookie: no `localhost`, cookies valem para todas as portas.
 */
export function criarAcesso<P extends string>(opcoes: {
  readonly configuracao: ConfiguracaoDeAcesso;
  readonly papeis: readonly P[];
  /** Nome do cookie da sessão; o do login em curso é o mesmo com `_login`. */
  readonly cookie: string;
}): Acesso<P> {
  const { configuracao, papeis } = opcoes;
  const cookieDoLogin = `${opcoes.cookie}_login`;
  const seguro = () => configuracao.endereco.startsWith('https://');
  const retornoNoApp = () => `${configuracao.endereco}/retorno`;
  const chave = () => createHash('sha256').update(configuracao.segredoDaSessao).digest();

  let descoberta: Promise<oidc.Configuration> | undefined;
  /** Metadados do provedor (OIDC discovery), buscados uma vez por processo. */
  const provedor = (): Promise<oidc.Configuration> => {
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
  };

  const cifrar = (conteudo: Record<string, unknown>, validade: string) =>
    new EncryptJWT(conteudo)
      .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
      .setIssuedAt()
      .setExpirationTime(validade)
      .encrypt(chave());

  const decifrar = async (valor: string): Promise<Record<string, unknown> | undefined> => {
    try {
      return (await jwtDecrypt(valor, chave())).payload;
    } catch {
      return undefined;
    }
  };

  /** O token de acesso traz a pessoa e os papéis; o app só guarda os que reconhece. */
  const sessaoDosTokens = (tokenDeAcesso: string, tokenDeRenovacao: string): Sessao<P> => {
    const conteudo = decodeJwt(tokenDeAcesso) as {
      sub?: string;
      exp?: number;
      name?: string;
      preferred_username?: string;
      realm_access?: { roles?: string[] };
    };
    const declarados = conteudo.realm_access?.roles ?? [];
    return {
      tokenDeAcesso,
      tokenDeRenovacao,
      expiraEm: conteudo.exp ?? 0,
      pessoaId: conteudo.sub ?? '',
      nome: conteudo.name ?? conteudo.preferred_username ?? 'Pessoa sem nome',
      papeis: papeis.filter((papel) => declarados.includes(papel)),
    };
  };

  const gravarSessao = async (sessao: Sessao<P>) => {
    (await cookies()).set(opcoes.cookie, await cifrar({ ...sessao }, '10h'), {
      httpOnly: true,
      sameSite: 'lax',
      secure: seguro(),
      path: '/',
      maxAge: 10 * 60 * 60,
    });
  };

  const voltarPara = (caminho: string) =>
    NextResponse.redirect(new URL(caminho, configuracao.endereco));

  return {
    async sessaoAtual() {
      const valor = (await cookies()).get(opcoes.cookie)?.value;
      const sessao = valor ? ((await decifrar(valor)) as Sessao<P> | undefined) : undefined;
      if (!sessao) return undefined;
      if (sessao.expiraEm - 30 > Date.now() / 1000) return sessao;
      let renovada: Sessao<P>;
      try {
        const tokens = await oidc.refreshTokenGrant(await provedor(), sessao.tokenDeRenovacao);
        renovada = sessaoDosTokens(
          tokens.access_token,
          tokens.refresh_token ?? sessao.tokenDeRenovacao,
        );
      } catch {
        return undefined;
      }
      // Em páginas o Next não deixa gravar cookie; a renovação vale para esta requisição e é gravada
      // na próxima ação (formulário) ou rota.
      try {
        await gravarSessao(renovada);
      } catch {
        /* página: segue com a sessão renovada só em memória */
      }
      return renovada;
    },

    async entrar(requisicao) {
      const verificador = oidc.randomPKCECodeVerifier();
      const estado = oidc.randomState();
      const url = oidc.buildAuthorizationUrl(await provedor(), {
        redirect_uri: retornoNoApp(),
        scope: 'openid profile',
        code_challenge: await oidc.calculatePKCECodeChallenge(verificador),
        code_challenge_method: 'S256',
        state: estado,
      });
      const volta = caminhoDeVolta(requisicao.nextUrl.searchParams.get('volta'));
      (await cookies()).set(cookieDoLogin, await cifrar({ verificador, estado, volta }, '10m'), {
        httpOnly: true,
        sameSite: 'lax',
        secure: seguro(),
        path: '/',
        maxAge: 600,
      });
      return NextResponse.redirect(url);
    },

    async retorno(requisicao) {
      const jarra = await cookies();
      const login = await decifrar(jarra.get(cookieDoLogin)?.value ?? '');
      jarra.delete(cookieDoLogin);
      const { verificador, estado, volta } = login ?? {};
      if (typeof verificador !== 'string' || typeof estado !== 'string') {
        return voltarPara('/?erro=login_expirado');
      }
      // O endereço público do app, não o interno do servidor, é o que o provedor conhece.
      const url = new URL(retornoNoApp());
      url.search = requisicao.nextUrl.search;
      try {
        const resposta = await oidc.authorizationCodeGrant(await provedor(), url, {
          pkceCodeVerifier: verificador,
          expectedState: estado,
        });
        if (!resposta.refresh_token) throw new Error('Provedor não devolveu token de renovação.');
        await gravarSessao(sessaoDosTokens(resposta.access_token, resposta.refresh_token));
      } catch {
        return voltarPara('/?erro=login_recusado');
      }
      return voltarPara(caminhoDeVolta(typeof volta === 'string' ? volta : '/'));
    },

    async sair() {
      (await cookies()).delete(opcoes.cookie);
      const saida = oidc.buildEndSessionUrl(await provedor(), {
        client_id: configuracao.clienteId,
        post_logout_redirect_uri: configuracao.endereco,
      });
      return NextResponse.redirect(saida, 303);
    },
  };
}
