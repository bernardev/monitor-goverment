import type {
  FrequenciaDoParlamentar,
  Pagina,
  ParlamentarResumo,
  PerfilDeParlamentar,
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

export interface ConsultaDeVotacoes {
  /** Da mais recente para a mais antiga. */
  listar(filtro: FiltroDeVotacoes): Promise<Pagina<VotacaoNominalResumo>>;
  buscar(votacaoId: string): Promise<VotacaoNominalDetalhada | undefined>;
  doParlamentar(pessoaId: string, periodo: PeriodoEmDias): Promise<VotosDoParlamentar>;
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
