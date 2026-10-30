// Ponto de entrada público do módulo (ADR-0002). Outros módulos e apps só importam o que for
// exportado aqui: fachada de casos de uso e contratos. Nunca exporte entidades ou repositórios.
import { fileURLToPath } from 'node:url';

import {
  type BancoDoContexto,
  type BarramentoDeEventos,
  RelayDaOutbox,
} from '@prometeu/infraestrutura';

import type { Relogio } from './application/portas.js';
import { RegistrarCaptura } from './application/registrar-captura.js';
import { CapturaRepositoryPostgres } from './infrastructure/captura-repository-postgres.js';
import { outbox } from './infrastructure/esquema.js';

export type {
  RegistrarCaptura,
  RegistrarCapturaInput,
  RegistrarCapturaOutput,
} from './application/registrar-captura.js';
export type * from './domain/eventos.js';

export const SCHEMA_DO_ACERVO = 'acervo';
export const MIGRACOES_DO_ACERVO = fileURLToPath(new URL('../drizzle', import.meta.url));

export interface ModuloAcervo {
  /** Serviço de host aberto usado pelos importadores dos outros contextos (ADR-0016). */
  readonly registrarCaptura: RegistrarCaptura;
  criarRelay(barramento: BarramentoDeEventos): RelayDaOutbox;
}

const relogioDoSistema: Relogio = { agora: () => new Date() };

export function montarAcervo(
  banco: BancoDoContexto,
  relogio: Relogio = relogioDoSistema,
): ModuloAcervo {
  return {
    registrarCaptura: new RegistrarCaptura(new CapturaRepositoryPostgres(banco), relogio),
    criarRelay: (barramento) => new RelayDaOutbox(banco, outbox, barramento),
  };
}
