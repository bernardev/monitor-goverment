import {
  AggregateRoot,
  type Dinheiro,
  DomainError,
  Result,
  criarEvento,
} from '@prometeu/shared-kernel';

import type { Classificacao } from './emenda.js';
import type { ConvenioPublicado, EventoDeFinancasPublicas } from './eventos.js';
import { type CapturaId, ConvenioId } from './identificadores.js';

/** Emenda que paga o convênio, na classificação e localidade em que a fonte os liga. */
export interface EmendaDoConvenio {
  readonly codigoDaEmenda: string;
  readonly funcao: Classificacao;
  readonly subfuncao: Classificacao;
  /** Como a fonte descreve o lugar do gasto (`SÃO PAULO (UF)`, `SOUSA - PB`, `Nacional`). */
  readonly localidade: string;
}

/** O que a fonte informa sobre o convênio. Pode mudar a cada coleta (um aditivo muda o valor). */
export interface ApuracaoDoConvenio {
  /** Quem recebe o dinheiro e executa o objeto. A fonte só dá o nome. */
  readonly convenente: string;
  readonly objeto: string | null;
  /** Dia da publicação, `aaaa-mm-dd`. */
  readonly publicadoEm: string;
  /** O valor do convênio inteiro, não a parte de cada emenda. */
  readonly valor: Dinheiro;
  readonly emendas: readonly EmendaDoConvenio[];
}

export interface EstadoDoConvenio {
  readonly numero: string;
  apuracao: ApuracaoDoConvenio;
  captura: CapturaId;
}

export interface DadosDoConvenio {
  readonly numero: string;
  readonly apuracao: ApuracaoDoConvenio;
  readonly captura: CapturaId;
  readonly agora: Date;
}

const DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Convênio: o acordo pelo qual a União repassa dinheiro a um convenente para executar um objeto. Uma
 * ou mais emendas o pagam; identificado pelo número na fonte.
 */
export class Convenio extends AggregateRoot<ConvenioId> {
  private constructor(
    id: ConvenioId,
    private readonly estado: EstadoDoConvenio,
  ) {
    super(id);
  }

  static registrar(dados: DadosDoConvenio): Result<Convenio, DomainError> {
    if (!/^[0-9A-Z]+$/.test(dados.numero)) {
      return falha('convenio.numero_invalido', `Número de convênio inválido: "${dados.numero}".`);
    }
    const valida = validar(dados.apuracao, dados.agora);
    if (!valida.ok) return valida;
    const convenio = new Convenio(ConvenioId.gerar(), {
      numero: dados.numero,
      apuracao: { ...dados.apuracao, emendas: ordenadas(dados.apuracao.emendas) },
      captura: dados.captura,
    });
    convenio.emitir('ConvenioRegistrado', dados.agora);
    return Result.ok(convenio);
  }

  static reconstituir(id: ConvenioId, estado: EstadoDoConvenio): Convenio {
    return new Convenio(id, estado);
  }

  get numero(): string {
    return this.estado.numero;
  }

  get apuracao(): ApuracaoDoConvenio {
    return this.estado.apuracao;
  }

  get captura(): CapturaId {
    return this.estado.captura;
  }

  /** Aplica o que a fonte informa agora. Idempotente: só uma mudança de fato vira evento. */
  atualizar(
    apuracao: ApuracaoDoConvenio,
    captura: CapturaId,
    agora: Date,
  ): Result<void, DomainError> {
    const valida = validar(apuracao, agora);
    if (!valida.ok) return valida;
    const nova = { ...apuracao, emendas: ordenadas(apuracao.emendas) };
    if (mesmaApuracao(this.estado.apuracao, nova)) return Result.ok(undefined);
    this.estado.apuracao = nova;
    this.estado.captura = captura;
    this.emitir('ConvenioAtualizado', agora);
    return Result.ok(undefined);
  }

