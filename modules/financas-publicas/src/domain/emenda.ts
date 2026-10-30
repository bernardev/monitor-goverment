import {
  AggregateRoot,
  type Dinheiro,
  DomainError,
  Result,
  criarEvento,
} from '@prometeu/shared-kernel';

import type { EmendaPublicada, EventoDeFinancasPublicas } from './eventos.js';
import { type CapturaId, EmendaId, type PessoaId } from './identificadores.js';
import { type Modalidade, type TipoDeEmenda, temAutorIndividual } from './tipo-de-emenda.js';

/** Item da classificação orçamentária: função, subfunção, programa, ação, plano orçamentário. */
export interface Classificacao {
  readonly codigo: string;
  readonly nome: string;
}

export interface AutorDaEmenda {
  /** O parlamentar, quando Agentes Públicos o identifica; nunca em autor coletivo. */
  readonly pessoa: PessoaId | undefined;
  /** Como a fonte nomeia o autor (`ACACIO FAVACHO`, `BANCADA DA BAHIA`). */
  readonly nomeNaFonte: string;
  readonly codigoNaFonte: string;
}

/** Fases da despesa, acumuladas até a data da fonte. */
export interface Execucao {
  readonly empenhado: Dinheiro;
  readonly liquidado: Dinheiro;
  /** Pago no ano do orçamento. */
  readonly pago: Dinheiro;
  /** Empenho que virou dívida para os anos seguintes. */
  readonly restosInscritos: Dinheiro;
  /** Restos a pagar cancelados; a fonte registra estornos como valor negativo. */
  readonly restosCancelados: Dinheiro;
  /** Pago nos anos seguintes, por conta dos restos a pagar. */
  readonly restosPagos: Dinheiro;
}

/** Para onde a emenda manda o dinheiro: uma ação orçamentária numa localidade. */
export interface Destinacao {
  /** Como a fonte descreve o destino (`SÃO PAULO - SP`, `MÚLTIPLO`, `Nacional`). */
  readonly localidade: string;
  readonly municipioIbge: string | null;
  readonly ufIbge: string | null;
  readonly funcao: Classificacao;
  readonly subfuncao: Classificacao;
  readonly programa: Classificacao;
  readonly acao: Classificacao;
  readonly planoOrcamentario: Classificacao;
  /** Só a emenda individual tem modalidade; a coletiva, `null`. */
  readonly modalidade: Modalidade | null;
  readonly execucao: Execucao;
}

/** O que a fonte informa sobre a emenda. Pode mudar a cada coleta. */
export interface ApuracaoDaEmenda {
  readonly ano: number;
  readonly tipo: TipoDeEmenda;
  readonly numero: string;
  readonly autor: AutorDaEmenda;
  readonly destinacoes: readonly Destinacao[];
}

export interface EstadoDaEmenda {
  readonly codigoNaFonte: string;
  apuracao: ApuracaoDaEmenda;
  captura: CapturaId;
}

export interface DadosDaEmenda {
  readonly codigoNaFonte: string;
  readonly apuracao: ApuracaoDaEmenda;
  readonly captura: CapturaId;
  readonly agora: Date;
}

const FASES = [
  'empenhado',
  'liquidado',
  'pago',
  'restosInscritos',
  'restosCancelados',
  'restosPagos',
] as const satisfies readonly (keyof Execucao)[];

/**
 * Emenda parlamentar ao orçamento: quem indicou, para onde e quanto já foi empenhado, liquidado e
 * pago, com a captura que prova. A fonte informa valores acumulados; a mudança deles vira
 * `ExecucaoDaEmendaAtualizada`, e outra correção, `EmendaRetificada`.
 */
export class Emenda extends AggregateRoot<EmendaId> {
  private constructor(
    id: EmendaId,
    private readonly estado: EstadoDaEmenda,
  ) {
    super(id);
  }

  static registrar(dados: DadosDaEmenda): Result<Emenda, DomainError> {
    if (!/^\d+$/.test(dados.codigoNaFonte)) {
      return falha(
        'emenda.codigo_invalido',
        `Código de emenda inválido: "${dados.codigoNaFonte}".`,
      );
    }
    const valida = validar(dados.apuracao, dados.agora);
    if (!valida.ok) return valida;

    const emenda = new Emenda(EmendaId.gerar(), {
      codigoNaFonte: dados.codigoNaFonte,
      apuracao: dados.apuracao,
      captura: dados.captura,
    });
    emenda.emitir('EmendaRegistrada', emenda.publicada(), dados.agora);
    return Result.ok(emenda);
  }

