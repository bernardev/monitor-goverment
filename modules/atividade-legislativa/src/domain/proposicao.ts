import { AggregateRoot, DomainError, Result, criarEvento } from '@prometeu/shared-kernel';

import type { CasaLegislativa } from './casa-legislativa.js';
import type { EventoDeAtividadeLegislativa, ProposicaoPublicada } from './eventos.js';
import { type CapturaId, type PessoaId, ProposicaoId } from './identificadores.js';
import type { TipoDeProposicao } from './tipo-de-proposicao.js';

export interface Autor {
  /** A pessoa, quando o autor é parlamentar que Agentes Públicos conhece. */
  readonly pessoa: PessoaId | undefined;
  /** Como a casa nomeia o autor (`Poder Executivo`, `Ana Exemplo`). */
  readonly nomeNaFonte: string;
  readonly tipoNaFonte: string;
  /** Autor de fato, e não só quem assina junto. */
  readonly proponente: boolean;
}

/** Um movimento da proposição: um ato num órgão, numa data. */
export interface Tramitacao {
  readonly em: Date;
  readonly orgao: string | null;
  readonly descricao: string;
  /** A situação em que o ato deixou a proposição (`Aguardando Parecer`). */
  readonly situacao: string | null;
  readonly despacho: string | null;
}

export interface SituacaoAtual {
  readonly descricao: string;
  readonly desde: Date;
  readonly orgao: string | null;
}

/** O que a casa informa sobre a proposição. Pode mudar a cada coleta. */
export interface ApuracaoDaProposicao {
  readonly sigla: TipoDeProposicao;
  readonly numero: number;
  readonly ano: number;
  readonly ementa: string | null;
  readonly apresentadaEm: Date | null;
  readonly autores: readonly Autor[];
  readonly situacao: SituacaoAtual | null;
  /** Em ordem cronológica. */
  readonly tramitacoes: readonly Tramitacao[];
  /** A norma que a proposição gerou (`Lei nº 15.018 de 12/11/2024`). */
  readonly normaGerada: string | null;
  readonly urlDoTexto: string | null;
}

export interface EstadoDaProposicao {
  readonly casa: CasaLegislativa;
  readonly codigoNaFonte: string;
  apuracao: ApuracaoDaProposicao;
  captura: CapturaId;
}

export interface DadosDaProposicao {
  readonly casa: CasaLegislativa;
  readonly codigoNaFonte: string;
  readonly apuracao: ApuracaoDaProposicao;
  readonly captura: CapturaId;
  readonly agora: Date;
}

/**
 * Proposição numa casa: identificação, autoria, situação atual e o histórico de tramitação, com a
 * captura que os prova. A mesma matéria nas duas casas são duas proposições (a ligação entre elas
 * fica para depois).
 *
 * Tramitação nova vira `TramitacaoAvancou`; outra correção da casa, `ProposicaoRetificada`. A versão
 * anterior continua nos eventos.
 */
export class Proposicao extends AggregateRoot<ProposicaoId> {
  private constructor(
    id: ProposicaoId,
    private readonly estado: EstadoDaProposicao,
  ) {
    super(id);
  }

  static registrar(dados: DadosDaProposicao): Result<Proposicao, DomainError> {
    if (dados.codigoNaFonte.trim().length === 0) {
      return falha('proposicao.sem_codigo', 'A proposição precisa do código da fonte.');
    }
    const valida = validar(dados.apuracao, dados.agora);
    if (!valida.ok) return valida;

    const proposicao = new Proposicao(ProposicaoId.gerar(), {
      casa: dados.casa,
      codigoNaFonte: dados.codigoNaFonte,
      apuracao: dados.apuracao,
      captura: dados.captura,
    });
    proposicao.emitir('ProposicaoRegistrada', proposicao.publicada(), dados.agora);
    return Result.ok(proposicao);
  }

  static reconstituir(id: ProposicaoId, estado: EstadoDaProposicao): Proposicao {
    return new Proposicao(id, estado);
  }

  get casa(): CasaLegislativa {
    return this.estado.casa;
  }

  get codigoNaFonte(): string {
    return this.estado.codigoNaFonte;
  }

  get apuracao(): ApuracaoDaProposicao {
    return this.estado.apuracao;
  }

  get captura(): CapturaId {
    return this.estado.captura;
  }

  /**
   * Aplica o que a casa informa agora. Idempotente: só uma mudança de fato vira evento. Se a
   * tramitação conhecida continua igual e vieram atos novos depois dela, a proposição avançou; se a
   * casa mudou o que já tinha publicado, é retificação.
   */
  atualizar(
    apuracao: ApuracaoDaProposicao,
    captura: CapturaId,
    agora: Date,
  ): Result<void, DomainError> {
    const valida = validar(apuracao, agora);
    if (!valida.ok) return valida;
    const anterior = this.estado.apuracao;
    if (mesmaApuracao(anterior, apuracao)) return Result.ok(undefined);

    const conhecidas = anterior.tramitacoes;
    const avancou =
      apuracao.tramitacoes.length > conhecidas.length &&
      conhecidas.every((t, i) => mesmaTramitacao(t, apuracao.tramitacoes[i]));
    this.estado.apuracao = apuracao;
    this.estado.captura = captura;
    if (avancou) {
      this.emitir(
        'TramitacaoAvancou',
        { ...this.publicada(), novasTramitacoes: apuracao.tramitacoes.length - conhecidas.length },
        agora,
      );
    } else {
      this.emitir('ProposicaoRetificada', this.publicada(), agora);
    }
    return Result.ok(undefined);
  }

