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

/** Um número que conta de zero até o alvo ao entrar na tela. */
export interface Contagem {
  readonly alvo: number;
  /** Casas decimais; zero por padrão. */
  readonly casas?: number;
  readonly prefixo?: string;
  readonly sufixo?: string;
}

/** O texto da contagem quando ela já andou `fracao` (0 a 1) do caminho: com `1`, o valor final. */
export function textoDaContagem(c: Contagem, fracao: number): string {
  const casas = c.casas ?? 0;
  const numero = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(c.alvo * fracao);
  return `${c.prefixo ?? ''}${numero}${c.sufixo ?? ''}`;
}

/** Os atributos que o `Movimento` lê para contar; sem contagem, nada é marcado. */
export function atributosDaContagem(c?: Contagem): Record<string, string> {
  if (!c) return {};
  return {
    'data-conta': String(c.alvo),
    'data-casas': String(c.casas ?? 0),
    'data-prefixo': c.prefixo ?? '',
    'data-sufixo': c.sufixo ?? '',
  };
}
