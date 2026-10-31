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
  /** A proposição no Prometeu; `null` se ela ainda não foi coletada. */
  readonly proposicaoId: string | null;
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

/** Tipos de proposição que podem virar norma. */
export type TipoDeProposicao = 'PEC' | 'PLP' | 'PL' | 'MPV' | 'PDL';

export interface ProposicaoResumo {
  readonly proposicaoId: string;
  readonly casa: 'camara_dos_deputados' | 'senado_federal';
  /** Id da proposição na Câmara; id do processo no Senado. */
  readonly codigoNaFonte: string;
  readonly sigla: TipoDeProposicao;
  readonly numero: number;
  readonly ano: number;
  readonly ementa: string | null;
  readonly apresentadaEm: string | null;
  readonly situacao: {
    readonly descricao: string;
    readonly desde: string;
    readonly orgao: string | null;
  } | null;
  /** O ato de tramitação mais recente que foi coletado. */
  readonly ultimaTramitacaoEm: string | null;
  /** A norma que a proposição gerou, quando a casa informa (`Lei nº 15.018 de 12/11/2024`). */
  readonly normaGerada: string | null;
  readonly fonte: FonteDoDado;
}

export interface AutorDaProposicao {
  /** `null`: autor que não é parlamentar conhecido (Poder Executivo, comissão, ex-parlamentar). */
  readonly pessoaId: string | null;
  /** Como a casa nomeia o autor. */
  readonly nome: string;
  readonly tipoNaFonte: string;
  /** Autor de fato, e não só quem assina junto. */
  readonly proponente: boolean;
}

export interface TramitacaoDaProposicao {
  readonly em: string;
  readonly orgao: string | null;
  readonly descricao: string;
  readonly situacao: string | null;
  readonly despacho: string | null;
}

export interface ProposicaoDetalhada extends ProposicaoResumo {
  readonly autores: readonly AutorDaProposicao[];
  /** Do ato mais recente para o mais antigo. */
  readonly tramitacoes: readonly TramitacaoDaProposicao[];
  readonly urlDoTexto: string | null;
  /** Votações nominais coletadas que afetaram a proposição, da mais recente para a mais antiga. */
  readonly votacoes: readonly VotacaoNominalResumo[];
}

/** Proposição de que o parlamentar é autor (ou só assina junto, se `proponente` é falso). */
export interface AutoriaDoParlamentar {
  readonly proposicao: ProposicaoResumo;
  readonly proponente: boolean;
}

export interface Pagina<T> {
  readonly itens: readonly T[];
  readonly pagina: number;
  readonly itensPorPagina: number;
  readonly total: number;
}

/** Quem indica a emenda: a individual tem um parlamentar como autor; as outras são coletivas. */
export type TipoDeEmenda = 'individual' | 'bancada' | 'comissao' | 'relator';

/**
 * Como o dinheiro da emenda individual chega ao ente: para uma ação com finalidade definida, ou
 * direto no caixa, como transferência especial (a "emenda PIX").
 */
export type ModalidadeDaEmenda = 'finalidade_definida' | 'transferencia_especial';

/**
 * Fases da despesa, acumuladas até a coleta. Valores em centavos, como texto decimal
 * (`"150000000"` é R$ 1.500.000,00): JSON não tem inteiro de 64 bits.
 */
export interface ExecucaoDaEmenda {
  readonly empenhadoCentavos: string;
  readonly liquidadoCentavos: string;
  /** Pago no ano do orçamento. */
  readonly pagoCentavos: string;
  /** Empenho que passou para os anos seguintes como dívida. */
  readonly restosInscritosCentavos: string;
  /** Restos a pagar cancelados; estorno vem negativo. */
  readonly restosCanceladosCentavos: string;
  /** Pago nos anos seguintes, por conta dos restos a pagar. */
  readonly restosPagosCentavos: string;
}

export interface AutorDaEmenda {
  /**
   * O parlamentar, identificado pelo nome que a fonte informa: o Portal não traz outro identificador.
   * `null`: autor coletivo (bancada, comissão, relator) ou nome sem correspondência única.
   */
  readonly pessoaId: string | null;
  /** Como a fonte nomeia o autor (`BANCADA DA BAHIA`). */
  readonly nome: string;
}

