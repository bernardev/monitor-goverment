import 'server-only';

import { criarAcesso, type Sessao as SessaoDeAcesso } from '@prometeu/acesso';

/** Fora de produção, o Keycloak local de infra/docker (ADR-0014); em produção, tudo explícito. */
function ler(nome: string, padraoLocal: string): string {
  const valor = process.env[nome];
  if (valor) return valor;
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error(`Defina ${nome}: em produção não há valor padrão.`);
  }
  return padraoLocal;
}

export type Sessao = SessaoDeAcesso<'cidadao'>;

/** O login do cidadão no site: o cliente `site` no provedor e um cookie só do site. */
export const acesso = criarAcesso({
  configuracao: {
    get endereco() {
      return ler('SITE_URL', 'http://localhost:3001');
    },
    get emissor() {
      return ler('IDENTIDADE_EMISSOR', 'http://localhost:8080/realms/prometeu');
    },
    get clienteId() {
      return ler('SITE_CLIENTE_ID', 'site');
    },
    get clienteSegredo() {
      return ler('SITE_CLIENTE_SEGREDO', 'desenvolvimento');
    },
    get segredoDaSessao() {
      return ler('SITE_SEGREDO_DA_SESSAO', 'desenvolvimento-local-nao-use-em-producao');
    },
  },
  papeis: ['cidadao'],
  cookie: 'prometeu_site',
});

/** A sessão de quem tem conta de cidadão; outra conta (só editorial) conta como sem login aqui. */
export async function sessaoDoCidadao(): Promise<Sessao | undefined> {
  const sessao = await acesso.sessaoAtual();
  return sessao?.papeis.includes('cidadao') ? sessao : undefined;
}
