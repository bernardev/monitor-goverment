/**
 * Partes de um todo em porcentagens inteiras que somam 100, pelo maior resto: arredondar cada parte
 * sozinha pode somar 99 ou 101, e a barra não fecharia.
 */
export function porcentagens(valores: readonly number[]): number[] {
  const total = valores.reduce((soma, v) => soma + v, 0);
  if (total <= 0) return valores.map(() => 0);
  const exatas = valores.map((v) => (v / total) * 100);
  const inteiras = exatas.map(Math.floor);
  let falta = 100 - inteiras.reduce((soma, v) => soma + v, 0);
  const porResto = exatas
    .map((v, i) => ({ i, resto: v - Math.floor(v) }))
    .sort((a, b) => b.resto - a.resto);
  for (const { i } of porResto) {
    if (falta === 0) break;
    inteiras[i] = (inteiras[i] ?? 0) + 1;
    falta -= 1;
  }
  return inteiras;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export interface DiaMarcado<T> {
  /** `aaaa-mm-dd`. */
  readonly dia: string;
  readonly valor: T;
}

export interface Mes<T> {
  /** `mar 2026`. */
  readonly nome: string;
  /** Do mais antigo para o mais recente. */
  readonly dias: readonly DiaMarcado<T>[];
}

/** Agrupa os dias por mês, do mês mais antigo para o mais recente, seja qual for a ordem de entrada. */
export function porMes<T>(dias: readonly DiaMarcado<T>[]): Mes<T>[] {
  const ordenados = [...dias].sort((a, b) => a.dia.localeCompare(b.dia));
  const meses = new Map<string, DiaMarcado<T>[]>();
  for (const d of ordenados) {
    const chave = d.dia.slice(0, 7);
    meses.set(chave, [...(meses.get(chave) ?? []), d]);
  }
  return [...meses].map(([chave, doMes]) => {
    const [ano, mes] = chave.split('-');
    return { nome: `${MESES[Number(mes) - 1] ?? '?'} ${ano ?? ''}`, dias: doMes };
  });
}
