import { AggregateRoot, DomainError, Result, criarEvento } from '@prometeu/shared-kernel';

import type { CasaLegislativa } from './casa-legislativa.js';
import type { DiaDeSessao } from './dia-de-sessao.js';
import type { EventoDeAtividadeLegislativa, VotacaoNominalPublicada } from './eventos.js';
import {
  type CapturaId,
  type MandatoId,
  type PessoaId,
  VotacaoNominalId,
} from './identificadores.js';
import type { MandatoVigente } from './mandato-vigente.js';
import type { OpcaoDeVoto, ResultadoDaVotacao } from './voto.js';

/** Proposição que a votação afetou, como a casa a identifica. */
export interface ProposicaoAfetada {
  readonly codigoNaFonte: string;
  readonly sigla: string;
  readonly numero: number;
  readonly ano: number;
  readonly ementa: string | null;
}

export interface VotoApurado {
  /** Mandato exercido no instante do voto, informado por Agentes Públicos. */
  readonly mandato: MandatoVigente;
  readonly opcao: OpcaoDeVoto;
  /** Como a casa escreveu o voto (`Artigo 17`); `null` na votação secreta. */
  readonly registroNaFonte: string | null;
  readonly registradoEm: Date;
  readonly siglaPartidoNaFonte: string | null;
}

/** O que a casa informou sobre a votação. Pode ser corrigido depois. */
export interface ApuracaoDaVotacao {
  readonly dia: DiaDeSessao;
  readonly registradaEm: Date;
  readonly descricao: string;
  readonly resultado: ResultadoDaVotacao;
  readonly proposicoes: readonly ProposicaoAfetada[];
  readonly votos: readonly VotoApurado[];
}

export interface Voto {
  readonly pessoa: PessoaId;
  readonly mandato: MandatoId;
  readonly opcao: OpcaoDeVoto;
  readonly registroNaFonte: string | null;
  readonly registradoEm: Date;
  readonly siglaPartidoNaFonte: string | null;
}

export interface EstadoDaVotacao {
  readonly casa: CasaLegislativa;
  readonly codigoNaFonte: string;
  dia: DiaDeSessao;
  registradaEm: Date;
  descricao: string;
  resultado: ResultadoDaVotacao;
  proposicoes: readonly ProposicaoAfetada[];
  votos: readonly Voto[];
  captura: CapturaId;
  capturaDosVotos: CapturaId;
}

export interface DadosDaVotacao {
  readonly casa: CasaLegislativa;
  readonly codigoNaFonte: string;
  readonly apuracao: ApuracaoDaVotacao;
  readonly captura: CapturaId;
  readonly capturaDosVotos: CapturaId;
  readonly agora: Date;
}

/**
 * Votação nominal do plenário: a decisão e o voto de cada parlamentar, com as capturas que os provam.
 * Só entra quem tem voto registrado; a casa não diz quem faltou à votação, e este agregado não
 * adivinha (a frequência do dia é outro fato, em `RegistroDeFrequencia`).
 *
 * A casa pode corrigir a votação depois: a correção vira `VotacaoNominalRetificada`, e a versão
 * anterior continua nos eventos.
 */
export class VotacaoNominal extends AggregateRoot<VotacaoNominalId> {
  private constructor(
    id: VotacaoNominalId,
    private readonly estado: EstadoDaVotacao,
  ) {
    super(id);
  }

  static registrar(dados: DadosDaVotacao): Result<VotacaoNominal, DomainError> {
    if (dados.codigoNaFonte.trim().length === 0) {
      return falha('votacao.sem_codigo', 'A votação precisa do código da fonte.');
    }
    const votos = validar(dados.apuracao, dados.agora);
    if (!votos.ok) return votos;

    const votacao = new VotacaoNominal(VotacaoNominalId.gerar(), {
      casa: dados.casa,
      codigoNaFonte: dados.codigoNaFonte,
      ...semVotos(dados.apuracao),
      votos: votos.value,
      captura: dados.captura,
      capturaDosVotos: dados.capturaDosVotos,
    });
    votacao.emitir('VotacaoNominalRegistrada', votacao.publicada(), dados.agora);
    return Result.ok(votacao);
  }

