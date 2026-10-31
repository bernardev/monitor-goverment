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
import type { MotivoDaAusencia } from './motivo-da-ausencia.js';
import type { OpcaoDeVoto, ResultadoDaVotacao, SituacaoSemVoto } from './voto.js';

/** Versão dos eventos da votação: a v2 trouxe quem não votou e o voto sem horário. */
const VERSAO_DOS_EVENTOS = 2;

/** Proposição que a votação afetou, como a casa a identifica. */
export interface ProposicaoAfetada {
  readonly codigoNaFonte: string;
  readonly sigla: string;
  readonly numero: number;
  readonly ano: number;
  readonly ementa: string | null;
}

export interface VotoApurado {
  /** Mandato exercido quando o voto foi dado, informado por Agentes Públicos. */
  readonly mandato: MandatoVigente;
  readonly opcao: OpcaoDeVoto;
  /** Como a casa escreveu o voto (`Artigo 17`); `null` quando a fonte não traz a grafia. */
  readonly registroNaFonte: string | null;
  /** `null`: a casa não informa o horário do voto (Senado); vale o dia da votação. */
  readonly registradoEm: Date | null;
  readonly siglaPartidoNaFonte: string | null;
}

/** Parlamentar em exercício que não votou, com a situação que a casa informou. */
export interface SemVotoApurado {
  readonly mandato: MandatoVigente;
  readonly situacao: SituacaoSemVoto;
  /** Só na ausência justificada. */
  readonly motivo: MotivoDaAusencia | undefined;
  /** Como a casa escreveu a situação (`LS`, `P-NRV`). */
  readonly registroNaFonte: string;
  readonly siglaPartidoNaFonte: string | null;
}

/** O que a casa informou sobre a votação. Pode ser corrigido depois. */
export interface ApuracaoDaVotacao {
  readonly dia: DiaDeSessao;
  /** `null`: a casa não informa o horário (Senado). */
  readonly registradaEm: Date | null;
  readonly descricao: string;
  readonly resultado: ResultadoDaVotacao;
  readonly proposicoes: readonly ProposicaoAfetada[];
  readonly votos: readonly VotoApurado[];
  /**
   * A casa lista todos os parlamentares em exercício, inclusive quem não votou (Senado). Sem a
   * relação completa (Câmara), quem não aparece não é ausente: a fonte só não diz.
   */
  readonly relacaoCompleta: boolean;
  readonly semVoto: readonly SemVotoApurado[];
}

export interface Voto {
  readonly pessoa: PessoaId;
  readonly mandato: MandatoId;
  readonly opcao: OpcaoDeVoto;
  readonly registroNaFonte: string | null;
  readonly registradoEm: Date | null;
  readonly siglaPartidoNaFonte: string | null;
}

export interface SemVoto {
  readonly pessoa: PessoaId;
  readonly mandato: MandatoId;
  readonly situacao: SituacaoSemVoto;
  readonly motivo: MotivoDaAusencia | undefined;
  readonly registroNaFonte: string;
  readonly siglaPartidoNaFonte: string | null;
}

interface Apurada {
  dia: DiaDeSessao;
  registradaEm: Date | null;
  descricao: string;
  resultado: ResultadoDaVotacao;
  proposicoes: readonly ProposicaoAfetada[];
  relacaoCompleta: boolean;
  votos: readonly Voto[];
  semVoto: readonly SemVoto[];
}

export interface EstadoDaVotacao extends Apurada {
  readonly casa: CasaLegislativa;
  readonly codigoNaFonte: string;
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
 * Votação nominal do plenário: a decisão, o voto de cada parlamentar e, quando a casa informa, quem
 * não votou e por quê, com as capturas que os provam. Quando a casa não lista quem não votou, este
 * agregado não adivinha (a frequência do dia é outro fato, em `RegistroDeFrequencia`).
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
    const apurada = validar(dados.apuracao, dados.agora);
    if (!apurada.ok) return apurada;