export interface EmendaResumo {
  readonly emendaId: string;
  /** Código da emenda no Portal da Transparência. */
  readonly codigoNaFonte: string;
  /** Ano do orçamento. */
  readonly ano: number;
  readonly tipo: TipoDeEmenda;
  readonly numero: string;
  readonly autor: AutorDaEmenda;
  /** Siglas das UFs de destino; vazio quando o destino é nacional, múltiplo ou não informado. */
  readonly ufs: readonly string[];
  /** Destinos como a fonte os descreve (`SÃO PAULO - SP`, `MÚLTIPLO`, `Nacional`). */
  readonly localidades: readonly string[];
  /** As modalidades das destinações; vazio em emenda coletiva. */
  readonly modalidades: readonly ModalidadeDaEmenda[];
  /** A soma das destinações. */
  readonly execucao: ExecucaoDaEmenda;
  readonly fonte: FonteDoDado;
}

export interface ClassificacaoOrcamentaria {
  readonly codigo: string;
  readonly nome: string;
}

/** Para onde vai o dinheiro: uma ação orçamentária numa localidade. */
export interface DestinacaoDaEmenda {
  readonly localidade: string;
  /** Código IBGE do município, quando o destino é um município. */
  readonly municipioIbge: string | null;
  readonly uf: string | null;
  readonly funcao: ClassificacaoOrcamentaria;
  readonly subfuncao: ClassificacaoOrcamentaria;
  readonly programa: ClassificacaoOrcamentaria;
  readonly acao: ClassificacaoOrcamentaria;
  readonly planoOrcamentario: ClassificacaoOrcamentaria;
  /** `null` em emenda coletiva. */
  readonly modalidade: ModalidadeDaEmenda | null;
  readonly execucao: ExecucaoDaEmenda;
}

/**
 * Quem recebeu o dinheiro. Pessoa jurídica (CNPJ) e unidade gestora (órgão federal) vêm com nome;
 * pessoas físicas, inscrições genéricas (sem CPF nem CNPJ) e favorecidos não informados vêm somados
 * por município, sem nome nem documento.
 */
export type TipoDeFavorecido =
  | 'pessoa_juridica'
  | 'unidade_gestora'
  | 'pessoas_fisicas'
  | 'inscricao_generica'
  | 'nao_informado';

/** Um favorecido da emenda, com tudo o que recebeu dela. */
export interface FavorecidoDaEmenda {
  readonly tipo: TipoDeFavorecido;
  /** CNPJ (14 dígitos) ou código da unidade gestora (6); `null` nos somados. */
  readonly documento: string | null;
  /** `null` nos somados. */
  readonly nome: string | null;
  readonly naturezaJuridica: string | null;
  readonly uf: string | null;
  /** Como a fonte escreve o município (`SÃO PAULO`): ela não dá o código IBGE. */
  readonly municipio: string | null;
  /** Soma dos recebimentos, em centavos como texto; estornos descontados. */
  readonly recebidoCentavos: string;
  /** Primeiro e último mês com recebimento, `aaaa-mm`. */
  readonly primeiroMes: string;
  readonly ultimoMes: string;
}

export interface FavorecidosDaEmenda {
  /** O recebido por todos os favorecidos. */
  readonly recebidoCentavos: string;
  /** Do que mais recebeu para o que menos recebeu. */
  readonly itens: readonly FavorecidoDaEmenda[];
  readonly fonte: FonteDoDado;
}

/** Convênio que a emenda ajuda a pagar. */
export interface ConvenioDaEmenda {
  /** Número do convênio na fonte. */
  readonly numero: string;
  /** Quem recebe o dinheiro e executa o objeto; a fonte só dá o nome. */
  readonly convenente: string;
  readonly objeto: string | null;
  /** `aaaa-mm-dd`. */
  readonly publicadoEm: string;
  /** O valor do convênio inteiro, não só a parte desta emenda. */
  readonly valorCentavos: string;
  /** Onde a fonte liga o convênio a esta emenda (`SÃO PAULO (UF)`, `Nacional`). */
  readonly localidades: readonly string[];
  /** Quantas emendas pagam o convênio, esta inclusa. */
  readonly emendas: number;
  readonly fonte: FonteDoDado;
}

/** Município que aparece como destino de emenda ou local de obra. */
export interface MunicipioResumo {
  readonly codigoIbge: string;
  readonly nome: string;
  readonly uf: string;
}

/** A última coleta de uma tabela da fonte. */
export interface ColetaDaTabela {
  /** Tabela da camada prata (`camara_votacao`). */
  readonly tabela: string;
  readonly ultimaColetaEm: string;
  /** Registros gravados na última coleta. */
  readonly registros: number;
  readonly versaoDoContrato: string;
}

