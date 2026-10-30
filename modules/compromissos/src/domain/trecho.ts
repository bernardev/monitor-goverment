import { DomainError, Result, ValueObject } from '@prometeu/shared-kernel';

import { textoObrigatorio } from './validacao.js';

/** Onde o trecho está dentro da captura: página do PDF ou intervalo do vídeo, em segundos. */
export type Localizacao =
  | { readonly tipo: 'pagina'; readonly pagina: number }
  | {
      readonly tipo: 'intervalo_de_tempo';
      readonly inicioEmSegundos: number;
      readonly fimEmSegundos: number;
    };

/**
 * Citação literal que sustenta a promessa. Literal mesmo: é o que permite a qualquer pessoa abrir a
 * captura e conferir que a frase foi dita ou escrita assim (ADR-0009).
 */
export class Trecho extends ValueObject<{ citacaoLiteral: string; localizacao: Localizacao }> {
  private constructor(citacaoLiteral: string, localizacao: Localizacao) {
    super({ citacaoLiteral, localizacao });
  }

  static criar(citacaoLiteral: string, localizacao: Localizacao): Result<Trecho, DomainError> {
    const citacao = textoObrigatorio(
      citacaoLiteral,
      'trecho.citacao_vazia',
      'O trecho precisa da citação literal da fonte.',
    );
    if (!citacao.ok) return citacao;

    const local = validarLocalizacao(localizacao);
    if (!local.ok) return local;

    return Result.ok(new Trecho(citacao.value, local.value));
  }

  get citacaoLiteral(): string {
    return this.props.citacaoLiteral;
  }

  get localizacao(): Localizacao {
    return this.props.localizacao;
  }

  estaNoMesmoLugarQue(outro: Trecho): boolean {
    const [a, b] = [this.props.localizacao, outro.localizacao];
    if (a.tipo === 'pagina') return b.tipo === 'pagina' && a.pagina === b.pagina;
    return (
      b.tipo === 'intervalo_de_tempo' &&
      a.inicioEmSegundos === b.inicioEmSegundos &&
      a.fimEmSegundos === b.fimEmSegundos
    );
  }
}

function validarLocalizacao(localizacao: Localizacao): Result<Localizacao, DomainError> {
  if (localizacao.tipo === 'pagina') {
    if (!Number.isInteger(localizacao.pagina) || localizacao.pagina < 1) {
      return Result.fail(
        new DomainError('trecho.pagina_invalida', 'A página deve ser um inteiro a partir de 1.', {
          pagina: localizacao.pagina,
        }),
      );
    }
    return Result.ok(Object.freeze({ tipo: 'pagina', pagina: localizacao.pagina }));
  }

  const { inicioEmSegundos: inicio, fimEmSegundos: fim } = localizacao;
  if (!Number.isInteger(inicio) || !Number.isInteger(fim) || inicio < 0 || fim <= inicio) {
    return Result.fail(
      new DomainError(
        'trecho.intervalo_invalido',
        'O intervalo deve ter início e fim em segundos inteiros, com o fim depois do início.',
        { inicio, fim },
      ),
    );
  }
  return Result.ok(
    Object.freeze({ tipo: 'intervalo_de_tempo', inicioEmSegundos: inicio, fimEmSegundos: fim }),
  );
}
