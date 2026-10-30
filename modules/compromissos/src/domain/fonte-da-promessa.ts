import { DomainError, Entity, Result } from '@prometeu/shared-kernel';

import type { TipoDeFonte } from './classificacao.js';
import { type CapturaId, FonteId } from './identificadores.js';
import type { Trecho } from './trecho.js';

export interface NovaFonte {
  readonly tipo: TipoDeFonte;
  readonly captura: CapturaId;
  readonly trecho: Trecho;
  readonly dataDaDeclaracao: Date;
}

/** De onde a promessa veio. Imutável: uma fonte errada sai por errata da promessa, não por edição. */
export class FonteDaPromessa extends Entity<FonteId> {
  private constructor(
    id: FonteId,
    private readonly dados: NovaFonte,
  ) {
    super(id);
  }

  static criar(nova: NovaFonte, agora: Date): Result<FonteDaPromessa, DomainError> {
    if (Number.isNaN(nova.dataDaDeclaracao.getTime())) {
      return Result.fail(
        new DomainError('fonte.data_invalida', 'A data da declaração é uma data inválida.'),
      );
    }
    if (nova.dataDaDeclaracao > agora) {
      return Result.fail(
        new DomainError('fonte.data_no_futuro', 'A data da declaração não pode estar no futuro.'),
      );
    }
    return Result.ok(
      new FonteDaPromessa(FonteId.gerar(), {
        ...nova,
        dataDaDeclaracao: new Date(nova.dataDaDeclaracao),
      }),
    );
  }

  get tipo(): TipoDeFonte {
    return this.dados.tipo;
  }

  get captura(): CapturaId {
    return this.dados.captura;
  }

  get trecho(): Trecho {
    return this.dados.trecho;
  }

  get dataDaDeclaracao(): Date {
    return new Date(this.dados.dataDaDeclaracao);
  }

  /** Mesma captura e mesmo ponto dentro dela: é a mesma fonte, mesmo que a citação mude uma vírgula. */
  apontaParaOMesmoLugarQue(outra: NovaFonte): boolean {
    return (
      this.dados.captura.equals(outra.captura) &&
      this.dados.trecho.estaNoMesmoLugarQue(outra.trecho)
    );
  }
}
