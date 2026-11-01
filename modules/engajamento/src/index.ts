// Ponto de entrada público do módulo (ADR-0002). Outros módulos e apps só importam o que for
// exportado aqui: fachada de casos de uso e contratos. Nunca exporte entidades ou repositórios.
import { fileURLToPath } from 'node:url';

import type { BancoDoContexto } from '@prometeu/infraestrutura';

import {
  Acompanhar,
  DeixarDeAcompanhar,
  EsquecerCidadao,
  ListarAcompanhamentos,
} from './application/acompanhamentos.js';
import type { Relogio } from './application/portas.js';
import { CidadaoRepositoryPostgres } from './infrastructure/cidadao-repository-postgres.js';

export type { AcompanhamentoOutput, AlvoInput } from './application/acompanhamentos.js';
export type { Relogio } from './application/portas.js';
export { TIPOS_DE_ALVO, type TipoDeAlvo } from './domain/alvo.js';
export { LIMITE_DE_ACOMPANHAMENTOS } from './domain/cidadao.js';
export { Acompanhar, DeixarDeAcompanhar, EsquecerCidadao, ListarAcompanhamentos };

export const SCHEMA_DE_ENGAJAMENTO = 'engajamento';
export const MIGRACOES_DE_ENGAJAMENTO = fileURLToPath(new URL('../drizzle', import.meta.url));

export interface ModuloEngajamento {
  readonly acompanhar: Acompanhar;
  readonly deixarDeAcompanhar: DeixarDeAcompanhar;
  readonly listarAcompanhamentos: ListarAcompanhamentos;
  readonly esquecerCidadao: EsquecerCidadao;
}

export function montarEngajamento(
  banco: BancoDoContexto,
  relogio: Relogio = { agora: () => new Date() },
): ModuloEngajamento {
  const cidadaos = new CidadaoRepositoryPostgres(banco);
  return {
    acompanhar: new Acompanhar(cidadaos, relogio),
    deixarDeAcompanhar: new DeixarDeAcompanhar(cidadaos),
    listarAcompanhamentos: new ListarAcompanhamentos(cidadaos),
    esquecerCidadao: new EsquecerCidadao(cidadaos),
  };
}
