import { DomainError, Result } from '@prometeu/shared-kernel';

import type { CasaLegislativa } from '../domain/casa-legislativa.js';
import { DiaDeSessao } from '../domain/dia-de-sessao.js';
import type { MandatoVigente } from '../domain/mandato-vigente.js';
import { MotivoDaAusencia } from '../domain/motivo-da-ausencia.js';
import {
  type ApuracaoDaVotacao,
  type SemVotoApurado,
  VotacaoNominal,
  type VotoApurado,
} from '../domain/votacao-nominal.js';
import type { OpcaoDeVoto, ResultadoDaVotacao, SituacaoSemVoto } from '../domain/voto.js';
import type {
  MandatosDosParlamentares,
  OrigemDoDado,
  ParlamentarNaFonte,
  RegistroDeCapturas,
  Relogio,
  VotacaoNominalRepository,
} from './portas.js';

export interface RegistrarVotacaoNominalInput {
  readonly casa: CasaLegislativa;
  readonly codigoNaFonte: string;
  /** `aaaa-mm-dd`, calendário de Brasília. */
  readonly dia: string;
  /** `null`: a casa não informa o horário (Senado). */
  readonly registradaEm: Date | null;
  readonly descricao: string;
  readonly resultado: ResultadoDaVotacao;
  readonly proposicoes: readonly {
    readonly codigoNaFonte: string;
    readonly sigla: string;
    readonly numero: number;
    readonly ano: number;
    readonly ementa: string | null;
  }[];
  readonly votos: readonly {
    readonly parlamentar: ParlamentarNaFonte;
    readonly opcao: OpcaoDeVoto;
    readonly registroNaFonte: string | null;
    /** `null`: sem horário; o mandato é o exercido no dia da votação. */
    readonly registradoEm: Date | null;
    readonly siglaPartidoNaFonte: string | null;
  }[];
  /** A casa listou todos os parlamentares em exercício (Senado). */
  readonly relacaoCompleta: boolean;
  readonly semVoto: readonly {
    readonly parlamentar: ParlamentarNaFonte;
    readonly situacao: SituacaoSemVoto;
    readonly motivo: { readonly categoria: string; readonly descricaoNaFonte: string } | null;
    readonly registroNaFonte: string;
    readonly siglaPartidoNaFonte: string | null;
  }[];
  /** O detalhe da votação. */
  readonly origem: OrigemDoDado;
  /** A lista de votos. */
  readonly origemDosVotos: OrigemDoDado;
}

export interface RegistrarVotacaoNominalOutput {
  readonly votacaoId: string;
  readonly nova: boolean;
}

/**
 * Registra ou retifica uma votação nominal, com as capturas que a provam. Cada voto é ligado ao
 * mandato exercido quando foi dado (no instante, se a casa informa; senão, no dia); um parlamentar que
 * Agentes Públicos não conhece recusa a votação inteira, para que o placar nunca fique incompleto.
 */
export class RegistrarVotacaoNominal {
  constructor(
    private readonly votacoes: VotacaoNominalRepository,
    private readonly mandatos: MandatosDosParlamentares,
    private readonly capturas: RegistroDeCapturas,
    private readonly relogio: Relogio,
  ) {}

  async execute(
    entrada: RegistrarVotacaoNominalInput,
  ): Promise<Result<RegistrarVotacaoNominalOutput, DomainError>> {
    const dia = DiaDeSessao.de(entrada.dia);
    if (!dia.ok) return dia;

    const semMandato: string[] = [];
    const encontrado = (
      parlamentar: ParlamentarNaFonte,
      mandato: MandatoVigente | undefined,
    ): MandatoVigente | undefined => {
      if (mandato === undefined) semMandato.push(`${parlamentar.fonte}:${parlamentar.codigo}`);
      return mandato;
    };

    const votos: VotoApurado[] = [];
    for (const voto of entrada.votos) {
      // A casa registra voto minutos depois de um afastamento lançado no mesmo dia (o automático do
      // suplente, quando o titular volta): vale o exercício do dia, como na frequência.
      const noInstante =
        voto.registradoEm === null
          ? undefined
          : await this.mandatos.vigenteEm(voto.parlamentar, entrada.casa, voto.registradoEm);
      const mandato = encontrado(
        voto.parlamentar,
        noInstante ?? (await this.mandatos.vigenteNoDia(voto.parlamentar, entrada.casa, dia.value)),
      );
      if (mandato) votos.push({ ...voto, mandato });
    }
    const semVoto: SemVotoApurado[] = [];
    for (const registro of entrada.semVoto) {
      // De licença, o parlamentar está fora do exercício, mas a casa o lista com o motivo até o
      // suplente tomar posse: a ausência fica ligada ao exercício que a licença encerrou.
      const noDia = await this.mandatos.vigenteNoDia(registro.parlamentar, entrada.casa, dia.value);
      const mandato = encontrado(
        registro.parlamentar,
        noDia === undefined && registro.situacao === 'ausencia_justificada'
          ? await this.mandatos.ultimoAntesDoDia(registro.parlamentar, entrada.casa, dia.value)
          : noDia,
      );
      let motivo: MotivoDaAusencia | undefined;
      if (registro.motivo !== null) {
        const criado = MotivoDaAusencia.criar(
          registro.motivo.categoria,
          registro.motivo.descricaoNaFonte,
        );
        if (!criado.ok) return criado;
        motivo = criado.value;
      }
      if (mandato) semVoto.push({ ...registro, mandato, motivo });
    }
    if (semMandato.length > 0) {
      return Result.fail(
        new DomainError(
          'votacao.sem_mandato',
          `Sem mandato quando a votação aconteceu: ${semMandato.join(', ')}. ` +
            'Agentes Públicos ainda não importou estes parlamentares?',
          { codigoNaFonte: entrada.codigoNaFonte, parlamentares: semMandato },
        ),
      );
    }

    const captura = await this.capturas.registrar(entrada.origem);
    if (!captura.ok) return captura;
    const capturaDosVotos = await this.capturas.registrar(entrada.origemDosVotos);
    if (!capturaDosVotos.ok) return capturaDosVotos;

    const apuracao: ApuracaoDaVotacao = {
      dia: dia.value,
      registradaEm: entrada.registradaEm,
      descricao: entrada.descricao,
      resultado: entrada.resultado,
      proposicoes: entrada.proposicoes,
      votos,
      relacaoCompleta: entrada.relacaoCompleta,
      semVoto,
    };
    const agora = this.relogio.agora();
    const existente = await this.votacoes.buscar(entrada.casa, entrada.codigoNaFonte);
    if (existente) {
      const retificada = existente.retificar(apuracao, captura.value, capturaDosVotos.value, agora);
      if (!retificada.ok) return retificada;
      await this.votacoes.salvar(existente);
      return Result.ok({ votacaoId: existente.id.valor, nova: false });
    }

    const votacao = VotacaoNominal.registrar({
      casa: entrada.casa,
      codigoNaFonte: entrada.codigoNaFonte,
      apuracao,
      captura: captura.value,
      capturaDosVotos: capturaDosVotos.value,
      agora,
    });
    if (!votacao.ok) return votacao;
    await this.votacoes.salvar(votacao.value);
    return Result.ok({ votacaoId: votacao.value.id.valor, nova: true });
  }
}