  static reconstituir(id: EmendaId, estado: EstadoDaEmenda): Emenda {
    return new Emenda(id, estado);
  }

  get codigoNaFonte(): string {
    return this.estado.codigoNaFonte;
  }

  get apuracao(): ApuracaoDaEmenda {
    return this.estado.apuracao;
  }

  get captura(): CapturaId {
    return this.estado.captura;
  }

  /** A execução somada de todas as destinações. */
  total(): Execucao {
    const somar = (fase: (typeof FASES)[number]): Dinheiro => {
      const [primeira, ...outras] = this.estado.apuracao.destinacoes.map((d) => d.execucao[fase]);
      if (primeira === undefined) throw new Error('Emenda sem destinação.');
      return outras.reduce((soma, valor) => soma.somar(valor), primeira);
    };
    return {
      empenhado: somar('empenhado'),
      liquidado: somar('liquidado'),
      pago: somar('pago'),
      restosInscritos: somar('restosInscritos'),
      restosCancelados: somar('restosCancelados'),
      restosPagos: somar('restosPagos'),
    };
  }

  /**
   * Aplica o que a fonte informa agora. Idempotente: o arquivo é coletado de novo todo dia, e só uma
   * mudança de fato vira evento.
   */
  atualizar(
    apuracao: ApuracaoDaEmenda,
    captura: CapturaId,
    agora: Date,
  ): Result<void, DomainError> {
    const valida = validar(apuracao, agora);
    if (!valida.ok) return valida;
    const anterior = this.estado.apuracao;
    const mesmaExecucao = mesmasDestinacoes(anterior.destinacoes, apuracao.destinacoes, true);
    const mesmoResto =
      mesmoCabecalho(anterior, apuracao) &&
      mesmasDestinacoes(anterior.destinacoes, apuracao.destinacoes, false);
    if (mesmaExecucao && mesmoResto) return Result.ok(undefined);

    this.estado.apuracao = apuracao;
    this.estado.captura = captura;
    // Só os valores mudaram: é a execução andando. Qualquer outra mudança é correção da fonte.
    this.emitir(
      mesmoResto ? 'ExecucaoDaEmendaAtualizada' : 'EmendaRetificada',
      this.publicada(),
      agora,
    );
    return Result.ok(undefined);
  }

  private publicada(): EmendaPublicada {
    const a = this.estado.apuracao;
    return {
      codigoNaFonte: this.estado.codigoNaFonte,
      ano: a.ano,
      tipo: a.tipo,
      numero: a.numero,
      autor: {
        pessoaId: a.autor.pessoa?.valor ?? null,
        nomeNaFonte: a.autor.nomeNaFonte,
        codigoNaFonte: a.autor.codigoNaFonte,
      },
      destinacoes: a.destinacoes.map((d) => ({
        localidade: d.localidade,
        municipioIbge: d.municipioIbge,
        ufIbge: d.ufIbge,
        funcao: { ...d.funcao },
        subfuncao: { ...d.subfuncao },
        programa: { ...d.programa },
        acao: { ...d.acao },
        planoOrcamentario: { ...d.planoOrcamentario },
        modalidade: d.modalidade,
        empenhadoCentavos: d.execucao.empenhado.centavos.toString(),
        liquidadoCentavos: d.execucao.liquidado.centavos.toString(),
        pagoCentavos: d.execucao.pago.centavos.toString(),
        restosInscritosCentavos: d.execucao.restosInscritos.centavos.toString(),
        restosCanceladosCentavos: d.execucao.restosCancelados.centavos.toString(),
        restosPagosCentavos: d.execucao.restosPagos.centavos.toString(),
      })),
      capturaId: this.estado.captura.valor,
    };
  }

  private emitir<T extends EventoDeFinancasPublicas['tipo']>(
    tipo: T,
    dados: Extract<EventoDeFinancasPublicas, { tipo: T }>['dados'],
    ocorridoEm: Date,
  ): void {
    this.addDomainEvent(criarEvento({ tipo, idDoAgregado: this.id.valor, dados, ocorridoEm }));
  }
}

