'use server';

import { redirect } from 'next/navigation';

import { editorial, ErroDaApi, publica } from '../_api/cliente';
import { exigirSessao } from '../_sessao/sessao';

export interface EstadoDoFormulario {
  readonly erro?: string;
}

const texto = (dados: FormData, campo: string): string => {
  const valor = dados.get(campo);
  return typeof valor === 'string' ? valor.trim() : '';
};

const numero = (dados: FormData, campo: string): number => Number(texto(dados, campo));

/** Data do formulário (dia) como meio-dia em Brasília, para não trocar de dia por fuso. */
const dataDoDia = (dia: string): string => `${dia}T12:00:00-03:00`;

/** Erros esperados viram mensagem no formulário; o resto sobe para a página de erro. */
async function tentar(acao: () => Promise<void>): Promise<EstadoDoFormulario> {
  try {
    await acao();
    return {};
  } catch (erro) {
    if (erro instanceof ErroDaApi) return { erro: erro.message };
    throw erro;
  }
}

export async function registrarPromessa(
  _estado: EstadoDoFormulario,
  dados: FormData,
): Promise<EstadoDoFormulario> {
  await exigirSessao();
  let promessaId = '';
  const resultado = await tentar(async () => {
    const pessoaId = texto(dados, 'pessoaId');
    const perfil = await publica.perfil(pessoaId);
    if (!perfil?.mandato)
      throw new ErroDaApi(422, undefined, 'Escolha um parlamentar com mandato.');

    // A prova vem antes do fato (ADR-0009): o documento é capturado e só então a promessa é registrada.
    const { capturaId } = await editorial.capturar(texto(dados, 'urlDaFonte'));
    const localizacao =
      texto(dados, 'tipoDeLocalizacao') === 'intervalo_de_tempo'
        ? {
            tipo: 'intervalo_de_tempo',
            inicioEmSegundos: numero(dados, 'inicioEmSegundos'),
            fimEmSegundos: numero(dados, 'fimEmSegundos'),
          }
        : { tipo: 'pagina', pagina: numero(dados, 'pagina') };
    const meta = texto(dados, 'meta');
    ({ promessaId } = await editorial.registrar({
      pessoaId,
      mandatoId: perfil.mandato.mandatoId,
      texto: texto(dados, 'texto'),
      tema: texto(dados, 'tema'),
      mensurabilidade: texto(dados, 'mensurabilidade'),
      competencia: texto(dados, 'competencia'),
      ...(meta ? { meta: { descricao: meta } } : {}),
      fonte: {
        tipo: texto(dados, 'tipoDeFonte'),
        capturaId,
        citacaoLiteral: texto(dados, 'citacaoLiteral'),
        localizacao,
        dataDaDeclaracao: dataDoDia(texto(dados, 'dataDaDeclaracao')),
      },
    }));
  });
  if (resultado.erro) return resultado;
  redirect(`/promessas/${promessaId}`);
}

export async function proporVeredito(
  promessaId: string,
  _estado: EstadoDoFormulario,
  dados: FormData,
): Promise<EstadoDoFormulario> {
  await exigirSessao();
  const resultado = await tentar(async () => {
    const evidencias = dados.getAll('evidencias').filter((v): v is string => typeof v === 'string');
    const urlNova = texto(dados, 'urlDaEvidencia');
    const nova = urlNova ? (await editorial.capturar(urlNova)).capturaId : undefined;
    if (nova) evidencias.push(nova);

    const tipoDeFundamento = texto(dados, 'fundamento');
    let fundamento: unknown;
    if (tipoDeFundamento === 'mandato_encerrado') fundamento = { tipo: 'mandato_encerrado' };
    if (tipoDeFundamento === 'ato_em_sentido_contrario') {
      if (!nova) {
        throw new ErroDaApi(422, undefined, 'Informe o endereço do ato em sentido contrário.');
      }
      fundamento = { tipo: 'ato_em_sentido_contrario', evidenciaId: nova };
    }
    await editorial.propor(promessaId, {
      veredito: texto(dados, 'veredito'),
      justificativa: texto(dados, 'justificativa'),
      evidencias,
      ...(fundamento ? { fundamento } : {}),
      errata: dados.get('errata') === 'sim',
    });
  });
  if (resultado.erro) return resultado;
  redirect(`/promessas/${promessaId}`);
}

export async function publicarVeredito(promessaId: string): Promise<EstadoDoFormulario> {
  await exigirSessao();
  const resultado = await tentar(async () => {
    await editorial.publicar(promessaId);
  });
  if (resultado.erro) return resultado;
  redirect(`/promessas/${promessaId}`);
}

export async function recusarVeredito(
  promessaId: string,
  _estado: EstadoDoFormulario,
  dados: FormData,
): Promise<EstadoDoFormulario> {
  await exigirSessao();
  const resultado = await tentar(async () => {
    await editorial.recusar(promessaId, texto(dados, 'motivo'));
  });
  if (resultado.erro) return resultado;
  redirect(`/promessas/${promessaId}`);
}
