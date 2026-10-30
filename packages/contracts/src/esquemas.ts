import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import adicionarFormatos from 'ajv-formats';

const PASTA = fileURLToPath(new URL('../eventos/', import.meta.url));
const ajv = new Ajv2020({ allErrors: true, strict: true });
adicionarFormatos.default(ajv);
const validadores = new Map<string, ValidateFunction>();

/** `PessoaRegistrada` → `pessoa-registrada.v1.schema.json` */
function arquivoDoEsquema(tipo: string, versao: number): string {
  const nome = tipo.replace(/(?<!^)([A-Z])/g, '-$1').toLowerCase();
  return `${PASTA}${nome}.v${versao}.schema.json`;
}

/**
 * Confere os `dados` de um evento contra o JSON Schema publicado (teste de contrato, ADR-0007).
 * Devolve a lista de violações; vazia quando o evento respeita o contrato.
 */
export function violacoesDoContrato(tipo: string, versao: number, dados: unknown): string[] {
  const arquivo = arquivoDoEsquema(tipo, versao);
  let validar = validadores.get(arquivo);
  if (!validar) {
    validar = ajv.compile(JSON.parse(readFileSync(arquivo, 'utf8')) as object);
    validadores.set(arquivo, validar);
  }
  if (validar(dados)) return [];
  return (validar.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`.trim());
}
