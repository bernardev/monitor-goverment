// Ponto de entrada público do módulo (ADR-0002). Outros módulos e apps só importam o que for
// exportado aqui: fachada de casos de uso e contratos. Nunca exporte entidades ou repositórios.
import { fileURLToPath } from 'node:url';

import type { ConsultaDeMandatos as MandatosPublicados } from '@prometeu/agentes-publicos';
import {
  type BancoDoContexto,
  type BarramentoDeEventos,
  RelayDaOutbox,
} from '@prometeu/infraestrutura';

import { AdicionarFonte } from './application/casos-de-uso/adicionar-fonte.js';
import { PublicarVeredito, RecusarVeredito } from './application/casos-de-uso/decidir-veredito.js';
import { ConfirmarVinculo, RejeitarVinculo } from './application/casos-de-uso/decidir-vinculo.js';
import { ProporVeredito } from './application/casos-de-uso/propor-veredito.js';
import { RegistrarPromessa } from './application/casos-de-uso/registrar-promessa.js';
import { SugerirVinculo } from './application/casos-de-uso/sugerir-vinculo.js';
import type { Relogio } from './application/portas.js';
import { ConsultaEditorialPostgres } from './infrastructure/consulta-editorial-postgres.js';
import { outbox } from './infrastructure/esquema.js';
import { MandatosEmAgentesPublicos } from './infrastructure/mandatos-em-agentes-publicos.js';
import { PromessaRepositoryPostgres } from './infrastructure/promessa-repository-postgres.js';

export type { ConsultaDeMandatos, Relogio } from './application/portas.js';
export type { FonteInput } from './application/entrada.js';
export type { ConsultaEditorialPostgres as ConsultaEditorial } from './infrastructure/consulta-editorial-postgres.js';
export { ConflitoDeConcorrencia } from './infrastructure/promessa-repository-postgres.js';

export {
  AdicionarFonte,
  type AdicionarFonteInput,
  type AdicionarFonteOutput,
} from './application/casos-de-uso/adicionar-fonte.js';
export {
  PublicarVeredito,
  type PublicarVereditoInput,
  type PublicarVereditoOutput,
  RecusarVeredito,
  type RecusarVereditoInput,
} from './application/casos-de-uso/decidir-veredito.js';
export {
  ConfirmarVinculo,
  type ConfirmarVinculoInput,
  RejeitarVinculo,
  type RejeitarVinculoInput,
} from './application/casos-de-uso/decidir-vinculo.js';
export {
  type FundamentoInput,
  ProporVeredito,
  type ProporVereditoInput,
} from './application/casos-de-uso/propor-veredito.js';
export {
  RegistrarPromessa,
  type RegistrarPromessaInput,
  type RegistrarPromessaOutput,
} from './application/casos-de-uso/registrar-promessa.js';
export {
  SugerirVinculo,
  type SugerirVinculoInput,
  type SugerirVinculoOutput,
} from './application/casos-de-uso/sugerir-vinculo.js';

// Contrato dos eventos publicados para os outros contextos (via outbox).
export type * from './domain/eventos.js';

export const SCHEMA_DE_COMPROMISSOS = 'compromissos';
export const MIGRACOES_DE_COMPROMISSOS = fileURLToPath(new URL('../drizzle', import.meta.url));

export interface DependenciasDeCompromissos {
  readonly banco: BancoDoContexto;
  /** Serviço de host aberto de Agentes Públicos, para a data de fim dos mandatos. */
  readonly mandatos: Pick<MandatosPublicados, 'buscar'>;
  readonly relogio?: Relogio;
}

export interface ModuloCompromissos {
  readonly registrarPromessa: RegistrarPromessa;
  readonly adicionarFonte: AdicionarFonte;
  readonly sugerirVinculo: SugerirVinculo;
  readonly confirmarVinculo: ConfirmarVinculo;
  readonly rejeitarVinculo: RejeitarVinculo;
  readonly proporVeredito: ProporVeredito;
  readonly publicarVeredito: PublicarVeredito;
  readonly recusarVeredito: RecusarVeredito;
  readonly consultaEditorial: ConsultaEditorialPostgres;
  criarRelay(barramento: BarramentoDeEventos): RelayDaOutbox;
}

export function montarCompromissos(dependencias: DependenciasDeCompromissos): ModuloCompromissos {
  const { banco } = dependencias;
  const promessas = new PromessaRepositoryPostgres(banco);
  const relogio = dependencias.relogio ?? { agora: () => new Date() };
  return {
    registrarPromessa: new RegistrarPromessa(promessas, relogio),
    adicionarFonte: new AdicionarFonte(promessas, relogio),
    sugerirVinculo: new SugerirVinculo(promessas, relogio),
    confirmarVinculo: new ConfirmarVinculo(promessas, relogio),
    rejeitarVinculo: new RejeitarVinculo(promessas, relogio),
    proporVeredito: new ProporVeredito(
      promessas,
      new MandatosEmAgentesPublicos(dependencias.mandatos),
      relogio,
    ),
    publicarVeredito: new PublicarVeredito(promessas, relogio),
    recusarVeredito: new RecusarVeredito(promessas, relogio),
    consultaEditorial: new ConsultaEditorialPostgres(banco, promessas),
    criarRelay: (barramento) => new RelayDaOutbox(banco, outbox, barramento),
  };
}
