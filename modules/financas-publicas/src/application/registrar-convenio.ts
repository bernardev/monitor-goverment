import { Dinheiro, type DomainError, Result } from '@prometeu/shared-kernel';

import { type ApuracaoDoConvenio, Convenio } from '../domain/convenio.js';
import type { ConvenioRepository, OrigemDoDado, RegistroDeCapturas, Relogio } from './portas.js';

export interface RegistrarConvenioInput {
  readonly numero: string;
  readonly apuracao: Omit<ApuracaoDoConvenio, 'valor'> & { readonly valor: bigint };
  readonly origem: OrigemDoDado;
}

export interface RegistrarConvenioOutput {
  readonly convenioId: string;
  readonly novo: boolean;
}

/** Registra ou atualiza um convênio pago com emendas, com a captura que o prova. */
export class RegistrarConvenio {
  constructor(
    private readonly convenios: ConvenioRepository,
    private readonly capturas: RegistroDeCapturas,
    private readonly relogio: Relogio,
  ) {}

  async execute(
    entrada: RegistrarConvenioInput,
  ): Promise<Result<RegistrarConvenioOutput, DomainError>> {
    const valor = Dinheiro.deCentavos(entrada.apuracao.valor);
    if (!valor.ok) return valor;
    const apuracao: ApuracaoDoConvenio = { ...entrada.apuracao, valor: valor.value };

    const captura = await this.capturas.registrar(entrada.origem);
    if (!captura.ok) return captura;
    const agora = this.relogio.agora();
    const existente = await this.convenios.buscar(entrada.numero);
    if (existente) {
      const atualizado = existente.atualizar(apuracao, captura.value, agora);
      if (!atualizado.ok) return atualizado;
      await this.convenios.salvar(existente);
      return Result.ok({ convenioId: existente.id.valor, novo: false });
    }
    const convenio = Convenio.registrar({
      numero: entrada.numero,
      apuracao,
      captura: captura.value,
      agora,
    });
    if (!convenio.ok) return convenio;
    await this.convenios.salvar(convenio.value);
    return Result.ok({ convenioId: convenio.value.id.valor, novo: true });
  }
}
