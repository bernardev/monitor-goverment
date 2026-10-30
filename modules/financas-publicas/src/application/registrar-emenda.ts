import { Dinheiro, type DomainError, Result } from '@prometeu/shared-kernel';

import { type ApuracaoDaEmenda, type Destinacao, Emenda, type Execucao } from '../domain/emenda.js';
import { type TipoDeEmenda, temAutorIndividual } from '../domain/tipo-de-emenda.js';
import type {
  AutoresDasEmendas,
  EmendaRepository,
  OrigemDoDado,
  RegistroDeCapturas,
  Relogio,
} from './portas.js';

type EmCentavos<T> = { readonly [K in keyof T]: bigint };

export interface RegistrarEmendaInput {
  readonly codigoNaFonte: string;
  readonly ano: number;
  readonly tipo: TipoDeEmenda;
  readonly numero: string;
  readonly autor: { readonly nomeNaFonte: string; readonly codigoNaFonte: string };
  readonly destinacoes: readonly (Omit<Destinacao, 'execucao'> & {
    readonly execucao: EmCentavos<Execucao>;
  })[];
  readonly origem: OrigemDoDado;
}

export interface RegistrarEmendaOutput {
  readonly emendaId: string;
  readonly nova: boolean;
}

/**
 * Registra ou atualiza uma emenda, com a captura que a prova. O autor de emenda individual é ligado
 * ao parlamentar quando Agentes Públicos o identifica pelo nome; sem identificação, fica o nome da
 * fonte, sem recusar a emenda.
 */
export class RegistrarEmenda {
  constructor(
    private readonly emendas: EmendaRepository,
    private readonly autores: AutoresDasEmendas,
    private readonly capturas: RegistroDeCapturas,
    private readonly relogio: Relogio,
  ) {}

  async execute(
    entrada: RegistrarEmendaInput,
  ): Promise<Result<RegistrarEmendaOutput, DomainError>> {
    const pessoa = temAutorIndividual(entrada.tipo)
      ? await this.autores.parlamentarPeloNome(entrada.autor.nomeNaFonte, entrada.ano)
      : undefined;
    const destinacoes: Destinacao[] = entrada.destinacoes.map(({ execucao, ...destino }) => ({
      ...destino,
      execucao: paraExecucao(execucao),
    }));
    const apuracao: ApuracaoDaEmenda = {
      ano: entrada.ano,
      tipo: entrada.tipo,
      numero: entrada.numero,
      autor: { ...entrada.autor, pessoa },
      destinacoes,
    };

    const captura = await this.capturas.registrar(entrada.origem);
    if (!captura.ok) return captura;
    const agora = this.relogio.agora();
    const existente = await this.emendas.buscar(entrada.codigoNaFonte);
    if (existente) {
      const atualizada = existente.atualizar(apuracao, captura.value, agora);
      if (!atualizada.ok) return atualizada;
      await this.emendas.salvar(existente);
      return Result.ok({ emendaId: existente.id.valor, nova: false });
    }
    const emenda = Emenda.registrar({
      codigoNaFonte: entrada.codigoNaFonte,
      apuracao,
      captura: captura.value,
      agora,
    });
    if (!emenda.ok) return emenda;
    await this.emendas.salvar(emenda.value);
    return Result.ok({ emendaId: emenda.value.id.valor, nova: true });
  }
}

function paraExecucao(e: EmCentavos<Execucao>): Execucao {
  return {
    empenhado: emDinheiro(e.empenhado),
    liquidado: emDinheiro(e.liquidado),
    pago: emDinheiro(e.pago),
    restosInscritos: emDinheiro(e.restosInscritos),
    restosCancelados: emDinheiro(e.restosCancelados),
    restosPagos: emDinheiro(e.restosPagos),
  };
}

function emDinheiro(centavos: bigint): Dinheiro {
  const valor = Dinheiro.deCentavos(centavos);
  // Centavos em bigint são sempre inteiros: a conversão não falha.
  if (!valor.ok) throw new Error(valor.error.message);
  return valor.value;
}
