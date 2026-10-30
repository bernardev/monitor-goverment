import { createRemoteJWKSet, type JWTPayload, jwtVerify, type JWTVerifyGetKey } from 'jose';

/** Papéis do realm `prometeu` (ADR-0014). Qualquer outro papel no token é ignorado. */
export const PAPEIS = ['cidadao', 'curador', 'revisor', 'editor_chefe', 'administrador'] as const;
export type Papel = (typeof PAPEIS)[number];

export interface Usuario {
  /** `sub` do token: UUID estável da pessoa no provedor, usado como `CuradorId` no domínio. */
  readonly id: string;
  readonly nome: string;
  readonly papeis: readonly Papel[];
}

export class TokenInvalido extends Error {}

export interface ConfiguracaoDoVerificador {
  /** URL do realm, ex.: `http://localhost:8080/realms/prometeu`. */
  readonly emissor: string;
  readonly audiencia: string;
  /** Chaves públicas; por padrão, as publicadas pelo emissor (JWKS). */
  readonly chaves?: JWTVerifyGetKey;
}

interface ConteudoDoKeycloak extends JWTPayload {
  readonly realm_access?: { readonly roles?: unknown };
  readonly name?: unknown;
  readonly preferred_username?: unknown;
}

/**
 * Confere assinatura, emissor, audiência e validade do token de acesso (ADR-0014). As chaves do emissor
 * ficam em cache e são renovadas quando o provedor as troca.
 */
export class VerificadorDeToken {
  private readonly chaves: JWTVerifyGetKey;

  constructor(private readonly configuracao: ConfiguracaoDoVerificador) {
    this.chaves =
      configuracao.chaves ??
      createRemoteJWKSet(new URL(`${configuracao.emissor}/protocol/openid-connect/certs`));
  }

  async verificar(token: string): Promise<Usuario> {
    let conteudo: ConteudoDoKeycloak;
    try {
      ({ payload: conteudo } = await jwtVerify<ConteudoDoKeycloak>(token, this.chaves, {
        issuer: this.configuracao.emissor,
        audience: this.configuracao.audiencia,
        algorithms: ['RS256', 'ES256'],
      }));
    } catch (erro) {
      throw new TokenInvalido(erro instanceof Error ? erro.message : 'Token inválido.');
    }
    if (typeof conteudo.sub !== 'string') throw new TokenInvalido('Token sem identificação.');

    const declarados = conteudo.realm_access?.roles;
    const papeis = Array.isArray(declarados)
      ? PAPEIS.filter((papel) => declarados.includes(papel))
      : [];
    const nome =
      typeof conteudo.name === 'string'
        ? conteudo.name
        : typeof conteudo.preferred_username === 'string'
          ? conteudo.preferred_username
          : conteudo.sub;
    return { id: conteudo.sub, nome, papeis };
  }
}
