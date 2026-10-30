import { DomainError } from './domain-error.js';
import { Result } from './result.js';
import { ValueObject } from './value-object.js';

/** Intervalo de tempo com início obrigatório e fim opcional (em aberto), como um mandato em curso. */
export class Periodo extends ValueObject<{ inicio: Date; fim: Date | undefined }> {
  private constructor(inicio: Date, fim: Date | undefined) {
    super({ inicio, fim });
  }

  static criar(inicio: Date, fim?: Date): Result<Periodo, DomainError> {
    if (Number.isNaN(inicio.getTime()) || (fim && Number.isNaN(fim.getTime()))) {
      return Result.fail(new DomainError('periodo.data_invalida', 'Data inválida no período.'));
    }
    if (fim && fim < inicio) {
      return Result.fail(
        new DomainError('periodo.fim_antes_do_inicio', 'O fim do período é anterior ao início.'),
      );
    }
    return Result.ok(new Periodo(new Date(inicio), fim ? new Date(fim) : undefined));
  }

  get inicio(): Date {
    return new Date(this.props.inicio);
  }

  get fim(): Date | undefined {
    return this.props.fim ? new Date(this.props.fim) : undefined;
  }

  estaEmAberto(): boolean {
    return this.props.fim === undefined;
  }

  contem(instante: Date): boolean {
    if (instante < this.props.inicio) return false;
    return this.props.fim === undefined || instante <= this.props.fim;
  }
}
