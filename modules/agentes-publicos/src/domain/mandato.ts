import {
  type CodigoIbge,
  DomainError,
  Entity,
  type Periodo,
  Result,
} from '@prometeu/shared-kernel';

import { type Cargo, cargoPertenceA } from './cargo.js';
import { type CapturaId, MandatoId } from './identificadores.js';

export interface NovoMandato {
  readonly cargo: Cargo;
  /** Ente que elege o cargo: a União, uma UF ou um município (código IBGE). */
  readonly circunscricao: CodigoIbge;
  readonly periodo: Periodo;
  readonly captura: CapturaId;
}

/** Período em que a pessoa exerce um cargo eletivo. Pertence ao agregado `Pessoa`. */
export class Mandato extends Entity<MandatoId> {
  private constructor(
    id: MandatoId,
    private dados: NovoMandato,
  ) {
    super(id);
  }

  static criar(novo: NovoMandato): Result<Mandato, DomainError> {
    if (!cargoPertenceA(novo.cargo, novo.circunscricao)) {
      return Result.fail(
        new DomainError(
          'mandato.circunscricao_incompativel',
          `O cargo ${novo.cargo} não é eleito no ente ${novo.circunscricao.valor}.`,
          { cargo: novo.cargo, circunscricao: novo.circunscricao.valor },
        ),
      );
    }
    return Result.ok(new Mandato(MandatoId.gerar(), novo));
  }

  static reconstituir(id: MandatoId, dados: NovoMandato): Mandato {
    return new Mandato(id, dados);
  }

  get cargo(): Cargo {
    return this.dados.cargo;
  }

  get circunscricao(): CodigoIbge {
    return this.dados.circunscricao;
  }

  get periodo(): Periodo {
    return this.dados.periodo;
  }

  get captura(): CapturaId {
    return this.dados.captura;
  }

  /** O mesmo mandato informado de novo pela fonte: mesmo cargo, mesmo ente, mesma posse. */
  correspondeA(novo: NovoMandato): boolean {
    return (
      this.dados.cargo === novo.cargo &&
      this.dados.circunscricao.equals(novo.circunscricao) &&
      this.dados.periodo.inicio.getTime() === novo.periodo.inicio.getTime()
    );
  }

  /** Ninguém exerce o mesmo cargo duas vezes ao mesmo tempo. */
  sobrepoe(novo: NovoMandato): boolean {
    return sobrepostos(this.dados, novo);
  }

  /**
   * A fonte corrigiu as datas do exercício. O id fica, porque outros contextos já referenciam o
   * mandato. Quem chama garante que o novo período não se sobrepõe a outro mandato.
   */
  retificarPeriodo(periodo: Periodo, captura: CapturaId): void {
    this.dados = { ...this.dados, periodo, captura };
  }
}

/** Dois mandatos do mesmo cargo com algum instante em comum. */
export function sobrepostos(a: NovoMandato, b: NovoMandato): boolean {
  if (a.cargo !== b.cargo) return false;
  const fimDeA = a.periodo.fim ?? new Date(8.64e15);
  const fimDeB = b.periodo.fim ?? new Date(8.64e15);
  return a.periodo.inicio <= fimDeB && b.periodo.inicio <= fimDeA;
}
