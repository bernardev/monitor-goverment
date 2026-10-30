import type { RegistrarCapturaInput } from '../application/registrar-captura.js';

export const AGORA = new Date('2026-10-30T12:00:00Z');

export const umHash = (caractere = 'a'): string => caractere.repeat(64);

export function umaEntrada(
  sobrescrever: Partial<RegistrarCapturaInput> = {},
): RegistrarCapturaInput {
  return {
    fonte: 'camara',
    url: 'https://dadosabertos.camara.leg.br/api/v2/deputados?pagina=1',
    coletadaEm: new Date('2026-10-30T09:00:00Z'),
    sha256: umHash(),
    caminho: `bronze/camara/2026/10/30/${umHash()}`,
    tipoDeConteudo: 'application/json',
    ...sobrescrever,
  };
}
