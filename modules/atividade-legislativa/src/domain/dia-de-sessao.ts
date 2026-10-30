import { DomainError, Result, ValueObject } from '@prometeu/shared-kernel';

const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Dia do calendário de Brasília em que houve sessão (`aaaa-mm-dd`). É um dia, não um instante: a
 * frequência é apurada por dia, e converter para um instante em UTC mudaria a data à noite.
 */
export class DiaDeSessao extends ValueObject<{ valor: string }> {
  static de(valor: string): Result<DiaDeSessao, DomainError> {
    const partes = FORMATO.exec(valor);
    const data = partes ? new Date(`${valor}T00:00:00.000Z`) : undefined;
    if (
      data === undefined ||
      Number.isNaN(data.getTime()) ||
      data.toISOString().slice(0, 10) !== valor
    ) {
      return Result.fail(new DomainError('dia.invalido', `Dia inválido: "${valor}"`));
    }
    return Result.ok(new DiaDeSessao({ valor }));
  }

  get valor(): string {
    return this.props.valor;
  }

  /** Primeiro instante do dia em Brasília. */
  get inicio(): Date {
    return new Date(`${this.props.valor}T00:00:00.000-03:00`);
  }

  /** Último instante do dia em Brasília. */
  get fim(): Date {
    return new Date(`${this.props.valor}T23:59:59.999-03:00`);
  }

  /** O dia já começou em Brasília? */
  jaComecou(agora: Date): boolean {
    return this.inicio.getTime() <= agora.getTime();
  }

  /** O período tem algum instante dentro do dia? `null` no fim é período em curso. */
  tocaNoPeriodo(inicio: Date, fim: Date | null): boolean {
    return inicio <= this.fim && (fim === null || fim >= this.inicio);
  }
}
