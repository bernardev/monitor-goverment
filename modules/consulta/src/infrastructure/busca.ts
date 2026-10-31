import { COM_ACENTO, SEM_ACENTO } from './esquema.js';

const ACENTUADAS = new RegExp(`[${COM_ACENTO}]`, 'g');

/**
 * O termo procurado na forma das colunas `*_busca`: sem acento, em minúsculas e com os espaços
 * normalizados, para `LIKE '%termo%'`. `%`, `_` e a barra do usuário valem como texto, não como
 * curinga.
 */
export function paraBusca(termo: string): string {
  return termo
    .replace(ACENTUADAS, (letra) => SEM_ACENTO.charAt(COM_ACENTO.indexOf(letra)))
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
    .replace(/[\\%_]/g, (curinga) => `\\${curinga}`);
}
