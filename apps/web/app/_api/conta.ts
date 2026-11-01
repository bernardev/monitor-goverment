import 'server-only';

import type { AcompanhamentoDoCidadao } from '@prometeu/contracts';

import type { Sessao } from '../_sessao/sessao';

const API = process.env['API_URL'] ?? 'http://localhost:3000';

export type TipoDeAlvo = AcompanhamentoDoCidadao['tipo'];

/** A conta é de uma pessoa só: nada aqui passa pelo cache de dados do Next. */
async function chamar(
  sessao: Sessao,
  metodo: 'GET' | 'PUT' | 'DELETE',
  caminho: string,
): Promise<Response> {
  const resposta = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${sessao.tokenDeAcesso}` },
    cache: 'no-store',
  });
  if (!resposta.ok && resposta.status !== 404) {
    throw new Error(`A API respondeu ${String(resposta.status)} para ${metodo} ${caminho}`);
  }
  return resposta;
}

const alvo = (tipo: TipoDeAlvo, id: string) =>
  `/v1/eu/acompanhamentos/${tipo}/${encodeURIComponent(id)}`;

export async function acompanhamentos(sessao: Sessao): Promise<AcompanhamentoDoCidadao[]> {
  return (await (
    await chamar(sessao, 'GET', '/v1/eu/acompanhamentos')
  ).json()) as AcompanhamentoDoCidadao[];
}

export async function acompanhar(sessao: Sessao, tipo: TipoDeAlvo, id: string): Promise<void> {
  await chamar(sessao, 'PUT', alvo(tipo, id));
}

export async function deixarDeAcompanhar(
  sessao: Sessao,
  tipo: TipoDeAlvo,
  id: string,
): Promise<void> {
  await chamar(sessao, 'DELETE', alvo(tipo, id));
}

export async function apagarMeusDados(sessao: Sessao): Promise<void> {
  await chamar(sessao, 'DELETE', '/v1/eu');
}
