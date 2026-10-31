import type { DomainEvent } from '@prometeu/shared-kernel';

import type { Interrupcao, SituacaoDaObra } from './situacao-da-obra.js';

// Dados só com primitivos serializáveis: vão para a outbox em JSON (ADR-0007) e são a linguagem
// publicada deste contexto para os outros (packages/contracts/eventos). Ausência é `null`.
// Valores em centavos vão como texto: JSON não tem inteiro de 64 bits. Dias como `aaaa-mm-dd`.

export interface OrganizacaoPublicada {
  nome: string | null;
  cnpj: string | null;
}

/** Estado completo da obra: quem consome não precisa juntar eventos. */
export interface ObraPublicada {
  /** Identificador do projeto de investimento no Obrasgov.br (`151020.43-16`). */
  idNaFonte: string;
  nome: string;
  descricao: string | null;
  /** `Obra`, `Projeto`, como a fonte escreve. */
  natureza: string | null;
  /** `Construção`, `Reforma`, `Ampliação`... */
  especie: string | null;
  situacao: SituacaoDaObra;
  /** Como a fonte escreve a situação (`Cadastrada`, `Em execução`). */
  situacaoNaFonte: string;
  uf: string | null;
  municipios: { codigoIbge: string; nome: string | null }[];
  /** Latitude e longitude como texto decimal. */
  pontos: { latitude: string; longitude: string }[];
  endereco: string | null;
  inicioPrevisto: string | null;
  fimPrevisto: string | null;
  inicioEfetivo: string | null;
  fimEfetivo: string | null;
  investimentoPrevistoCentavos: string;
  executores: OrganizacaoPublicada[];
  /** A medição mais recente; `null` sem execução física informada. */
  medicao: {
    /** Centésimos de ponto percentual: 2335 é 23,35%. */
    percentualCentesimos: number;
    em: string | null;
  } | null;
  /** Paralisações, cancelamentos e declarações de obra inacabada, da mais antiga à mais recente. */
  interrupcoes: {
    tipo: Interrupcao;
    em: string;
    justificativa: string | null;
  }[];
  /** As emendas que pagam a obra, pelos empenhos que trazem o código delas. */
  emendas: {
    codigoDaEmenda: string;
    ugEmitente: string;
    numeroDoEmpenho: string;
    acaoOrcamentaria: string | null;
    empenhadoCentavos: string;
    emitidoEm: string | null;
  }[];
  capturaId: string;
}

export type ObraRegistrada = DomainEvent<'ObraRegistrada', ObraPublicada>;

/** A fonte mudou a obra: situação, medição, datas, emendas que a pagam. */
export type ObraAtualizada = DomainEvent<'ObraAtualizada', ObraPublicada>;

/** A obra passou a constar como paralisada (vem junto com `ObraAtualizada`). */
export type ObraParalisada = DomainEvent<
  'ObraParalisada',
  {
    idNaFonte: string;
    /** A paralisação mais recente do histórico, quando a fonte a registra. */
    em: string | null;
    justificativa: string | null;
    /** Códigos das emendas que pagam a obra. */
    emendas: string[];
    capturaId: string;
  }
>;

export type EventoDeObras = ObraRegistrada | ObraAtualizada | ObraParalisada;
