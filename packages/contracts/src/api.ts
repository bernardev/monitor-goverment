/**
 * Respostas da API pública `/v1` (ADR-0008). Mudança incompatível exige nova versão da API.
 * Datas em ISO 8601 (UTC); ausência é `null`.
 */

/** De onde veio o dado exibido (ADR-0009). */
export interface FonteDoDado {
  readonly capturaId: string;
  /** Endereço consultado na fonte; `null` enquanto a captura ainda não chegou à projeção. */
  readonly url: string | null;
  readonly coletadaEm: string | null;
}

export interface MandatoAtual {
  readonly mandatoId: string;
  readonly cargo: string;
  /** Código IBGE do ente que elege o cargo. */
  readonly circunscricao: string;
  readonly inicio: string;
  readonly fim: string | null;
  readonly fonte: FonteDoDado;
}

export interface ParlamentarResumo {
  readonly pessoaId: string;
  readonly nome: string;
  /** `null`: sem partido. */
  readonly siglaPartido: string | null;
  readonly uf: string | null;
  readonly cargo: string | null;
  readonly urlDaFoto: string | null;
}

export interface PerfilDeParlamentar extends ParlamentarResumo {
  readonly mandato: MandatoAtual | null;
  readonly fonte: FonteDoDado;
  readonly atualizadoEm: string;
}

export interface Pagina<T> {
  readonly itens: readonly T[];
  readonly pagina: number;
  readonly itensPorPagina: number;
  readonly total: number;
}
