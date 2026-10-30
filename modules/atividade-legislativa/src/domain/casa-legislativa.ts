/**
 * Casas legislativas acompanhadas. O modelo é genérico (ADR-0012): assembleias e câmaras municipais
 * entram aqui quando ganharem conector, sem mudar as regras.
 */
export const CASAS_LEGISLATIVAS = ['camara_dos_deputados', 'senado_federal'] as const;
export type CasaLegislativa = (typeof CASAS_LEGISLATIVAS)[number];
