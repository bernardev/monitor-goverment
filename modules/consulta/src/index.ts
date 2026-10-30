// Ponto de entrada público do módulo (ADR-0002). Outros módulos e apps só importam o que for
// exportado aqui: fachada de casos de uso e contratos. Nunca exporte entidades ou repositórios.
import { fileURLToPath } from 'node:url';

import type { BancoDoContexto, BarramentoDeEventos } from '@prometeu/infraestrutura';

import type { ConsultaDeParlamentares } from './application/portas.js';
import { ConsultaDeParlamentaresPostgres } from './infrastructure/consulta-de-parlamentares-postgres.js';
import { ProjetorDeParlamentares } from './infrastructure/projetor-de-parlamentares.js';
import { assinarConsumidores } from './interface/consumidores.js';

export type { ConsultaDeParlamentares, FiltroDeParlamentares } from './application/portas.js';

export const SCHEMA_DA_CONSULTA = 'consulta';
export const MIGRACOES_DA_CONSULTA = fileURLToPath(new URL('../drizzle', import.meta.url));

export interface ModuloConsulta {
  readonly parlamentares: ConsultaDeParlamentares;
  assinarConsumidores(barramento: BarramentoDeEventos): Promise<void>;
}

export function montarConsulta(banco: BancoDoContexto): ModuloConsulta {
  return {
    parlamentares: new ConsultaDeParlamentaresPostgres(banco),
    assinarConsumidores: (barramento) =>
      assinarConsumidores(barramento, banco, new ProjetorDeParlamentares(banco)),
  };
}