  static reconstituir(id: VotacaoNominalId, estado: EstadoDaVotacao): VotacaoNominal {
    return new VotacaoNominal(id, estado);
  }

  get casa(): CasaLegislativa {
    return this.estado.casa;
  }

  get codigoNaFonte(): string {
    return this.estado.codigoNaFonte;
  }

  get dia(): DiaDeSessao {
    return this.estado.dia;
  }

  get registradaEm(): Date {
    return this.estado.registradaEm;
  }

  get descricao(): string {
    return this.estado.descricao;
  }

  get resultado(): ResultadoDaVotacao {
    return this.estado.resultado;
  }

  get proposicoes(): readonly ProposicaoAfetada[] {
    return this.estado.proposicoes;
  }

  get votos(): readonly Voto[] {
    return this.estado.votos;
  }

  get captura(): CapturaId {
    return this.estado.captura;
  }

  get capturaDosVotos(): CapturaId {
    return this.estado.capturaDosVotos;
  }

  /** Votação secreta: todos os votos são `secreto` (a casa garante tudo ou nada). */
  get secreta(): boolean {
    return this.estado.votos.every((v) => v.opcao === 'secreto');
  }

  /** Quantos votos em cada opção. */
  placar(): Record<OpcaoDeVoto, number> {
    const placar = {
      sim: 0,
      nao: 0,
      abstencao: 0,
      obstrucao: 0,
      presidente_da_sessao: 0,
      secreto: 0,
    };
    for (const voto of this.estado.votos) placar[voto.opcao] += 1;
    return placar;
  }

  /**
   * Aplica o que a casa informa agora sobre a votação. Idempotente: a fonte é coletada de novo todo
   * dia, e só uma mudança de fato vira evento.
   */
  retificar(
    apuracao: ApuracaoDaVotacao,
    captura: CapturaId,
    capturaDosVotos: CapturaId,
    agora: Date,
  ): Result<void, DomainError> {
    const votos = validar(apuracao, agora);
    if (!votos.ok) return votos;
    const nova = { ...semVotos(apuracao), votos: votos.value };
    if (mesmaApuracao(this.estado, nova)) return Result.ok(undefined);

    this.estado.dia = nova.dia;
    this.estado.registradaEm = nova.registradaEm;
    this.estado.descricao = nova.descricao;
    this.estado.resultado = nova.resultado;
    this.estado.proposicoes = nova.proposicoes;
    this.estado.votos = nova.votos;
    this.estado.captura = captura;
    this.estado.capturaDosVotos = capturaDosVotos;
    this.emitir('VotacaoNominalRetificada', this.publicada(), agora);
    return Result.ok(undefined);
  }

