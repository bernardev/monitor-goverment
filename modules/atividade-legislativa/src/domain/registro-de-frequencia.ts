import { AggregateRoot, DomainError, Result, criarEvento } from '@prometeu/shared-kernel';

import type { CasaLegislativa } from './casa-legislativa.js';
import type { DiaDeSessao } from './dia-de-sessao.js';
import type { EventoDeAtividadeLegislativa, FrequenciaPublicada } from './eventos.js';
import {
  type CapturaId,
  type MandatoId,
  type PessoaId,
  RegistroDeFrequenciaId,
} from './identificadores.js';
import type { MotivoDaAusencia } from './motivo-da-ausencia.js';
import type { Situacao } from './situacao.js';

export interface SessaoDoDia {
  readonly descricao: string;
  readonly presente: boolean;
}

/** O que a casa informou sobre o dia: a situação, o motivo e as sessões. */
export interface Apuracao {
  readonly situacao: Situacao;
  readonly motivo: MotivoDaAusencia | undefined;
  /** Como a fonte escreveu a situação (`Presença (~)`), para quem quiser conferir. */
  readonly registroNaFonte: string;
  readonly sessoes: readonly SessaoDoDia[];
}

/** Período do mandato em que a frequência é apurada, informado por Agentes Públicos. */
export interface MandatoVigente {
  readonly mandato: MandatoId;
  readonly pessoa: PessoaId;
  readonly inicio: Date;
  readonly fim: Date | null;
}

export interface DadosDoRegistro {
  readonly casa: CasaLegislativa;
  readonly dia: DiaDeSessao;
  readonly mandato: MandatoVigente;
  readonly apuracao: Apuracao;
  readonly captura: CapturaId;
  readonly agora: Date;
}

export interface EstadoDoRegistro {
  readonly casa: CasaLegislativa;
  readonly dia: DiaDeSessao;
  readonly pessoa: PessoaId;
  readonly mandato: MandatoId;
  apuracao: Apuracao;
  captura: CapturaId;
}

/**
 * Frequência de um parlamentar num dia com sessão do plenário. A ausência é um fato de primeira
 * classe, com motivo e fonte, e não um percentual solto (docs/dominio/mapa-de-contextos.md).
 *
 * A casa pode corrigir o registro depois (uma justificativa costuma chegar dias após a sessão): a
 * correção vira `FrequenciaRetificada`, e o registro anterior continua nos eventos.
 */
export class RegistroDeFrequencia extends AggregateRoot<RegistroDeFrequenciaId> {
  private constructor(
    id: RegistroDeFrequenciaId,
    private readonly estado: EstadoDoRegistro,
  ) {
    super(id);
  }

  static registrar(dados: DadosDoRegistro): Result<RegistroDeFrequencia, DomainError> {
    const valida = validar(dados.apuracao);
    if (!valida.ok) return valida;
    if (!dados.dia.jaComecou(dados.agora)) {
      return falha('frequencia.dia_futuro', `O dia ${dados.dia.valor} ainda não começou.`);
    }
    const instante = dados.dia.meioDia;
    const { inicio, fim } = dados.mandato;
    if (instante < inicio || (fim !== null && instante > fim)) {
      return falha(
        'frequencia.fora_do_mandato',
        `O dia ${dados.dia.valor} está fora do mandato ${dados.mandato.mandato.valor}.`,
      );
    }

    const registro = new RegistroDeFrequencia(RegistroDeFrequenciaId.gerar(), {
      casa: dados.casa,
      dia: dados.dia,
      pessoa: dados.mandato.pessoa,
      mandato: dados.mandato.mandato,
      apuracao: dados.apuracao,
      captura: dados.captura,
    });
    const publicada = registro.publicada();
    if (dados.apuracao.situacao === 'presente') {
      registro.emitir('PresencaRegistrada', publicada, dados.agora);
    } else {
      registro.emitir('AusenciaRegistrada', publicada, dados.agora);
    }
    return Result.ok(registro);
  }

