/**
 * Respostas da API editorial (`/v1/editorial`), usada pelo painel de curadoria. Exige login com papel
 * editorial (ADR-0014). Datas em ISO 8601 (UTC); ausência é `null`.
 */

export type LocalizacaoDoTrecho =
  | { readonly tipo: 'pagina'; readonly pagina: number }
  | {
      readonly tipo: 'intervalo_de_tempo';
      readonly inicioEmSegundos: number;
      readonly fimEmSegundos: number;
    };

export interface FonteNaCuradoria {
  readonly fonteId: string;
  readonly tipo: string;
  readonly capturaId: string;
  readonly citacaoLiteral: string;
  readonly localizacao: LocalizacaoDoTrecho;
  readonly dataDaDeclaracao: string;
}

export interface VinculoNaCuradoria {
  readonly vinculoId: string;
  readonly tipoDoAlvo: string;
  readonly idDoAlvo: string;
  readonly estagioQueComprova: string;
  readonly origem: string;
  readonly situacao: string;
  readonly evidencias: readonly string[];
}

export interface VereditoNaCuradoria {
  readonly veredito: string;
  readonly justificativa: string;
  readonly evidencias: readonly string[];
  readonly fundamento: string | null;
  readonly errata: boolean;
  readonly propostoPor: string;
  readonly propostoEm: string;
}

export interface VereditoPublicadoNaCuradoria extends VereditoNaCuradoria {
  readonly registroId: string;
  readonly revisadoPor: string;
  readonly publicadoEm: string;
  readonly corrige: string | null;
}

export interface ResumoDePromessaNaCuradoria {
  readonly promessaId: string;
  readonly pessoaId: string;
  readonly texto: string;
  readonly estagio: string;
  readonly vereditoVigente: string;
  readonly aguardandoRevisao: boolean;
}

export interface PromessaNaCuradoria extends ResumoDePromessaNaCuradoria {
  readonly candidaturaId: string | null;
  readonly mandatoId: string | null;
  readonly tema: string;
  readonly mensurabilidade: string;
  readonly competencia: string;
  readonly meta: { readonly descricao: string; readonly prazo: string | null } | null;
  readonly fontes: readonly FonteNaCuradoria[];
  readonly vinculos: readonly VinculoNaCuradoria[];
  readonly historico: readonly VereditoPublicadoNaCuradoria[];
  readonly propostaPendente: VereditoNaCuradoria | null;
}

/** Erro de regra de negócio devolvido pela API (código estável da linguagem ubíqua). */
export interface ErroDeNegocio {
  readonly codigo: string;
  readonly mensagem: string;
  readonly detalhes?: Readonly<Record<string, unknown>>;
}
