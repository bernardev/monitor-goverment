import type { Pagina, ParlamentarResumo, PerfilDeParlamentar } from '@prometeu/contracts';

export interface FiltroDeParlamentares {
  /** Sigla da UF (`SP`). */
  readonly uf?: string | undefined;
  readonly partido?: string | undefined;
  readonly pagina: number;
  readonly itensPorPagina: number;
}

/** Leitura das projeções para a API pública (ADR-0008). */
export interface ConsultaDeParlamentares {
  listar(filtro: FiltroDeParlamentares): Promise<Pagina<ParlamentarResumo>>;
  buscar(pessoaId: string): Promise<PerfilDeParlamentar | undefined>;
}