  static reconstituir(id: RegistroDeFrequenciaId, estado: EstadoDoRegistro): RegistroDeFrequencia {
    return new RegistroDeFrequencia(id, estado);
  }

  get casa(): CasaLegislativa {
    return this.estado.casa;
  }

  get dia(): DiaDeSessao {
    return this.estado.dia;
  }

  get pessoa(): PessoaId {
    return this.estado.pessoa;
  }

  get mandato(): MandatoId {
    return this.estado.mandato;
  }

  get apuracao(): Apuracao {
    return this.estado.apuracao;
  }

  get captura(): CapturaId {
    return this.estado.captura;
  }

  /**
   * Aplica o que a casa informa agora sobre o dia. Idempotente: a fonte é coletada de novo todo dia, e
   * só uma mudança de fato vira evento.
   */
  retificar(apuracao: Apuracao, captura: CapturaId, agora: Date): Result<void, DomainError> {
    const valida = validar(apuracao);
    if (!valida.ok) return valida;
    if (mesmaApuracao(this.estado.apuracao, apuracao)) return Result.ok(undefined);

    const anterior = this.estado.apuracao.situacao;
    this.estado.apuracao = apuracao;
    this.estado.captura = captura;
    this.emitir('FrequenciaRetificada', { ...this.publicada(), situacaoAnterior: anterior }, agora);
    return Result.ok(undefined);
  }

  private publicada(): FrequenciaPublicada {
    const { apuracao } = this.estado;
    return {
      casa: this.estado.casa,
      dia: this.estado.dia.valor,
      pessoaId: this.estado.pessoa.valor,
      mandatoId: this.estado.mandato.valor,
      situacao: apuracao.situacao,
      motivo: apuracao.motivo
        ? {
            categoria: apuracao.motivo.categoria,
            descricaoNaFonte: apuracao.motivo.descricaoNaFonte,
          }
        : null,
      registroNaFonte: apuracao.registroNaFonte,
      sessoes: apuracao.sessoes.map((s) => ({ descricao: s.descricao, presente: s.presente })),
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

/** Invariantes da apuração: só a ausência justificada tem motivo, e o dia teve sessão. */
function validar(apuracao: Apuracao): Result<void, DomainError> {
  if (apuracao.situacao === 'ausencia_justificada' && apuracao.motivo === undefined) {
    return falha('frequencia.justificativa_sem_motivo', 'Ausência justificada exige o motivo.');
  }
  if (apuracao.situacao !== 'ausencia_justificada' && apuracao.motivo !== undefined) {
    return falha(
      'frequencia.motivo_sem_justificativa',
      'Só a ausência justificada tem motivo; a casa não aceitou justificativa para este dia.',
    );
  }
  if (apuracao.sessoes.length === 0) {
    return falha('frequencia.sem_sessao', 'Frequência só é apurada em dia com sessão.');
  }
  if (apuracao.registroNaFonte.trim().length === 0) {
    return falha('frequencia.sem_registro_na_fonte', 'Falta a grafia da fonte para a situação.');
  }
  return Result.ok(undefined);
}

function mesmaApuracao(a: Apuracao, b: Apuracao): boolean {
  const mesmoMotivo =
    a.motivo === undefined || b.motivo === undefined
      ? a.motivo === b.motivo
      : a.motivo.equals(b.motivo);
  return (
    a.situacao === b.situacao &&
    mesmoMotivo &&
    a.registroNaFonte === b.registroNaFonte &&
    a.sessoes.length === b.sessoes.length &&
    a.sessoes.every(
      (s, i) => s.descricao === b.sessoes[i]?.descricao && s.presente === b.sessoes[i].presente,
    )
  );
}

function falha(codigo: string, mensagem: string): Result<never, DomainError> {
  return Result.fail(new DomainError(codigo, mensagem));
}
