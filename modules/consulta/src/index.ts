// Ponto de entrada público do módulo (ADR-0002). Outros módulos e apps só importam o que for
// exportado aqui: fachada de casos de uso e contratos. Nunca exporte entidades ou repositórios.
import { fileURLToPath } from 'node:url';

import type { BancoDoContexto, BarramentoDeEventos } from '@prometeu/infraestrutura';

import type {
  ConsultaDeFrequencia,
  ConsultaDeParlamentares,
  Relogio,
} from './application/portas.js';
import { ConsultaDeFrequenciaPostgres } from './infrastructure/consulta-de-frequencia-postgres.js';
import { ConsultaDeParlamentaresPostgres } from './infrastructure/consulta-de-parlamentares-postgres.js';
import { ProjetorDeFrequencia } from './infrastructure/projetor-de-frequencia.js';
import { ProjetorDeParlamentares } from './infrastructure/projetor-de-parlamentares.js';
import { assinarConsumidores } from './interface/consumidores.js';

export type {
  ConsultaDeFrequencia,
  ConsultaDeParlamentares,
  FiltroDeParlamentares,
  PeriodoDeFrequencia,
  Relogio,
} from './application/portas.js';

export const SCHEMA_DA_CONSULTA = 'consulta';
export const MIGRACOES_DA_CONSULTA = fileURLToPath(new URL('../drizzle', import.meta.url));

export interface ModuloConsulta {
  readonly parlamentares: ConsultaDeParlamentares;
  readonly frequencia: ConsultaDeFrequencia;
  assinarConsumidores(barramento: BarramentoDeEventos): Promise<void>;
}

const RELOGIO_DO_SISTEMA: Relogio = { agora: () => new Date() };

export function montarConsulta(
  banco: BancoDoContexto,
  relogio: Relogio = RELOGIO_DO_SISTEMA,
): ModuloConsulta {
  return {
    parlamentares: new ConsultaDeParlamentaresPostgres(banco, relogio),
    frequencia: new ConsultaDeFrequenciaPostgres(banco),
    assinarConsumidores: (barramento) =>
      assinarConsumidores(barramento, banco, {
        parlamentares: new ProjetorDeParlamentares(banco),
        frequencia: new ProjetorDeFrequencia(banco),
      }),
  };
}