  private emitir(
    tipo: Extract<EventoDeFinancasPublicas['tipo'], `Convenio${string}`>,
    ocorridoEm: Date,
  ): void {
    const a = this.estado.apuracao;
    const dados: ConvenioPublicado = {
      numero: this.estado.numero,
      convenente: a.convenente,
      objeto: a.objeto,
      publicadoEm: a.publicadoEm,
      valorCentavos: a.valor.centavos.toString(),
      emendas: a.emendas.map((e) => ({
        codigoDaEmenda: e.codigoDaEmenda,
        funcao: { ...e.funcao },
        subfuncao: { ...e.subfuncao },
        localidade: e.localidade,
      })),
      capturaId: this.estado.captura.valor,
    };
    this.addDomainEvent(criarEvento({ tipo, idDoAgregado: this.id.valor, dados, ocorridoEm }));
  }
}

/**
 * Invariantes: convenente informado, data de publicação real e não futura, valor não negativo, ao
 * menos uma emenda e sem repetir a mesma ligação.
 */
function validar(apuracao: ApuracaoDoConvenio, agora: Date): Result<void, DomainError> {
  if (apuracao.convenente.trim().length === 0) {
    return falha('convenio.sem_convenente', 'Todo convênio tem um convenente.');
  }
  if (!diaReal(apuracao.publicadoEm) || apuracao.publicadoEm > agora.toISOString().slice(0, 10)) {
    return falha(
      'convenio.publicacao_invalida',
      `Data de publicação inválida: "${apuracao.publicadoEm}".`,
    );
  }
  if (apuracao.valor.ehNegativo()) {
    return falha('convenio.valor_negativo', 'O valor do convênio não é negativo.');
  }
  if (apuracao.emendas.length === 0) {
    return falha('convenio.sem_emenda', 'O convênio precisa de ao menos uma emenda que o pague.');
  }
  if (apuracao.emendas.some((e) => !/^\d+$/.test(e.codigoDaEmenda))) {
    return falha('convenio.emenda_invalida', 'Código de emenda inválido no convênio.');
  }
  const chaves = apuracao.emendas.map(chaveDaEmenda);
  if (new Set(chaves).size !== chaves.length) {
    return falha('convenio.emenda_repetida', 'A mesma emenda aparece duas vezes no convênio.');
  }
  return Result.ok(undefined);
}

function diaReal(dia: string): boolean {
  const partes = DIA.exec(dia);
  if (!partes) return false;
  const data = new Date(`${dia}T00:00:00.000Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === dia;
}

function chaveDaEmenda(e: EmendaDoConvenio): string {
  return [e.codigoDaEmenda, e.funcao.codigo, e.subfuncao.codigo, e.localidade].join('|');
}

/** A ordem não depende da fonte. */
function ordenadas(emendas: readonly EmendaDoConvenio[]): readonly EmendaDoConvenio[] {
  return [...emendas].sort((a, b) => {
    const x = chaveDaEmenda(a);
    const y = chaveDaEmenda(b);
    return x < y ? -1 : x > y ? 1 : 0;
  });
}

/** Compara apurações com as emendas já ordenadas. */
function mesmaApuracao(a: ApuracaoDoConvenio, b: ApuracaoDoConvenio): boolean {
  return (
    a.convenente === b.convenente &&
    a.objeto === b.objeto &&
    a.publicadoEm === b.publicadoEm &&
    a.valor.equals(b.valor) &&
    a.emendas.length === b.emendas.length &&
    a.emendas.every((x, i) => {
      const y = b.emendas[i];
      return (
        y !== undefined &&
        chaveDaEmenda(x) === chaveDaEmenda(y) &&
        x.funcao.nome === y.funcao.nome &&
        x.subfuncao.nome === y.subfuncao.nome
      );
    })
  );
}

function falha(codigo: string, mensagem: string): Result<never, DomainError> {
  return Result.fail(new DomainError(codigo, mensagem));
}