  private publicada(): ProposicaoPublicada {
    const a = this.estado.apuracao;
    return {
      casa: this.estado.casa,
      codigoNaFonte: this.estado.codigoNaFonte,
      sigla: a.sigla,
      numero: a.numero,
      ano: a.ano,
      ementa: a.ementa,
      apresentadaEm: a.apresentadaEm?.toISOString() ?? null,
      autores: a.autores.map((autor) => ({
        pessoaId: autor.pessoa?.valor ?? null,
        nomeNaFonte: autor.nomeNaFonte,
        tipoNaFonte: autor.tipoNaFonte,
        proponente: autor.proponente,
      })),
      situacao: a.situacao
        ? {
            descricao: a.situacao.descricao,
            desde: a.situacao.desde.toISOString(),
            orgao: a.situacao.orgao,
          }
        : null,
      tramitacoes: a.tramitacoes.map((t) => ({
        em: t.em.toISOString(),
        orgao: t.orgao,
        descricao: t.descricao,
        situacao: t.situacao,
        despacho: t.despacho,
      })),
      normaGerada: a.normaGerada,
      urlDoTexto: a.urlDoTexto,
      capturaId: this.estado.captura.valor,
    };
  }

  private emitir<T extends EventoDeAtividadeLegislativa['tipo']>(
    tipo: T,
    dados: Extract<EventoDeAtividadeLegislativa, { tipo: T }>['dados'],
    ocorridoEm: Date,
  ): void {
    this.addDomainEvent(criarEvento({ tipo, idDoAgregado: this.id.valor, dados, ocorridoEm }));
  }
}

/**
 * Invariantes: número e ano válidos, nada no futuro, tramitação em ordem cronológica e cada
 * parlamentar uma vez só entre os autores.
 */
function validar(apuracao: ApuracaoDaProposicao, agora: Date): Result<void, DomainError> {
  if (!Number.isInteger(apuracao.numero) || apuracao.numero <= 0) {
    return falha('proposicao.numero_invalido', `Número inválido: ${String(apuracao.numero)}.`);
  }
  if (
    !Number.isInteger(apuracao.ano) ||
    apuracao.ano < 1824 ||
    apuracao.ano > agora.getUTCFullYear()
  ) {
    return falha('proposicao.ano_invalido', `Ano inválido: ${String(apuracao.ano)}.`);
  }
  if (apuracao.apresentadaEm !== null && apuracao.apresentadaEm > agora) {
    return falha('proposicao.futura', 'A proposição não pode ter sido apresentada no futuro.');
  }
  const datas = apuracao.tramitacoes.map((t) => t.em.getTime());
  if (datas.some((d, i) => d > agora.getTime() || (i > 0 && d < (datas[i - 1] ?? d)))) {
    return falha(
      'proposicao.tramitacao_fora_de_ordem',
      'A tramitação precisa estar em ordem cronológica e no passado.',
    );
  }
  if (apuracao.tramitacoes.some((t) => t.descricao.trim().length === 0)) {
    return falha('proposicao.tramitacao_sem_descricao', 'Todo ato de tramitação tem descrição.');
  }
  const pessoas = apuracao.autores.flatMap((a) => (a.pessoa ? [a.pessoa.valor] : []));
  if (new Set(pessoas).size !== pessoas.length) {
    return falha('proposicao.autor_repetido', 'O mesmo parlamentar aparece duas vezes na autoria.');
  }
  if (apuracao.autores.some((a) => a.nomeNaFonte.trim().length === 0)) {
    return falha('proposicao.autor_sem_nome', 'Todo autor tem o nome que a casa informa.');
  }
  return Result.ok(undefined);
}

function mesmaApuracao(a: ApuracaoDaProposicao, b: ApuracaoDaProposicao): boolean {
  return (
    a.sigla === b.sigla &&
    a.numero === b.numero &&
    a.ano === b.ano &&
    a.ementa === b.ementa &&
    mesmoInstante(a.apresentadaEm, b.apresentadaEm) &&
    a.normaGerada === b.normaGerada &&
    a.urlDoTexto === b.urlDoTexto &&
    mesmaSituacao(a.situacao, b.situacao) &&
    a.autores.length === b.autores.length &&
    a.autores.every((x, i) => mesmoAutor(x, b.autores[i])) &&
    a.tramitacoes.length === b.tramitacoes.length &&
    a.tramitacoes.every((x, i) => mesmaTramitacao(x, b.tramitacoes[i]))
  );
}

function mesmoInstante(a: Date | null, b: Date | null): boolean {
  return a === null || b === null ? a === b : a.getTime() === b.getTime();
}

function mesmaSituacao(a: SituacaoAtual | null, b: SituacaoAtual | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.descricao === b.descricao && a.orgao === b.orgao && a.desde.getTime() === b.desde.getTime()
  );
}

function mesmoAutor(a: Autor, b: Autor | undefined): boolean {
  return (
    b !== undefined &&
    (a.pessoa === undefined || b.pessoa === undefined
      ? a.pessoa === b.pessoa
      : a.pessoa.equals(b.pessoa)) &&
    a.nomeNaFonte === b.nomeNaFonte &&
    a.tipoNaFonte === b.tipoNaFonte &&
    a.proponente === b.proponente
  );
}

function mesmaTramitacao(a: Tramitacao, b: Tramitacao | undefined): boolean {
  return (
    b !== undefined &&
    a.em.getTime() === b.em.getTime() &&
    a.orgao === b.orgao &&
    a.descricao === b.descricao &&
    a.situacao === b.situacao &&
    a.despacho === b.despacho
  );
}

function falha(codigo: string, mensagem: string): Result<never, DomainError> {
  return Result.fail(new DomainError(codigo, mensagem));
}
