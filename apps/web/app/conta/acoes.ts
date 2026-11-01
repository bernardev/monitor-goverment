'use server';

import { caminhoDeVolta } from '@prometeu/acesso';
import { redirect } from 'next/navigation';

import * as conta from '../_api/conta';
import { sessaoDoCidadao } from '../_sessao/sessao';

const TIPOS: readonly conta.TipoDeAlvo[] = ['parlamentar', 'municipio'];

function lerTipo(valor: string): conta.TipoDeAlvo {
  const tipo = TIPOS.find((t) => t === valor);
  if (!tipo) throw new Error(`Tipo de acompanhamento desconhecido: ${valor}`);
  return tipo;
}

/**
 * Acompanha ou deixa de acompanhar e volta para a página de onde veio. Sem login, vai entrar (ou
 * criar a conta) e volta para a mesma página, onde a pessoa clica de novo.
 */
export async function alternarAcompanhamento(
  tipo: string,
  id: string,
  volta: string,
  acompanhando: boolean,
): Promise<void> {
  const destino = caminhoDeVolta(volta);
  const sessao = await sessaoDoCidadao();
  if (!sessao) redirect(`/entrar?volta=${encodeURIComponent(destino)}`);
  await (acompanhando ? conta.deixarDeAcompanhar : conta.acompanhar)(sessao, lerTipo(tipo), id);
  redirect(destino);
}

/** Apaga tudo o que a plataforma guarda sobre a pessoa; a conta de login continua sendo dela. */
export async function apagarMeusDados(dados: FormData): Promise<void> {
  const sessao = await sessaoDoCidadao();
  if (!sessao) redirect('/entrar?volta=/conta');
  // A caixa de confirmação já é obrigatória no formulário; aqui é a garantia sem JavaScript.
  if (dados.get('confirmo') !== 'sim') redirect('/conta?erro=confirmacao');
  await conta.apagarMeusDados(sessao);
  redirect('/conta?apagado=1');
}
