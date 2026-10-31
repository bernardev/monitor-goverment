import type {
  AutoriaDoParlamentar,
  EmendaDetalhada,
  EmendaResumo,
  EmendasDoParlamentar,
  FrequenciaDoParlamentar,
  ObraDetalhada,
  ObraResumo,
  Pagina,
  ParlamentarResumo,
  PerfilDeParlamentar,
  ProposicaoDetalhada,
  ProposicaoResumo,
  SituacaoDaObra,
  TipoDeEmenda,
  TipoDeProposicao,
  VotacaoNominalDetalhada,
  VotacaoNominalResumo,
  VotosDoParlamentar,
} from '@prometeu/contracts';

/** Período em dias do calendário de Brasília, `aaaa-mm-dd`, inclusive nas duas pontas. */
export interface PeriodoEmDias {
  readonly de: string;
  readonly ate: string;
}

export interface ConsultaDeFrequencia {
  doParlamentar(pessoaId: string, periodo: PeriodoEmDias): Promise<FrequenciaDoParlamentar>;
}

export interface FiltroDeVotacoes extends PeriodoEmDias {
  /** Sem casa, as duas. */
  readonly casa?: 'camara_dos_deputados' | 'senado_federal' | undefined;
  readonly pagina: number;
  readonly itensPorPagina: number;
}

export interface Paginacao {
  readonly pagina: number;
  readonly itensPorPagina: number;
}

export interface FiltroDeProposicoes extends Paginacao {
  readonly casa?: 'camara_dos_deputados' | 'senado_federal' | undefined;
  readonly sigla?: TipoDeProposicao | undefined;
}

export interface ConsultaDeProposicoes {
  /** A movimentada por último primeiro. */
  listar(filtro: FiltroDeProposicoes): Promise<Pagina<ProposicaoResumo>>;
  buscar(proposicaoId: string): Promise<ProposicaoDetalhada | undefined>;
  /** As proposições de que o parlamentar é autor ou coautor. */
  doParlamentar(pessoaId: string, paginacao: Paginacao): Promise<Pagina<AutoriaDoParlamentar>>;
}

export interface FiltroDeEmendas extends Paginacao {
  /** Ano do orçamento. */
  readonly ano?: number | undefined;
  readonly tipo?: TipoDeEmenda | undefined;
  /** Sigla da UF de destino (`SP`). */
  readonly uf?: string | undefined;
}

export interface ConsultaDeEmendas {
  /** Orçamento mais recente primeiro; no mesmo ano, a de maior empenho. */
  listar(filtro: FiltroDeEmendas): Promise<Pagina<EmendaResumo>>;
  buscar(emendaId: string): Promise<EmendaDetalhada | undefined>;
  /** As emendas de que o parlamentar é autor, com a execução somada de todas. */
  doParlamentar(pessoaId: string, paginacao: Paginacao): Promise<EmendasDoParlamentar>;
}

export interface FiltroDeObras extends Paginacao {
  /** Sigla da UF da obra (`SP`). */
  readonly uf?: string | undefined;
  readonly situacao?: SituacaoDaObra | undefined;
}

export interface ConsultaDeObras {
  /** A de maior investimento previsto primeiro. */
  listar(filtro: FiltroDeObras): Promise<Pagina<ObraResumo>>;
  buscar(obraId: string): Promise<ObraDetalhada | undefined>;
  /** As obras que a emenda paga, pelo código dela na fonte. */
  daEmenda(codigoDaEmenda: string): Promise<ObraResumo[]>;
}

export interface ConsultaDeVotacoes {
  /** Da mais recente para a mais antiga. */
  listar(filtro: FiltroDeVotacoes): Promise<Pagina<VotacaoNominalResumo>>;
  buscar(votacaoId: string): Promise<VotacaoNominalDetalhada | undefined>;
  doParlamentar(pessoaId: string, periodo: PeriodoEmDias): Promise<VotosDoParlamentar>;
  /** As votações coletadas que afetaram a proposição, da mais recente para a mais antiga. */
  daProposicao(
    casa: VotacaoNominalResumo['casa'],
    codigoNaFonte: string,
  ): Promise<VotacaoNominalResumo[]>;
}

export interface FiltroDeParlamentares {
  /** Sigla da UF (`SP`). */
  readonly uf?: string | undefined;
  readonly partido?: string | undefined;
  readonly pagina: number;
  readonly itensPorPagina: number;
}

export interface Relogio {
  agora(): Date;
}

/** Leitura das projeções para a API pública (ADR-0008). */
export interface ConsultaDeParlamentares {
  listar(filtro: FiltroDeParlamentares): Promise<Pagina<ParlamentarResumo>>;
  buscar(pessoaId: string): Promise<PerfilDeParlamentar | undefined>;
}
