import { DomainError, Result } from '@prometeu/shared-kernel';

import type { CasaLegislativa } from '../domain/casa-legislativa.js';
import { DiaDeSessao } from '../domain/dia-de-sessao.js';
import { MotivoDaAusencia } from '../domain/motivo-da-ausencia.js';
import { type Apuracao, RegistroDeFrequencia } from '../domain/registro-de-frequencia.js';
import type { Situacao } from '../domain/situacao.js';
import type {
  MandatosDosParlamentares,
  OrigemDoDado,
  ParlamentarNaFonte,
  RegistroDeCapturas,
  RegistroDeFrequenciaRepository,
  Relogio,
} from './portas.js';

export interface RegistrarFrequenciaInput {
  readonly casa: CasaLegislativa;
  readonly parlamentar: ParlamentarNaFonte;
  /** `aaaa-mm-dd`, calendário de Brasília. */
  readonly dia: string;
  readonly situacao: Situacao;
  readonly motivo: { readonly categoria: string; readonly descricaoNaFonte: string } | null;
  readonly registroNaFonte: string;
  readonly sessoes: readonly { readonly descricao: string; readonly presente: boolean }[];
  readonly origem: OrigemDoDado;
}

export interface RegistrarFrequenciaOutput {
  readonly registroId: string;
  readonly novo: boolean;
}

/**
 * Registra ou retifica a frequência de um parlamentar num dia de sessão, com a captura que a prova.
 * Repetir a mesma entrada não muda nada: a fonte é coletada de novo todos os dias.
 */
export class RegistrarFrequencia {
  constructor(
    private readonly registros: RegistroDeFrequenciaRepository,
    private readonly mandatos: MandatosDosParlamentares,
    private readonly capturas: RegistroDeCapturas,
    private readonly relogio: Relogio,
  ) {}

  async execute(
    entrada: RegistrarFrequenciaInput,
  ): Promise<Result<RegistrarFrequenciaOutput, DomainError>> {
    const dia = DiaDeSessao.de(entrada.dia);
    if (!dia.ok) return dia;
    const apuracao = paraApuracao(entrada);
    if (!apuracao.ok) return apuracao;

    const mandato = await this.mandatos.vigenteNoDia(entrada.parlamentar, entrada.casa, dia.value);
    if (mandato === undefined) {
      return Result.fail(
        new DomainError(
          'frequencia.sem_mandato',
          `Nenhum mandato de ${entrada.parlamentar.fonte}:${entrada.parlamentar.codigo} ` +
            `em ${entrada.dia}. Agentes Públicos ainda não importou este parlamentar?`,
          { ...entrada.parlamentar, dia: entrada.dia },
        ),
      );
    }
    const captura = await this.capturas.registrar(entrada.origem);
    if (!captura.ok) return captura;

    const agora = this.relogio.agora();
    const existente = await this.registros.buscar(entrada.casa, mandato.pessoa, dia.value);
    if (existente) {
      const retificado = existente.retificar(apuracao.value, captura.value, agora);
      if (!retificado.ok) return retificado;
      await this.registros.salvar(existente);
      return Result.ok({ registroId: existente.id.valor, novo: false });
    }

    const registro = RegistroDeFrequencia.registrar({
      casa: entrada.casa,
      dia: dia.value,
      mandato,
      apuracao: apuracao.value,
      captura: captura.value,
      agora,
    });
    if (!registro.ok) return registro;
    await this.registros.salvar(registro.value);
    return Result.ok({ registroId: registro.value.id.valor, novo: true });
  }
}

function paraApuracao(entrada: RegistrarFrequenciaInput): Result<Apuracao, DomainError> {
  let motivo: MotivoDaAusencia | undefined;
  if (entrada.motivo !== null) {
    const criado = MotivoDaAusencia.criar(
      entrada.motivo.categoria,
      entrada.motivo.descricaoNaFonte,
    );
    if (!criado.ok) return criado;
    motivo = criado.value;
  }
  return Result.ok({
    situacao: entrada.situacao,
    motivo,
    registroNaFonte: entrada.registroNaFonte,
    sessoes: entrada.sessoes.map((s) => ({ descricao: s.descricao, presente: s.presente })),
  });
}
