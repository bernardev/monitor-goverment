import type {
  FrequenciaDoParlamentar,
  Pagina,
  ParlamentarResumo,
  PerfilDeParlamentar,
} from '@prometeu/contracts';

/** Período em dias do calendário de Brasília, `aaaa-mm-dd`, inclusive nas duas pontas. */
export interface PeriodoDeFrequencia {
  readonly de: string;
  readonly ate: string;
}

export interface ConsultaDeFrequencia {
  doParlamentar(pessoaId: string, periodo: PeriodoDeFrequencia): Promise<FrequenciaDoParlamentar>;
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
