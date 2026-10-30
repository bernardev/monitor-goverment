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

/** Por que a casa aceitou a ausência (categorias comparáveis entre casas). */
export type CategoriaDoMotivo =
  | 'licenca_saude'
  | 'licenca_gestante'
  | 'licenca_paternidade'
  | 'licenca_particular'
  | 'missao_autorizada'
  | 'atividade_parlamentar'
  | 'decisao_da_mesa'
  | 'outro';

export interface DiaDeFrequencia {
  /** Dia do calendário de Brasília, `aaaa-mm-dd`. */
  readonly dia: string;
  readonly casa: 'camara_dos_deputados' | 'senado_federal';
  readonly situacao: 'presente' | 'ausente' | 'ausencia_justificada';
  /** Só na ausência justificada. */
  readonly motivo: {
    readonly categoria: CategoriaDoMotivo;
    readonly descricaoNaFonte: string;
  } | null;
  /** Como a casa escreveu a situação do dia. */
  readonly registroNaFonte: string;
  readonly sessoes: readonly { readonly descricao: string; readonly presente: boolean }[];
  readonly fonte: FonteDoDado;
}

/**
 * Frequência no plenário num período. Conta dias com sessão, não sessões: é como as casas apuram.
 * Dia sem registro na fonte não entra em nenhuma conta (falta de dado não é falta do parlamentar), e
 * as contas cobrem só os dias já coletados: não são o total de sessões do período.
 */
export interface FrequenciaDoParlamentar {
  readonly pessoaId: string;
  readonly de: string;
  readonly ate: string;
  readonly resumo: {
    readonly diasComSessao: number;
    readonly presencas: number;
    readonly ausenciasJustificadas: number;
    readonly ausenciasSemJustificativa: number;
    readonly porMotivo: readonly { readonly categoria: CategoriaDoMotivo; readonly dias: number }[];
  };
  /** Do mais recente para o mais antigo. */
  readonly dias: readonly DiaDeFrequencia[];
}

export interface Pagina<T> {
  readonly itens: readonly T[];
  readonly pagina: number;
  readonly itensPorPagina: number;
  readonly total: number;
}
