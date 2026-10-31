import { Dinheiro, type DomainError, Result } from '@prometeu/shared-kernel';

import { FavorecidosDaEmenda, type Recebimento } from '../domain/favorecidos-da-emenda.js';
import type {
  FavorecidosDaEmendaRepository,
  OrigemDoDado,
  RegistroDeCapturas,
  Relogio,
} from './portas.js';

export interface RegistrarFavorecidosDaEmendaInput {
  readonly codigoDaEmenda: string;
  readonly recebimentos: readonly (Omit<Recebimento, 'valor'> & { readonly valor: bigint })[];
  readonly origem: OrigemDoDado;
}

export interface RegistrarFavorecidosDaEmendaOutput {
  readonly favorecidosId: string;
  readonly novos: boolean;
}

/** Registra ou atualiza para quem foi o dinheiro de uma emenda, com a captura que o prova. */
export class RegistrarFavorecidosDaEmenda {
  constructor(
    private readonly favorecidos: FavorecidosDaEmendaRepository,
    private readonly capturas: RegistroDeCapturas,
    private readonly relogio: Relogio,
  ) {}

  async execute(
    entrada: RegistrarFavorecidosDaEmendaInput,
  ): Promise<Result<RegistrarFavorecidosDaEmendaOutput, DomainError>> {
    const recebimentos: Recebimento[] = [];
    for (const { valor, ...recebimento } of entrada.recebimentos) {
      const dinheiro = Dinheiro.deCentavos(valor);
      if (!dinheiro.ok) return dinheiro;
      recebimentos.push({ ...recebimento, valor: dinheiro.value });
    }

    const captura = await this.capturas.registrar(entrada.origem);
    if (!captura.ok) return captura;
    const agora = this.relogio.agora();
    const existentes = await this.favorecidos.buscar(entrada.codigoDaEmenda);
    if (existentes) {
      const atualizados = existentes.atualizar(recebimentos, captura.value, agora);
      if (!atualizados.ok) return atualizados;
      await this.favorecidos.salvar(existentes);
      return Result.ok({ favorecidosId: existentes.id.valor, novos: false });
    }
    const novos = FavorecidosDaEmenda.registrar({
      codigoDaEmenda: entrada.codigoDaEmenda,
      recebimentos,
      captura: captura.value,
      agora,
    });
    if (!novos.ok) return novos;
    await this.favorecidos.salvar(novos.value);
    return Result.ok({ favorecidosId: novos.value.id.valor, novos: true });
  }
}
