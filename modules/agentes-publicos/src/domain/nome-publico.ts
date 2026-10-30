import { DomainError, Result, ValueObject } from '@prometeu/shared-kernel';

const LIMITE = 120;

/** Nome pelo qual a pessoa é conhecida no exercício da função (nome parlamentar, nome de urna). */
export class NomePublico extends ValueObject<{ valor: string }> {
  private constructor(valor: string) {
    super({ valor });
  }

  static criar(nome: string): Result<NomePublico, DomainError> {
    const normalizado = nome.trim().replace(/\s+/g, ' ');
    if (normalizado.length === 0) {
      return Result.fail(new DomainError('pessoa.nome_vazio', 'A pessoa precisa de um nome.'));
    }
    if (normalizado.length > LIMITE) {
      return Result.fail(
        new DomainError('pessoa.nome_longo', `O nome passa de ${LIMITE} caracteres.`),
      );
    }
    return Result.ok(new NomePublico(normalizado));
  }

  get valor(): string {
    return this.props.valor;
  }

  override toString(): string {
    return this.props.valor;
  }
}
