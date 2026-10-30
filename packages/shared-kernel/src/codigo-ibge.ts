import { DomainError } from './domain-error.js';
import { Result } from './result.js';
import { ValueObject } from './value-object.js';

export type Esfera = 'federal' | 'estadual' | 'distrital' | 'municipal';

/** Códigos IBGE das unidades da federação. */
const UFS = {
  '11': 'RO',
  '12': 'AC',
  '13': 'AM',
  '14': 'RR',
  '15': 'PA',
  '16': 'AP',
  '17': 'TO',
  '21': 'MA',
  '22': 'PI',
  '23': 'CE',
  '24': 'RN',
  '25': 'PB',
  '26': 'PE',
  '27': 'AL',
  '28': 'SE',
  '29': 'BA',
  '31': 'MG',
  '32': 'ES',
  '33': 'RJ',
  '35': 'SP',
  '41': 'PR',
  '42': 'SC',
  '43': 'RS',
  '50': 'MS',
  '51': 'MT',
  '52': 'GO',
  '53': 'DF',
} as const;

export type SiglaUf = (typeof UFS)[keyof typeof UFS];

const CODIGO_DF = '53';
const CODIGO_UNIAO = '0';

/**
 * Identifica um ente federativo (ADR-0012).
 *
 * - `0`: União (convenção nossa; o IBGE não codifica a União).
 * - 2 dígitos: unidade da federação.
 * - 7 dígitos: município. O DF não tem municípios; o código 5300108 (Brasília) aparece nas fontes e é
 *   tratado como esfera distrital.
 */
export class CodigoIbge extends ValueObject<{ valor: string }> {
  private constructor(valor: string) {
    super({ valor });
  }

  static uniao(): CodigoIbge {
    return new CodigoIbge(CODIGO_UNIAO);
  }

  /** Código da unidade da federação a partir da sigla (`SP` → `35`), como as fontes costumam informar. */
  static daUf(sigla: string): Result<CodigoIbge, DomainError> {
    const procurada = sigla.trim().toUpperCase();
    const codigo = Object.entries(UFS).find(([, uf]) => uf === procurada)?.[0];
    if (codigo === undefined) {
      return Result.fail(new DomainError('codigo_ibge.uf_invalida', `UF inválida: "${sigla}"`));
    }
    return Result.ok(new CodigoIbge(codigo));
  }

  static criar(valor: string): Result<CodigoIbge, DomainError> {
    const codigo = valor.trim();
    const valido =
      codigo === CODIGO_UNIAO || (/^\d{2}(\d{5})?$/.test(codigo) && codigo.slice(0, 2) in UFS);
    if (!valido) {
      return Result.fail(
        new DomainError('codigo_ibge.invalido', `Código IBGE inválido: "${valor}"`),
      );
    }
    return Result.ok(new CodigoIbge(codigo));
  }

  get valor(): string {
    return this.props.valor;
  }

  ehUniao(): boolean {
    return this.valor === CODIGO_UNIAO;
  }

  esfera(): Esfera {
    if (this.ehUniao()) return 'federal';
    if (this.valor.startsWith(CODIGO_DF)) return 'distrital';
    return this.valor.length === 2 ? 'estadual' : 'municipal';
  }

  /** Sigla da UF a que o ente pertence; `undefined` para a União. */
  uf(): SiglaUf | undefined {
    if (this.ehUniao()) return undefined;
    return UFS[this.valor.slice(0, 2) as keyof typeof UFS];
  }

  override toString(): string {
    return this.valor;
  }
}
