import 'server-only';

import type {
  AutoriaDoParlamentar,
  EmendaDetalhada,
  EmendaResumo,
  EmendasDoParlamentar,
  FrequenciaDoParlamentar,
  MunicipioResumo,
  ObraDetalhada,
  ObraResumo,
  Pagina,
  ParlamentarResumo,
  PerfilDeParlamentar,
  ProposicaoDetalhada,
  ProposicaoResumo,
  SituacaoDaFonte,
  SituacaoDaObra,
  TipoDeEmenda,
  TipoDeProposicao,
  VotacaoNominalDetalhada,
  VotacaoNominalResumo,
  VotosDoParlamentar,
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
  /** Parte do nome; com nome, entra também quem já saiu do cargo. */
  readonly nome?: string | undefined;
  readonly pagina: number;
  readonly itens?: number;
}

export async function listarParlamentares(
  filtro: FiltroDaLista,
): Promise<Pagina<ParlamentarResumo>> {
  const itens = filtro.itens ?? 50;
  const busca = new URLSearchParams({ pagina: String(filtro.pagina), itens: String(itens) });
  if (filtro.uf) busca.set('uf', filtro.uf);
  if (filtro.nome) busca.set('nome', filtro.nome);
  const pagina = await obter<Pagina<ParlamentarResumo>>(`/v1/parlamentares?${busca.toString()}`);
  return pagina ?? { itens: [], pagina: filtro.pagina, itensPorPagina: itens, total: 0 };
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

/** Votações nominais do plenário nos últimos 90 dias (período padrão da API). */
export function votosDoParlamentar(pessoaId: string): Promise<VotosDoParlamentar | undefined> {
  return obter<VotosDoParlamentar>(`/v1/parlamentares/${encodeURIComponent(pessoaId)}/votos`);
}

/** Votações nominais do plenário nos últimos 90 dias, da mais recente para a mais antiga. */
export async function listarVotacoes(
  pagina: number,
  casa?: 'camara' | 'senado',
): Promise<Pagina<VotacaoNominalResumo>> {
  const busca = new URLSearchParams({ pagina: String(pagina), itens: '50' });
  if (casa) busca.set('casa', casa);
  const lista = await obter<Pagina<VotacaoNominalResumo>>(`/v1/votacoes?${busca.toString()}`);
  return lista ?? { itens: [], pagina, itensPorPagina: 50, total: 0 };
}

export function buscarVotacao(votacaoId: string): Promise<VotacaoNominalDetalhada | undefined> {
  return obter<VotacaoNominalDetalhada>(`/v1/votacoes/${encodeURIComponent(votacaoId)}`);
}

export interface FiltroDeProposicoes {
  readonly casa?: 'camara' | 'senado' | undefined;
  readonly tipo?: TipoDeProposicao | undefined;
  readonly pagina: number;
}

/** Proposições normativas, a movimentada por último primeiro. */
export async function listarProposicoes(
  filtro: FiltroDeProposicoes,
): Promise<Pagina<ProposicaoResumo>> {
  const busca = new URLSearchParams({ pagina: String(filtro.pagina), itens: '50' });
  if (filtro.casa) busca.set('casa', filtro.casa);
  if (filtro.tipo) busca.set('tipo', filtro.tipo);
  const lista = await obter<Pagina<ProposicaoResumo>>(`/v1/proposicoes?${busca.toString()}`);
  return lista ?? { itens: [], pagina: filtro.pagina, itensPorPagina: 50, total: 0 };
}

export function buscarProposicao(proposicaoId: string): Promise<ProposicaoDetalhada | undefined> {
  return obter<ProposicaoDetalhada>(`/v1/proposicoes/${encodeURIComponent(proposicaoId)}`);
}

/** As dez proposições de autoria movimentadas por último, com o total. */
export function proposicoesDoParlamentar(
  pessoaId: string,
): Promise<Pagina<AutoriaDoParlamentar> | undefined> {
  return obter<Pagina<AutoriaDoParlamentar>>(
    `/v1/parlamentares/${encodeURIComponent(pessoaId)}/proposicoes?itens=10`,
  );
}

export interface FiltroDeEmendas {
  readonly ano?: number | undefined;
  readonly tipo?: TipoDeEmenda | undefined;
  readonly uf?: string | undefined;
  /** Código IBGE do município de destino. */
  readonly municipio?: string | undefined;
  readonly pagina: number;
}

/** Emendas parlamentares, do orçamento mais recente; no mesmo ano, a de maior empenho primeiro. */
export async function listarEmendas(filtro: FiltroDeEmendas): Promise<Pagina<EmendaResumo>> {
  const busca = new URLSearchParams({ pagina: String(filtro.pagina), itens: '50' });
  if (filtro.ano) busca.set('ano', String(filtro.ano));
  if (filtro.tipo) busca.set('tipo', filtro.tipo);
  if (filtro.uf) busca.set('uf', filtro.uf);
  if (filtro.municipio) busca.set('municipio', filtro.municipio);
  const lista = await obter<Pagina<EmendaResumo>>(`/v1/emendas?${busca.toString()}`);
  return lista ?? { itens: [], pagina: filtro.pagina, itensPorPagina: 50, total: 0 };
}

export function buscarEmenda(emendaId: string): Promise<EmendaDetalhada | undefined> {
  return obter<EmendaDetalhada>(`/v1/emendas/${encodeURIComponent(emendaId)}`);
}

/** As dez emendas mais recentes de que o parlamentar é autor, com o total e a soma de todas. */
export function emendasDoParlamentar(pessoaId: string): Promise<EmendasDoParlamentar | undefined> {
  return obter<EmendasDoParlamentar>(
    `/v1/parlamentares/${encodeURIComponent(pessoaId)}/emendas?itens=10`,
  );
}

export interface FiltroDeObras {
  readonly uf?: string | undefined;
  readonly situacao?: SituacaoDaObra | undefined;
  readonly municipio?: string | undefined;
  readonly nome?: string | undefined;
  readonly pagina: number;
  readonly itens?: number;
}

/** Obras pagas com emendas, da de maior investimento previsto para a de menor. */
export async function listarObras(filtro: FiltroDeObras): Promise<Pagina<ObraResumo>> {
  const itens = filtro.itens ?? 50;
  const busca = new URLSearchParams({ pagina: String(filtro.pagina), itens: String(itens) });
  if (filtro.uf) busca.set('uf', filtro.uf);
  if (filtro.situacao) busca.set('situacao', filtro.situacao);
  if (filtro.municipio) busca.set('municipio', filtro.municipio);
  if (filtro.nome) busca.set('nome', filtro.nome);
  const lista = await obter<Pagina<ObraResumo>>(`/v1/obras?${busca.toString()}`);
  return lista ?? { itens: [], pagina: filtro.pagina, itensPorPagina: itens, total: 0 };
}

export function buscarObra(obraId: string): Promise<ObraDetalhada | undefined> {
  return obter<ObraDetalhada>(`/v1/obras/${encodeURIComponent(obraId)}`);
}

/** Quando cada fonte oficial foi coletada pela última vez. */
export async function situacaoDasFontes(): Promise<SituacaoDaFonte[]> {
  return (await obter<SituacaoDaFonte[]>('/v1/fontes')) ?? [];
}

/** Municípios pelo nome (destino de emenda ou local de obra); pede ao menos 2 letras. */
export async function buscarMunicipios(nome: string): Promise<MunicipioResumo[]> {
  if (nome.trim().length < 2) return [];
  const busca = new URLSearchParams({ nome });
  return (await obter<MunicipioResumo[]>(`/v1/municipios?${busca.toString()}`)) ?? [];
}

export function buscarMunicipio(codigoIbge: string): Promise<MunicipioResumo | undefined> {
  return obter<MunicipioResumo>(`/v1/municipios/${encodeURIComponent(codigoIbge)}`);
}