    const votacao = new VotacaoNominal(VotacaoNominalId.gerar(), {
      casa: dados.casa,
      codigoNaFonte: dados.codigoNaFonte,
      ...apurada.value,
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

  get registradaEm(): Date | null {
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

  get relacaoCompleta(): boolean {
    return this.estado.relacaoCompleta;
  }

  get votos(): readonly Voto[] {
    return this.estado.votos;
  }

  get semVoto(): readonly SemVoto[] {
    return this.estado.semVoto;
  }

  get captura(): CapturaId {
    return this.estado.captura;
  }

  get capturaDosVotos(): CapturaId {
    return this.estado.capturaDosVotos;
  }

  /** Votação secreta: nenhum voto conhecido, só quem votou (e quem presidia). */
  get secreta(): boolean {
    return this.estado.votos.some((v) => v.opcao === 'secreto');
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
    const apurada = validar(apuracao, agora);
    if (!apurada.ok) return apurada;
    if (mesmaApuracao(this.estado, apurada.value)) return Result.ok(undefined);

    const nova = apurada.value;
    this.estado.dia = nova.dia;
    this.estado.registradaEm = nova.registradaEm;
    this.estado.descricao = nova.descricao;
    this.estado.resultado = nova.resultado;
    this.estado.proposicoes = nova.proposicoes;
    this.estado.relacaoCompleta = nova.relacaoCompleta;
    this.estado.votos = nova.votos;
    this.estado.semVoto = nova.semVoto;
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
      registradaEm: e.registradaEm?.toISOString() ?? null,
      descricao: e.descricao,
      resultado: e.resultado,
      secreta: this.secreta,
      relacaoCompleta: e.relacaoCompleta,
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
        registradoEm: v.registradoEm?.toISOString() ?? null,
        siglaPartidoNaFonte: v.siglaPartidoNaFonte,
      })),
      semVoto: e.semVoto.map((s) => ({
        pessoaId: s.pessoa.valor,
        mandatoId: s.mandato.valor,
        situacao: s.situacao,
        motivo: s.motivo
          ? { categoria: s.motivo.categoria, descricaoNaFonte: s.motivo.descricaoNaFonte }
          : null,
        registroNaFonte: s.registroNaFonte,
        siglaPartidoNaFonte: s.siglaPartidoNaFonte,
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
    this.addDomainEvent(
      criarEvento({
        tipo,
        versao: VERSAO_DOS_EVENTOS,
        idDoAgregado: this.id.valor,
        dados,
        ocorridoEm,
      }),
    );
  }
}

/**
 * Invariantes da apuração: a votação já aconteceu, tem descrição e ao menos um voto; cada
 * parlamentar aparece uma vez, dentro do mandato; votação secreta não tem voto conhecido; só a
 * ausência justificada tem motivo; e só a casa que lista todos os parlamentares diz quem não votou.
 */
function validar(apuracao: ApuracaoDaVotacao, agora: Date): Result<Apurada, DomainError> {
  if (
    !apuracao.dia.jaComecou(agora) ||
    (apuracao.registradaEm !== null && apuracao.registradaEm > agora)
  ) {
    return falha('votacao.futura', `A votação de ${apuracao.dia.valor} ainda não aconteceu.`);
  }
  if (apuracao.descricao.trim().length === 0) {
    return falha('votacao.sem_descricao', 'A votação precisa da descrição da casa.');
  }
  if (apuracao.votos.length === 0) {
    return falha('votacao.sem_votos', 'Votação nominal sem nenhum voto registrado.');
  }
  const secreta = apuracao.votos.some((v) => v.opcao === 'secreto');
  const conhecidos = apuracao.votos.some((v) => VOTOS_CONHECIDOS.has(v.opcao));
  if (secreta && conhecidos) {
    return falha(
      'votacao.sigilo_parcial',
      'Numa votação secreta nenhum voto é conhecido; nesta, alguns são.',
    );
  }
  if (!apuracao.relacaoCompleta && apuracao.semVoto.length > 0) {
    return falha(
      'votacao.sem_voto_sem_relacao',
      'Só a casa que lista todos os parlamentares em exercício diz quem não votou.',
    );
  }

  const pessoas = new Set<string>();
  const repetida = (mandato: MandatoVigente): boolean => {
    if (pessoas.has(mandato.pessoa.valor)) return true;
    pessoas.add(mandato.pessoa.valor);
    return false;
  };

  const votos: Voto[] = [];
  for (const voto of apuracao.votos) {
    const { mandato } = voto;
    if (repetida(mandato)) return repetido(mandato);
    if (!noMandato(mandato, apuracao.dia)) return foraDoMandato(mandato);
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

  const semVoto: SemVoto[] = [];
  for (const registro of apuracao.semVoto) {
    const { mandato } = registro;
    if (repetida(mandato)) return repetido(mandato);
    const justificada = registro.situacao === 'ausencia_justificada';
    // De licença, o parlamentar está fora do exercício: a ausência justificada pode ser de um mandato
    // já encerrado, mas nunca de um que ainda não começou.
    const licenciado = justificada && mandato.fim !== null && mandato.fim < apuracao.dia.inicio;
    if (!licenciado && !noMandato(mandato, apuracao.dia)) return foraDoMandato(mandato);
    if (justificada !== (registro.motivo !== undefined)) {
      return falha(
        'votacao.motivo_incoerente',
        'Só a ausência justificada tem motivo, e ela sempre tem.',
      );
    }
    if (registro.registroNaFonte.trim().length === 0) {
      return falha('votacao.sem_registro_na_fonte', 'Falta a grafia da fonte para a situação.');
    }
    semVoto.push({
      pessoa: mandato.pessoa,
      mandato: mandato.mandato,
      situacao: registro.situacao,
      motivo: registro.motivo,
      registroNaFonte: registro.registroNaFonte,
      siglaPartidoNaFonte: registro.siglaPartidoNaFonte,
    });
  }

  // A fonte não garante a ordem das listas; a ordem pela pessoa torna a comparação estável.
  const pelaPessoa = (a: { pessoa: PessoaId }, b: { pessoa: PessoaId }) =>
    a.pessoa.valor.localeCompare(b.pessoa.valor);
  return Result.ok({
    dia: apuracao.dia,
    registradaEm: apuracao.registradaEm,
    descricao: apuracao.descricao,
    resultado: apuracao.resultado,
    proposicoes: apuracao.proposicoes,
    relacaoCompleta: apuracao.relacaoCompleta,
    votos: votos.sort(pelaPessoa),
    semVoto: semVoto.sort(pelaPessoa),
  });
}

const VOTOS_CONHECIDOS: ReadonlySet<OpcaoDeVoto> = new Set([
  'sim',
  'nao',
  'abstencao',
  'obstrucao',
]);

/**
 * O mandato toca o dia da votação. Mesmo com o horário do voto, o dia é a régua: a casa lança posse e
 * afastamento no mesmo dia dos votos, e registra voto minutos depois do afastamento automático do
 * suplente (27/04/2023, às 12h53, com voto às 13h27). Quem tem dois mandatos no dia não vota duas
 * vezes: a pessoa repetida é recusada.
 */
function noMandato(mandato: MandatoVigente, dia: DiaDeSessao): boolean {
  return dia.tocaNoPeriodo(mandato.inicio, mandato.fim);
}

function repetido(mandato: MandatoVigente): Result<never, DomainError> {
  return falha(
    'votacao.voto_repetido',
    `A pessoa ${mandato.pessoa.valor} aparece mais de uma vez na votação.`,
  );
}

function foraDoMandato(mandato: MandatoVigente): Result<never, DomainError> {
  return falha(
    'votacao.voto_fora_do_mandato',
    `O registro na votação está fora do mandato ${mandato.mandato.valor}.`,
  );
}

function mesmaApuracao(atual: Apurada, nova: Apurada): boolean {
  return (
    atual.dia.equals(nova.dia) &&
    mesmoInstante(atual.registradaEm, nova.registradaEm) &&
    atual.descricao === nova.descricao &&
    atual.resultado === nova.resultado &&
    atual.relacaoCompleta === nova.relacaoCompleta &&
    mesmaLista(atual.proposicoes, nova.proposicoes, mesmaProposicao) &&
    mesmaLista(atual.votos, nova.votos, mesmoVoto) &&
    mesmaLista(atual.semVoto, nova.semVoto, mesmoSemVoto)
  );
}

function mesmaLista<T>(a: readonly T[], b: readonly T[], igual: (x: T, y: T) => boolean): boolean {
  return a.length === b.length && a.every((x, i) => i < b.length && igual(x, b[i] as T));
}

function mesmoInstante(a: Date | null, b: Date | null): boolean {
  return a === null || b === null ? a === b : a.getTime() === b.getTime();
}

function mesmaProposicao(a: ProposicaoAfetada, b: ProposicaoAfetada): boolean {
  return (
    a.codigoNaFonte === b.codigoNaFonte &&
    a.sigla === b.sigla &&
    a.numero === b.numero &&
    a.ano === b.ano &&
    a.ementa === b.ementa
  );
}

function mesmoVoto(a: Voto, b: Voto): boolean {
  return (
    a.pessoa.equals(b.pessoa) &&
    a.mandato.equals(b.mandato) &&
    a.opcao === b.opcao &&
    a.registroNaFonte === b.registroNaFonte &&
    mesmoInstante(a.registradoEm, b.registradoEm) &&
    a.siglaPartidoNaFonte === b.siglaPartidoNaFonte
  );
}

function mesmoSemVoto(a: SemVoto, b: SemVoto): boolean {
  const mesmoMotivo =
    a.motivo === undefined || b.motivo === undefined
      ? a.motivo === b.motivo
      : a.motivo.equals(b.motivo);
  return (
    a.pessoa.equals(b.pessoa) &&
    a.mandato.equals(b.mandato) &&
    a.situacao === b.situacao &&
    mesmoMotivo &&
    a.registroNaFonte === b.registroNaFonte &&
    a.siglaPartidoNaFonte === b.siglaPartidoNaFonte
  );
}

function falha(codigo: string, mensagem: string): Result<never, DomainError> {
  return Result.fail(new DomainError(codigo, mensagem));
}
