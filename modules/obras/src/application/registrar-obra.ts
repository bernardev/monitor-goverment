import { Dinheiro, type DomainError, Result } from '@prometeu/shared-kernel';

import { type ApuracaoDaObra, type EmendaDaObra, Obra } from '../domain/obra.js';
import type { ObraRepository, OrigemDoDado, RegistroDeCapturas, Relogio } from './portas.js';

export interface RegistrarObraInput {
  readonly idNaFonte: string;
  readonly apuracao: Omit<ApuracaoDaObra, 'investimentoPrevisto' | 'emendas'> & {
    readonly investimentoPrevisto: bigint;
    readonly emendas: readonly (Omit<EmendaDaObra, 'empenhado'> & { readonly empenhado: bigint })[];
  };
  readonly origem: OrigemDoDado;
}

export interface RegistrarObraOutput {
  readonly obraId: string;
  readonly nova: boolean;
}

/** Registra ou atualiza uma obra paga com emenda, com a captura que a prova. */
export class RegistrarObra {
  constructor(
    private readonly obras: ObraRepository,
    private readonly capturas: RegistroDeCapturas,
    private readonly relogio: Relogio,
  ) {}

  async execute(entrada: RegistrarObraInput): Promise<Result<RegistrarObraOutput, DomainError>> {
    const investimento = Dinheiro.deCentavos(entrada.apuracao.investimentoPrevisto);
    if (!investimento.ok) return investimento;
    const emendas: EmendaDaObra[] = [];
    for (const { empenhado, ...emenda } of entrada.apuracao.emendas) {
      const valor = Dinheiro.deCentavos(empenhado);
      if (!valor.ok) return valor;
      emendas.push({ ...emenda, empenhado: valor.value });
    }
    const apuracao: ApuracaoDaObra = {
      ...entrada.apuracao,
      investimentoPrevisto: investimento.value,
      emendas,
    };

    const captura = await this.capturas.registrar(entrada.origem);
    if (!captura.ok) return captura;
    const agora = this.relogio.agora();
    const existente = await this.obras.buscar(entrada.idNaFonte);
    if (existente) {
      const atualizada = existente.atualizar(apuracao, captura.value, agora);
      if (!atualizada.ok) return atualizada;
      await this.obras.salvar(existente);
      return Result.ok({ obraId: existente.id.valor, nova: false });
    }
    const obra = Obra.registrar({
      idNaFonte: entrada.idNaFonte,
      apuracao,
      captura: captura.value,
      agora,
    });
    if (!obra.ok) return obra;
    await this.obras.salvar(obra.value);
    return Result.ok({ obraId: obra.value.id.valor, nova: true });
  }
}