/** Uma fonte oficial e se as coletas dela estão em dia. */
export interface SituacaoDaFonte {
  /** Identificador da fonte (`camara`, `obrasgov`). */
  readonly fonte: string;
  readonly nome: string;
  /** De quanto em quanto tempo a fonte é coletada. */
  readonly periodicidade: 'diaria' | 'semanal';
  /** A coleta mais recente de qualquer tabela; `null` se nunca foi coletada. */
  readonly ultimaColetaEm: string | null;
  /** `atrasada`: passou do prazo da agenda com folga. */
  readonly situacao: 'em_dia' | 'atrasada' | 'nunca_coletada';
  readonly tabelas: readonly ColetaDaTabela[];
}

/**
 * Em que pé a obra está. `planejada`: cadastrada, sem execução iniciada. `inacabada`: parou e foi
 * dada como não concluída.
 */
export type SituacaoDaObra =
  'planejada' | 'em_execucao' | 'paralisada' | 'concluida' | 'cancelada' | 'inacabada';

/** Percentual executado informado numa data. */
export interface MedicaoDaObra {
  /** Centésimos de ponto: 2335 é 23,35%. A fonte tem medição acima de 100%. */
  readonly percentualCentesimos: number;
  /** `aaaa-mm-dd`. */
  readonly em: string | null;
}

export interface MunicipioDaObra {
  readonly codigoIbge: string;
  readonly nome: string | null;
}

export interface ObraResumo {
  readonly obraId: string;
  /** Projeto de investimento no Obrasgov.br (`151020.43-16`). */
  readonly idNaFonte: string;
  readonly nome: string;
  readonly situacao: SituacaoDaObra;
  readonly uf: string | null;
  readonly municipios: readonly MunicipioDaObra[];
  /** `null`: a fonte não informa execução física. */
  readonly medicao: MedicaoDaObra | null;
  /** Todas as fontes de recurso, em centavos como texto. */
  readonly investimentoPrevistoCentavos: string;
  readonly fonte: FonteDoDado;
}

/** Uma emenda que paga a obra, pelo empenho que traz o código dela. */
export interface EmendaDaObra {
  readonly codigoDaEmenda: string;
  /** A emenda no Prometeu; `null` se ela ainda não foi coletada. */
  readonly emendaId: string | null;
  readonly autor: AutorDaEmenda | null;
  readonly numeroDoEmpenho: string;
  readonly acaoOrcamentaria: string | null;
  readonly empenhadoCentavos: string;
  readonly emitidoEm: string | null;
}

export interface ObraDetalhada extends ObraResumo {
  readonly descricao: string | null;
  readonly natureza: string | null;
  readonly especie: string | null;
  /** Como a fonte escreve a situação (`Cadastrada`, `Em execução`). */
  readonly situacaoNaFonte: string;
  readonly endereco: string | null;
  readonly pontos: readonly { readonly latitude: string; readonly longitude: string }[];
  readonly inicioPrevisto: string | null;
  readonly fimPrevisto: string | null;
  readonly inicioEfetivo: string | null;
  readonly fimEfetivo: string | null;
  readonly executores: readonly { readonly nome: string | null; readonly cnpj: string | null }[];
  /** Paralisações, cancelamentos e declarações de obra inacabada, da mais recente à mais antiga. */
  readonly interrupcoes: readonly {
    readonly tipo: 'paralisada' | 'cancelada' | 'inacabada';
    readonly em: string;
    readonly justificativa: string | null;
  }[];
  readonly emendas: readonly EmendaDaObra[];
}

export interface EmendaDetalhada extends EmendaResumo {
  readonly destinacoes: readonly DestinacaoDaEmenda[];
  /** Obras que a emenda paga, pelos empenhos do Obrasgov.br. */
  readonly obras: readonly ObraResumo[];
  /** `null`: a fonte ainda não registrou pagamento a favorecidos. */
  readonly favorecidos: FavorecidosDaEmenda | null;
  /** Do mais recente para o mais antigo. */
  readonly convenios: readonly ConvenioDaEmenda[];
}

/** Emendas de que o parlamentar é autor, da mais recente para a mais antiga. */
export interface EmendasDoParlamentar extends Pagina<EmendaResumo> {
  /** A execução somada de todas as emendas dele, não só as da página. */
  readonly soma: ExecucaoDaEmenda;
}
