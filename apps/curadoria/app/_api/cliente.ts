import 'server-only';

import type {
  Pagina,
  ParlamentarResumo,
  PerfilDeParlamentar,
  PromessaNaCuradoria,
  ResumoDePromessaNaCuradoria,
} from '@prometeu/contracts';

import { configuracao } from '../_sessao/configuracao';
import { exigirSessao } from '../_sessao/sessao';

/** Resposta de erro da API: regra de negócio (com código), formato ou permissão. */
export class ErroDaApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string | undefined,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

async function chamar<T>(metodo: 'GET' | 'POST', caminho: string, corpo?: unknown): Promise<T> {
  const sessao = await exigirSessao();
  const resposta = await fetch(`${configuracao.api}${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${sessao.tokenDeAcesso}`,
      ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: corpo === undefined ? null : JSON.stringify(corpo),
    cache: 'no-store',
  });
  if (resposta.status === 204) return undefined as T;
  const conteudo = (await resposta.json().catch(() => ({}))) as {
    codigo?: string;
    mensagem?: string;
    problemas?: { campo: string; mensagem: string }[];
  };
  if (!resposta.ok) {
    const problemas = conteudo.problemas?.map((p) => `${p.campo}: ${p.mensagem}`).join('; ');
    throw new ErroDaApi(
      resposta.status,
      conteudo.codigo,
      [conteudo.mensagem ?? `A API respondeu ${resposta.status}.`, problemas]
        .filter(Boolean)
        .join(' '),
    );
  }
  return conteudo as T;
}

export const editorial: {
  listar(): Promise<ResumoDePromessaNaCuradoria[]>;
  buscar(id: string): Promise<PromessaNaCuradoria>;
  capturar(url: string): Promise<{ capturaId: string }>;
  registrar(dados: unknown): Promise<{ promessaId: string }>;
  propor(id: string, dados: unknown): Promise<undefined>;
  publicar(id: string): Promise<{ registroId: string }>;
  recusar(id: string, motivo: string): Promise<undefined>;
} = {
  listar: () => chamar<ResumoDePromessaNaCuradoria[]>('GET', '/v1/editorial/promessas'),
  buscar: (id: string) =>
    chamar<PromessaNaCuradoria>('GET', `/v1/editorial/promessas/${encodeURIComponent(id)}`),
  capturar: (url: string) =>
    chamar<{ capturaId: string }>('POST', '/v1/editorial/capturas', { url }),
  registrar: (dados: unknown) =>
    chamar<{ promessaId: string }>('POST', '/v1/editorial/promessas', dados),
  propor: (id: string, dados: unknown) =>
    chamar<undefined>('POST', `/v1/editorial/promessas/${encodeURIComponent(id)}/vereditos`, dados),
  publicar: (id: string) =>
    chamar<{ registroId: string }>(
      'POST',
      `/v1/editorial/promessas/${encodeURIComponent(id)}/vereditos/publicacao`,
    ),
  recusar: (id: string, motivo: string) =>
    chamar<undefined>(
      'POST',
      `/v1/editorial/promessas/${encodeURIComponent(id)}/vereditos/recusa`,
      {
        motivo,
      },
    ),
};

/** API pública: parlamentares e mandatos, para a curadoria escolher o autor da promessa. */
export const publica = {
  async parlamentares(uf: string): Promise<ParlamentarResumo[]> {
    const busca = new URLSearchParams({ uf, itens: '100' });
    const resposta = await fetch(`${configuracao.api}/v1/parlamentares?${busca.toString()}`, {
      cache: 'no-store',
    });
    if (!resposta.ok) return [];
    return ((await resposta.json()) as Pagina<ParlamentarResumo>).itens.slice();
  },
  async perfil(pessoaId: string): Promise<PerfilDeParlamentar | undefined> {
    const resposta = await fetch(
      `${configuracao.api}/v1/parlamentares/${encodeURIComponent(pessoaId)}`,
      { cache: 'no-store' },
    );
    return resposta.ok ? ((await resposta.json()) as PerfilDeParlamentar) : undefined;
  },
};
