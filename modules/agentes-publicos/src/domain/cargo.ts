import type { CodigoIbge } from '@prometeu/shared-kernel';

/** Cargos eletivos de todas as esferas, desde a v1 (ADR-0012). */
export const CARGOS = [
  'presidente',
  'vice_presidente',
  'senador',
  'deputado_federal',
  'governador',
  'vice_governador',
  'deputado_estadual',
  'deputado_distrital',
  'prefeito',
  'vice_prefeito',
  'vereador',
] as const;
export type Cargo = (typeof CARGOS)[number];

type Circunscricao = 'uniao' | 'uf' | 'estado' | 'df' | 'municipio';

/**
 * Onde cada cargo é eleito (Constituição, arts. 28, 29, 32, 45, 46 e 77). Deputados federais e
 * senadores representam uma UF ou o DF; deputados estaduais, só estados; vereadores, um município.
 */
const CIRCUNSCRICAO: Readonly<Record<Cargo, Circunscricao>> = {
  presidente: 'uniao',
  vice_presidente: 'uniao',
  senador: 'uf',
  deputado_federal: 'uf',
  governador: 'uf',
  vice_governador: 'uf',
  deputado_estadual: 'estado',
  deputado_distrital: 'df',
  prefeito: 'municipio',
  vice_prefeito: 'municipio',
  vereador: 'municipio',
};

export function cargoPertenceA(cargo: Cargo, ente: CodigoIbge): boolean {
  const ehUf = ente.valor.length === 2;
  switch (CIRCUNSCRICAO[cargo]) {
    case 'uniao':
      return ente.ehUniao();
    case 'uf':
      return ehUf;
    case 'estado':
      return ehUf && ente.esfera() === 'estadual';
    case 'df':
      return ehUf && ente.esfera() === 'distrital';
    case 'municipio':
      return ente.esfera() === 'municipal';
  }
}