  private publicada(): VotacaoNominalPublicada {
    const e = this.estado;
    return {
      casa: e.casa,
      codigoNaFonte: e.codigoNaFonte,
      dia: e.dia.valor,
      registradaEm: e.registradaEm.toISOString(),
      descricao: e.descricao,
      resultado: e.resultado,
      secreta: this.secreta,
      proposicoes: e.proposicoes.map((p) => ({
        codigoNaFonte: p.codigoNaFonte,
        sigla: p.sigla,
        numero: p.numero,
        ano: p.ano,
        ementa: p.ementa,
      })),
      votos: e.votos.map((v) => ({
        pessoaId: v.pessoa.valor,
        mandatoId: v.mandato.valor,
        opcao: v.opcao,
        registroNaFonte: v.registroNaFonte,
        registradoEm: v.registradoEm.toISOString(),
        siglaPartidoNaFonte: v.siglaPartidoNaFonte,
      })),
      capturaId: e.captura.valor,
      capturaDosVotosId: e.capturaDosVotos.valor,
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
 * Invariantes da apuração: a votação já aconteceu, tem descrição e ao menos um voto; cada
 * parlamentar vota uma vez, dentro do mandato; e o sigilo vale para todos os votos ou para nenhum.
 */
function validar(apuracao: ApuracaoDaVotacao, agora: Date): Result<Voto[], DomainError> {
  if (!apuracao.dia.jaComecou(agora) || apuracao.registradaEm > agora) {
    return falha('votacao.futura', `A votação de ${apuracao.dia.valor} ainda não aconteceu.`);
  }
  if (apuracao.descricao.trim().length === 0) {
    return falha('votacao.sem_descricao', 'A votação precisa da descrição da casa.');
  }
  if (apuracao.votos.length === 0) {
    return falha('votacao.sem_votos', 'Votação nominal sem nenhum voto registrado.');
  }
  const secretos = apuracao.votos.filter((v) => v.opcao === 'secreto').length;
  if (secretos > 0 && secretos < apuracao.votos.length) {
    return falha(
      'votacao.sigilo_parcial',
      'Numa votação secreta todos os votos são secretos; nesta, só alguns são.',
    );
  }

  const pessoas = new Set<string>();
  const votos: Voto[] = [];
  for (const voto of apuracao.votos) {
    const { mandato } = voto;
    if (pessoas.has(mandato.pessoa.valor)) {
      return falha(
        'votacao.voto_repetido',
        `A pessoa ${mandato.pessoa.valor} tem mais de um voto na votação.`,
      );
    }
    pessoas.add(mandato.pessoa.valor);
    if (
      voto.registradoEm < mandato.inicio ||
      (mandato.fim !== null && voto.registradoEm > mandato.fim)
    ) {
      return falha(
        'votacao.voto_fora_do_mandato',
        `O voto de ${voto.registradoEm.toISOString()} está fora do mandato ${mandato.mandato.valor}.`,
      );
    }
    if (voto.opcao !== 'secreto' && !voto.registroNaFonte?.trim()) {
      return falha('votacao.voto_sem_registro', 'Falta a grafia da fonte para o voto.');
    }
    votos.push({
      pessoa: mandato.pessoa,
      mandato: mandato.mandato,
      opcao: voto.opcao,
      registroNaFonte: voto.registroNaFonte,
      registradoEm: voto.registradoEm,
      siglaPartidoNaFonte: voto.siglaPartidoNaFonte,
    });
  }
  // A fonte não garante a ordem da lista; a ordem pela pessoa torna a comparação estável.
  return Result.ok(votos.sort((a, b) => a.pessoa.valor.localeCompare(b.pessoa.valor)));
}

function semVotos(apuracao: ApuracaoDaVotacao): Omit<ApuracaoDaVotacao, 'votos'> {
  return {
    dia: apuracao.dia,
    registradaEm: apuracao.registradaEm,
    descricao: apuracao.descricao,
    resultado: apuracao.resultado,
    proposicoes: apuracao.proposicoes,
  };
}

function mesmaApuracao(
  atual: EstadoDaVotacao,
  nova: Omit<ApuracaoDaVotacao, 'votos'> & { votos: readonly Voto[] },
): boolean {
  return (
    atual.dia.equals(nova.dia) &&
    atual.registradaEm.getTime() === nova.registradaEm.getTime() &&
    atual.descricao === nova.descricao &&
    atual.resultado === nova.resultado &&
    atual.proposicoes.length === nova.proposicoes.length &&
    atual.proposicoes.every((p, i) => mesmaProposicao(p, nova.proposicoes[i])) &&
    atual.votos.length === nova.votos.length &&
    atual.votos.every((v, i) => mesmoVoto(v, nova.votos[i]))
  );
}

function mesmaProposicao(a: ProposicaoAfetada, b: ProposicaoAfetada | undefined): boolean {
  return (
    b !== undefined &&
    a.codigoNaFonte === b.codigoNaFonte &&
    a.sigla === b.sigla &&
    a.numero === b.numero &&
    a.ano === b.ano &&
    a.ementa === b.ementa
  );
}

function mesmoVoto(a: Voto, b: Voto | undefined): boolean {
  return (
    b !== undefined &&
    a.pessoa.equals(b.pessoa) &&
    a.mandato.equals(b.mandato) &&
    a.opcao === b.opcao &&
    a.registroNaFonte === b.registroNaFonte &&
    a.registradoEm.getTime() === b.registradoEm.getTime() &&
    a.siglaPartidoNaFonte === b.siglaPartidoNaFonte
  );
}

function falha(codigo: string, mensagem: string): Result<never, DomainError> {
  return Result.fail(new DomainError(codigo, mensagem));
}
