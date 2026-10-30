import { DomainError, Result, ValueObject } from '@prometeu/shared-kernel';

import { textoObrigatorio } from './validacao.js';

/** Parte mensurável da promessa, quando existe ("500 creches", com prazo em 2028). */
export class Meta extends ValueObject<{ descricao: string; prazo: Date | undefined }> {
  private constructor(descricao: string, prazo: Date | undefined) {
    super({ descricao, prazo });
  }

  static criar(descricao: string, prazo?: Date): Result<Meta, DomainError> {
    const texto = textoObrigatorio(
      descricao,
      'meta.descricao_vazia',
      'A meta precisa de descrição.',
    );
    if (!texto.ok) return texto;
    if (prazo && Number.isNaN(prazo.getTime())) {
      return Result.fail(
        new DomainError('meta.prazo_invalido', 'Prazo da meta é uma data inválida.'),
      );
    }
    return Result.ok(new Meta(texto.value, prazo ? new Date(prazo) : undefined));
  }

  get descricao(): string {
    return this.props.descricao;
  }

  get prazo(): Date | undefined {
    return this.props.prazo ? new Date(this.props.prazo) : undefined;
  }
}
