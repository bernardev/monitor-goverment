import 'server-only';

import type {
  FrequenciaDoParlamentar,
  Pagina,
  ParlamentarResumo,
  PerfilDeParlamentar,
} from '@prometeu/contracts';

// O site só conversa com a API pública (ADR-0004); nunca lê o banco nem importa módulos.
const API = process.env['API_URL'] ?? 'http://localhost:3000';

/** Dados oficiais mudam no máximo a cada coleta; a página é regerada em segundo plano (ADR-0008). */
const REVALIDAR_EM_SEGUNDOS = 300;

async function obter<T>(caminho: string): Promise<T | undefined> {
  const resposta = await fetch(`${API}${caminho}`, {
    next: { revalidate: REVALIDAR_EM_SEGUNDOS },
  });
  if (resposta.status === 404) return undefined;
  if (!resposta.ok) throw new Error(`A API respondeu ${resposta.status} para ${caminho}`);
  return (await resposta.json()) as T;
}

export interface FiltroDaLista {
  readonly uf?: string | undefined;
  readonly pagina: number;
}

export async function listarParlamentares(
  filtro: FiltroDaLista,
): Promise<Pagina<ParlamentarResumo>> {
  const busca = new URLSearchParams({ pagina: String(filtro.pagina), itens: '50' });
  if (filtro.uf) busca.set('uf', filtro.uf);
  const pagina = await obter<Pagina<ParlamentarResumo>>(`/v1/parlamentares?${busca.toString()}`);
  return pagina ?? { itens: [], pagina: filtro.pagina, itensPorPagina: 50, total: 0 };
}

export function buscarParlamentar(pessoaId: string): Promise<PerfilDeParlamentar | undefined> {
  return obter<PerfilDeParlamentar>(`/v1/parlamentares/${encodeURIComponent(pessoaId)}`);
}

/** Frequência no plenário nos últimos 90 dias (período padrão da API). */
export function frequenciaDoParlamentar(
  pessoaId: string,
): Promise<FrequenciaDoParlamentar | undefined> {
  return obter<FrequenciaDoParlamentar>(
    `/v1/parlamentares/${encodeURIComponent(pessoaId)}/frequencia`,
  );
}
