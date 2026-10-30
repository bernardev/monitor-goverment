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

/**
 * Como o parlamentar votou, em categorias comparáveis entre casas. `presidente_da_sessao`: presidia e
 * não vota, salvo para desempatar. `secreto`: votou em votação secreta, sem o voto conhecido.
 */
export type OpcaoDeVoto =
  'sim' | 'nao' | 'abstencao' | 'obstrucao' | 'presidente_da_sessao' | 'secreto';

/**
 * Por que o parlamentar em exercício não votou, quando a casa informa (o Senado informa; a Câmara não
 * lista quem não votou). `nao_informada`: registro da casa sem significado público.
 */
export type SituacaoSemVoto =
  'presente_sem_voto' | 'ausente' | 'ausencia_justificada' | 'nao_informada';

/** Proposição que a votação afetou, como a casa a identifica. */
export interface ProposicaoAfetada {
  readonly codigoNaFonte: string;
  readonly sigla: string;
  readonly numero: number;
  readonly ano: number;
  readonly ementa: string | null;
}

export interface VotacaoNominalResumo {
  readonly votacaoId: string;
  readonly casa: 'camara_dos_deputados' | 'senado_federal';
  /** Como a casa identifica a votação (`2635476-36`). */
  readonly codigoNaFonte: string;
  /** Dia do calendário de Brasília, `aaaa-mm-dd`. */
  readonly dia: string;
  /** `null`: a casa não informa o horário (Senado). */
  readonly registradaEm: string | null;
  /** Palavras da casa, com o resultado. */
  readonly descricao: string;
  readonly resultado: 'aprovada' | 'rejeitada' | 'nao_informado';
  readonly secreta: boolean;
  readonly proposicoes: readonly ProposicaoAfetada[];
  /** Votos registrados em cada opção. Quem não votou não entra. */
  readonly placar: Readonly<Record<OpcaoDeVoto, number>>;
  /**
   * A casa listou todos os parlamentares em exercício, inclusive quem não votou (Senado). Falso na
   * Câmara: quem não aparece não é ausente, a fonte só não diz.
   */
  readonly relacaoCompleta: boolean;
  /** Quem não votou, por situação; tudo zero quando `relacaoCompleta` é falso. */
  readonly contagemSemVoto: Readonly<Record<SituacaoSemVoto, number>>;
  readonly fonte: FonteDoDado;
}

export interface VotoNaVotacao {
  readonly pessoaId: string;
  /** `null`: a pessoa ainda não chegou à projeção de parlamentares. */
  readonly nome: string | null;
  /** Partido no dia da votação, como a casa informou. */
  readonly siglaPartido: string | null;
  readonly opcao: OpcaoDeVoto;
  /** Como a casa escreveu o voto (`Artigo 17`); `null` na votação secreta. */
  readonly registroNaFonte: string | null;
}

/** Como a casa registrou o dia do parlamentar na votação, quando ele não votou. */
export interface SemVotoNaVotacao {
  readonly situacao: SituacaoSemVoto;
  /** Só na ausência justificada. */
  readonly motivo: {
    readonly categoria: CategoriaDoMotivo;
    readonly descricaoNaFonte: string;
  } | null;
  /** Como a casa escreveu a situação (`LS`, `P-NRV`). */
  readonly registroNaFonte: string;
}

export interface ParlamentarSemVoto extends SemVotoNaVotacao {
  readonly pessoaId: string;
  readonly nome: string | null;
  readonly siglaPartido: string | null;
}

export interface VotacaoNominalDetalhada extends VotacaoNominalResumo {
  /** Em ordem de nome. */
  readonly votos: readonly VotoNaVotacao[];
  /** Em ordem de nome; vazio quando `relacaoCompleta` é falso. */
  readonly semVoto: readonly ParlamentarSemVoto[];
  /** A lista de votos na fonte. */
  readonly fonteDosVotos: FonteDoDado;
}

export interface ParticipacaoEmVotacao {
  readonly votacao: VotacaoNominalResumo;
  /** `null`: a casa não registrou voto do parlamentar nesta votação. */
  readonly voto: { readonly opcao: OpcaoDeVoto; readonly registroNaFonte: string | null } | null;
  /** Por que não votou, quando a casa informa na própria votação (Senado). */
  readonly semVoto: SemVotoNaVotacao | null;
  /** Como a casa apurou o dia do parlamentar; `null` se a frequência do dia não foi coletada. */
  readonly frequenciaNoDia: Pick<DiaDeFrequencia, 'situacao' | 'motivo' | 'registroNaFonte'> | null;
}

/**
 * Votações nominais do plenário num período e o que o parlamentar fez em cada uma. Entra a votação em
 * que ele votou, a que o lista entre quem não votou (Senado) e a do dia em que a casa apurou a
 * frequência dele (estava no cargo). Votação sem nada disso fica de fora: não dá para saber se ele
 * estava no cargo.
 */
export interface VotosDoParlamentar {
  readonly pessoaId: string;
  readonly de: string;
  readonly ate: string;
  readonly resumo: {
    readonly votacoes: number;
    readonly comVoto: number;
    readonly semVotoRegistrado: number;
    readonly porOpcao: readonly { readonly opcao: OpcaoDeVoto; readonly votos: number }[];
  };
  /** Da mais recente para a mais antiga. */
  readonly participacoes: readonly ParticipacaoEmVotacao[];
}

export interface Pagina<T> {
  readonly itens: readonly T[];
  readonly pagina: number;
  readonly itensPorPagina: number;
  readonly total: number;
}
