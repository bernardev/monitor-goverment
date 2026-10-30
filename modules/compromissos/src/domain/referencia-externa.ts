import { DomainError, Result, ValueObject } from '@prometeu/shared-kernel';

import type { EstagioComprovavel } from './estagio.js';
import type { IdDoAlvo } from './identificadores.js';

export const TIPOS_DE_ALVO = [
  'proposicao',
  'ato_normativo',
  'acao_orcamentaria',
  'emenda',
  'obra',
] as const;
export type TipoDeAlvo = (typeof TIPOS_DE_ALVO)[number];

/**
 * Que estágio cada tipo de fato pode comprovar. Um PL mostra que houve ato, nunca entrega; uma obra
 * mostra execução (em andamento) ou entrega (concluída). Ato normativo pode ser a própria entrega
 * quando a promessa é normativa ("revogar o decreto X").
 */
const ESTAGIOS_POR_ALVO: Readonly<Record<TipoDeAlvo, readonly EstagioComprovavel[]>> = {
  proposicao: ['ato'],
  ato_normativo: ['ato', 'entrega'],
  acao_orcamentaria: ['orcamento', 'execucao'],
  emenda: ['orcamento', 'execucao'],
  obra: ['execucao', 'entrega'],
};

/** Aponta para um fato de outro contexto, só por tipo e identificador (nunca o objeto em si). */
export class ReferenciaExterna extends ValueObject<{ tipo: TipoDeAlvo; id: IdDoAlvo }> {
  private constructor(tipo: TipoDeAlvo, id: IdDoAlvo) {
    super({ tipo, id });
  }

  static criar(tipo: TipoDeAlvo, id: IdDoAlvo): ReferenciaExterna {
    return new ReferenciaExterna(tipo, id);
  }

  get tipo(): TipoDeAlvo {
    return this.props.tipo;
  }

  get id(): IdDoAlvo {
    return this.props.id;
  }

  podeComprovar(estagio: EstagioComprovavel): Result<EstagioComprovavel, DomainError> {
    const permitidos = ESTAGIOS_POR_ALVO[this.props.tipo];
    if (!permitidos.includes(estagio)) {
      return Result.fail(
        new DomainError(
          'vinculo.estagio_incompativel',
          `Um vínculo com ${this.props.tipo} não comprova o estágio ${estagio}.`,
          { tipo: this.props.tipo, estagio, permitidos },
        ),
      );
    }
    return Result.ok(estagio);
  }
}