/**
 * Invariantes: orçamento de um ano possível, ao menos uma destinação e sem repetir destino, valores
 * das fases não negativos (só o cancelamento de restos pode ser estorno), autor coletivo sem pessoa
 * e modalidade só nas destinações de emenda individual.
 */
function validar(apuracao: ApuracaoDaEmenda, agora: Date): Result<void, DomainError> {
  // O orçamento do ano seguinte é votado no fim do ano corrente.
  if (
    !Number.isInteger(apuracao.ano) ||
    apuracao.ano < 2000 ||
    apuracao.ano > agora.getUTCFullYear() + 1
  ) {
    return falha('emenda.ano_invalido', `Ano de orçamento inválido: ${String(apuracao.ano)}.`);
  }
  if (apuracao.autor.nomeNaFonte.trim().length === 0) {
    return falha('emenda.autor_sem_nome', 'Toda emenda tem o autor que a fonte informa.');
  }
  if (!temAutorIndividual(apuracao.tipo) && apuracao.autor.pessoa !== undefined) {
    return falha(
      'emenda.autor_coletivo_com_pessoa',
      'Emenda de bancada, comissão ou relator tem autor coletivo, não uma pessoa.',
    );
  }
  const individual = temAutorIndividual(apuracao.tipo);
  if (apuracao.destinacoes.some((d) => (d.modalidade !== null) !== individual)) {
    return falha(
      'emenda.modalidade_inconsistente',
      'Toda destinação de emenda individual tem modalidade; a de emenda coletiva, não.',
    );
  }
  if (apuracao.destinacoes.length === 0) {
    return falha('emenda.sem_destinacao', 'A emenda precisa de ao menos uma destinação.');
  }
  const chaves = apuracao.destinacoes.map(chaveDaDestinacao);
  if (new Set(chaves).size !== chaves.length) {
    return falha('emenda.destinacao_repetida', 'A mesma destinação aparece duas vezes.');
  }
  const negativa = apuracao.destinacoes.some((d) =>
    FASES.some((fase) => fase !== 'restosCancelados' && d.execucao[fase].centavos < 0n),
  );
  if (negativa) {
    return falha('emenda.valor_negativo', 'Empenho, liquidação e pagamento não são negativos.');
  }
  return Result.ok(undefined);
}

function chaveDaDestinacao(d: Destinacao): string {
  return [
    d.localidade,
    d.funcao.codigo,
    d.subfuncao.codigo,
    d.programa.codigo,
    d.acao.codigo,
    d.planoOrcamentario.codigo,
  ].join('|');
}

function mesmoCabecalho(a: ApuracaoDaEmenda, b: ApuracaoDaEmenda): boolean {
  return (
    a.ano === b.ano &&
    a.tipo === b.tipo &&
    a.numero === b.numero &&
    a.autor.nomeNaFonte === b.autor.nomeNaFonte &&
    a.autor.codigoNaFonte === b.autor.codigoNaFonte &&
    (a.autor.pessoa === undefined || b.autor.pessoa === undefined
      ? a.autor.pessoa === b.autor.pessoa
      : a.autor.pessoa.equals(b.autor.pessoa))
  );
}

/**
 * Compara as destinações na ordem do destino, que não depende da fonte. Com `valores`, compara só a
 * execução; sem, só o destino e a classificação.
 */
function mesmasDestinacoes(
  a: readonly Destinacao[],
  b: readonly Destinacao[],
  valores: boolean,
): boolean {
  if (a.length !== b.length) return false;
  const porChave = new Map(b.map((d) => [chaveDaDestinacao(d), d]));
  return a.every((x) => {
    const y = porChave.get(chaveDaDestinacao(x));
    if (y === undefined) return false;
    if (valores) return FASES.every((fase) => x.execucao[fase].equals(y.execucao[fase]));
    return (
      x.municipioIbge === y.municipioIbge &&
      x.ufIbge === y.ufIbge &&
      x.modalidade === y.modalidade &&
      x.funcao.nome === y.funcao.nome &&
      x.subfuncao.nome === y.subfuncao.nome &&
      x.programa.nome === y.programa.nome &&
      x.acao.nome === y.acao.nome &&
      x.planoOrcamentario.nome === y.planoOrcamentario.nome
    );
  });
}

function falha(codigo: string, mensagem: string): Result<never, DomainError> {
  return Result.fail(new DomainError(codigo, mensagem));
}
