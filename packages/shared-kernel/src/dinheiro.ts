import { DomainError } from './domain-error.js';
import { Result } from './result.js';
import { ValueObject } from './value-object.js';

// Orçamento público brasileiro é sempre em reais. Se outra moeda entrar, as operações aritméticas
// precisam passar a verificar se as duas parcelas têm a mesma moeda.
export type Moeda = 'BRL';

const DECIMAL = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;

/**
 * Valor monetário em centavos inteiros (`bigint`). Nunca ponto flutuante: 0,1 + 0,2 precisa dar 0,3
 * quando somamos milhões de pagamentos.
 *
 * A conversão de formatos das fontes ("1.234,56") acontece na camada anticorrupção; aqui só entra
 * texto decimal canônico ("1234.56").
 */
export class Dinheiro extends ValueObject<{ centavos: bigint; moeda: Moeda }> {
  private constructor(centavos: bigint, moeda: Moeda) {
    super({ centavos, moeda });
  }

  static zero(moeda: Moeda = 'BRL'): Dinheiro {
    return new Dinheiro(0n, moeda);
  }

  static deCentavos(
    centavos: bigint | number,
    moeda: Moeda = 'BRL',
  ): Result<Dinheiro, DomainError> {
    if (typeof centavos === 'number' && !Number.isSafeInteger(centavos)) {
      return Result.fail(
        new DomainError('dinheiro.centavos_invalidos', 'Centavos devem ser um inteiro seguro.', {
          centavos,
        }),
      );
    }
    return Result.ok(new Dinheiro(BigInt(centavos), moeda));
  }

  static deReais(texto: string, moeda: Moeda = 'BRL'): Result<Dinheiro, DomainError> {
    const partes = DECIMAL.exec(texto.trim());
    if (!partes) {
      return Result.fail(
        new DomainError('dinheiro.formato_invalido', `Valor em reais inválido: "${texto}"`),
      );
    }
    const [, sinal, inteiro = '0', fracao = ''] = partes;
    const centavos = BigInt(inteiro) * 100n + BigInt(fracao.padEnd(2, '0'));
    return Result.ok(new Dinheiro(sinal === '-' ? -centavos : centavos, moeda));
  }

  get centavos(): bigint {
    return this.props.centavos;
  }

  get moeda(): Moeda {
    return this.props.moeda;
  }

  somar(outro: Dinheiro): Dinheiro {
    return new Dinheiro(this.centavos + outro.centavos, this.moeda);
  }

  subtrair(outro: Dinheiro): Dinheiro {
    return new Dinheiro(this.centavos - outro.centavos, this.moeda);
  }

  ehZero(): boolean {
    return this.centavos === 0n;
  }

  ehNegativo(): boolean {
    return this.centavos < 0n;
  }

  compararCom(outro: Dinheiro): -1 | 0 | 1 {
    if (this.centavos === outro.centavos) return 0;
    return this.centavos < outro.centavos ? -1 : 1;
  }

  /** Representação canônica para persistência e logs ("1234.56"). Formatação para tela fica na UI. */
  paraDecimal(): string {
    const negativo = this.centavos < 0n;
    const absoluto = negativo ? -this.centavos : this.centavos;
    const reais = absoluto / 100n;
    const centavos = (absoluto % 100n).toString().padStart(2, '0');
    return `${negativo ? '-' : ''}${reais.toString()}.${centavos}`;
  }

  override toString(): string {
    return `${this.moeda} ${this.paraDecimal()}`;
  }
}
