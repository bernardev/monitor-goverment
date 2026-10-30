const CARGOS: Readonly<Record<string, string>> = {
  presidente: 'Presidente da República',
  vice_presidente: 'Vice-presidente da República',
  senador: 'Senador(a)',
  deputado_federal: 'Deputado(a) federal',
  governador: 'Governador(a)',
  vice_governador: 'Vice-governador(a)',
  deputado_estadual: 'Deputado(a) estadual',
  deputado_distrital: 'Deputado(a) distrital',
  prefeito: 'Prefeito(a)',
  vice_prefeito: 'Vice-prefeito(a)',
  vereador: 'Vereador(a)',
};

export function nomeDoCargo(cargo: string | null): string {
  return cargo === null ? 'Cargo não informado' : (CARGOS[cargo] ?? cargo);
}

const MOTIVOS: Readonly<Record<string, string>> = {
  licenca_saude: 'Licença para tratamento de saúde',
  licenca_gestante: 'Licença-gestante',
  licenca_paternidade: 'Licença-paternidade',
  licenca_particular: 'Licença particular',
  missao_autorizada: 'Missão autorizada',
  atividade_parlamentar: 'Atividade parlamentar',
  decisao_da_mesa: 'Decisão da Mesa',
  outro: 'Outro motivo',
};

export function nomeDoMotivo(categoria: string): string {
  return MOTIVOS[categoria] ?? categoria;
}

const OPCOES: Readonly<Record<string, string>> = {
  sim: 'Sim',
  nao: 'Não',
  abstencao: 'Abstenção',
  obstrucao: 'Obstrução',
  presidente_da_sessao: 'Presidia a sessão',
  secreto: 'Votou (voto secreto)',
};

export function nomeDaOpcao(opcao: string): string {
  return OPCOES[opcao] ?? opcao;
}

const SITUACOES_SEM_VOTO: Readonly<Record<string, string>> = {
  presente_sem_voto: 'Presente, sem voto registrado',
  ausente: 'Ausente, sem justificativa',
  ausencia_justificada: 'Ausência justificada',
  nao_informada: 'Situação sem legenda pública',
};

export function nomeDaSituacaoSemVoto(situacao: string): string {
  return SITUACOES_SEM_VOTO[situacao] ?? situacao;
}

const CASAS: Readonly<Record<string, string>> = {
  camara_dos_deputados: 'Câmara dos Deputados',
  senado_federal: 'Senado Federal',
};

export function nomeDaCasa(casa: string): string {
  return CASAS[casa] ?? casa;
}

const TIPOS: Readonly<Record<string, string>> = {
  PEC: 'Proposta de emenda à Constituição',
  PLP: 'Projeto de lei complementar',
  PL: 'Projeto de lei',
  MPV: 'Medida provisória',
  PDL: 'Projeto de decreto legislativo',
};

export function nomeDoTipo(sigla: string): string {
  return TIPOS[sigla] ?? sigla;
}

/** `PL 901/2026`, como as casas escrevem. */
export function identificacao(p: { sigla: string; numero: number; ano: number }): string {
  return `${p.sigla} ${String(p.numero)}/${String(p.ano)}`;
}

const RESULTADOS: Readonly<Record<string, string>> = {
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada',
  nao_informado: 'Resultado não informado pela casa',
};

export function nomeDoResultado(resultado: string): string {
  return RESULTADOS[resultado] ?? resultado;
}

const DATA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' });
const DATA_E_HORA = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});

/** Datas chegam em UTC da API e são exibidas no horário de Brasília (ADR-0006). */
export function data(iso: string): string {
  return DATA.format(new Date(iso));
}

/** Dia do calendário (`aaaa-mm-dd`), sem passar por fuso: meio-dia em Brasília cai sempre no dia. */
export function dia(aaaaMmDd: string): string {
  return DATA.format(new Date(`${aaaaMmDd}T12:00:00-03:00`));
}

export function dataEHora(iso: string): string {
  return DATA_E_HORA.format(new Date(iso));
}

export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
] as const; // prettier-ignore

const TIPOS_DE_EMENDA: Readonly<Record<string, string>> = {
  individual: 'Individual',
  transferencia_especial: 'Individual, transferência especial',
  bancada: 'De bancada estadual',
  comissao: 'De comissão',
  relator: 'Do relator-geral',
};

export function nomeDoTipoDeEmenda(tipo: string): string {
  return TIPOS_DE_EMENDA[tipo] ?? tipo;
}

const REAIS = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Centavos (texto, como a API devolve) em reais: `"123456789"` → `R$ 1.234.567,89`. A conta é em
 * inteiro e o Intl recebe o decimal exato em texto: nada passa por ponto flutuante.
 */
export function reais(centavos: string | bigint): string {
  const valor = BigInt(centavos);
  const absoluto = valor < 0n ? -valor : valor;
  const centavosDoReal = (absoluto % 100n).toString().padStart(2, '0');
  const decimal = `${valor < 0n ? '-' : ''}${(absoluto / 100n).toString()}.${centavosDoReal}`;
  return REAIS.format(decimal as Intl.StringNumericLiteral);
}

/** O que já saiu do caixa: o pago no ano do orçamento mais o pago depois, como restos a pagar. */
export function pagoAteAgora(execucao: {
  pagoCentavos: string;
  restosPagosCentavos: string;
}): bigint {
  return BigInt(execucao.pagoCentavos) + BigInt(execucao.restosPagosCentavos);
}
