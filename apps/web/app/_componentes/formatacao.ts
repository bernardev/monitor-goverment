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
