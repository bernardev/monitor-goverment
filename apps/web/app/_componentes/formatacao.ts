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

export function dataEHora(iso: string): string {
  return DATA_E_HORA.format(new Date(iso));
}

export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
] as const; // prettier-ignore
