// Ponto de entrada público do módulo (ADR-0002). Outros módulos e apps só importam o que for
// exportado aqui: fachada de casos de uso e contratos. Nunca exporte entidades ou repositórios.
import { fileURLToPath } from 'node:url';

import type { RegistrarCaptura } from '@prometeu/acervo';
import type { ConsultaDeMandatos } from '@prometeu/agentes-publicos';
import {
  type BancoDoContexto,
  type BarramentoDeEventos,
  RelayDaOutbox,
} from '@prometeu/infraestrutura';

import type { Relogio } from './application/portas.js';
import { RegistrarFrequencia } from './application/registrar-frequencia.js';
import { outbox } from './infrastructure/esquema.js';
import {
  ImportadorDeFrequenciaDaCamara,
  type ResumoDaImportacao,
} from './infrastructure/importador-de-frequencia-da-camara.js';
import { MandatosEmAgentesPublicos } from './infrastructure/mandatos-em-agentes-publicos.js';
import { RegistroDeCapturasNoAcervo } from './infrastructure/registro-de-capturas-no-acervo.js';
import { RegistroDeFrequenciaRepositoryPostgres } from './infrastructure/registro-de-frequencia-repository-postgres.js';
import { assinarConsumidores } from './interface/consumidores.js';

export type { CasaLegislativa } from './domain/casa-legislativa.js';
export type { CategoriaDoMotivo } from './domain/motivo-da-ausencia.js';
export type { Situacao } from './domain/situacao.js';
export type * from './domain/eventos.js';
export type { Relogio } from './application/portas.js';
export type {
  RegistrarFrequencia,
  RegistrarFrequenciaInput,
  RegistrarFrequenciaOutput,
} from './application/registrar-frequencia.js';
export type {
  FalhaDeImportacao,
  ResumoDaImportacao,
} from './infrastructure/importador-de-frequencia-da-camara.js';
export { ConflitoDeConcorrencia } from './infrastructure/registro-de-frequencia-repository-postgres.js';

export const SCHEMA_DE_ATIVIDADE_LEGISLATIVA = 'atividade_legislativa';
export const MIGRACOES_DE_ATIVIDADE_LEGISLATIVA = fileURLToPath(
  new URL('../drizzle', import.meta.url),
);

export interface DependenciasDeAtividadeLegislativa {
  readonly banco: BancoDoContexto;
  /** Serviço de host aberto do Acervo (ADR-0016). */
  readonly registrarCaptura: RegistrarCaptura;
  /** Serviço de host aberto de Agentes Públicos: quem é o parlamentar e qual o mandato. */
  readonly mandatos: Pick<ConsultaDeMandatos, 'vigente'>;
  readonly relogio?: Relogio;
}

export interface ModuloAtividadeLegislativa {
  readonly registrarFrequencia: RegistrarFrequencia;
  importarFrequenciaDaCamara(loteId: string): Promise<ResumoDaImportacao>;
  assinarConsumidores(
    barramento: BarramentoDeEventos,
    aoImportar: (resumo: ResumoDaImportacao) => void,
  ): Promise<void>;
  criarRelay(barramento: BarramentoDeEventos): RelayDaOutbox;
}

export function montarAtividadeLegislativa(
  dependencias: DependenciasDeAtividadeLegislativa,
): ModuloAtividadeLegislativa {
  const { banco } = dependencias;
  const registrarFrequencia = new RegistrarFrequencia(
    new RegistroDeFrequenciaRepositoryPostgres(banco),
    new MandatosEmAgentesPublicos(dependencias.mandatos),
    new RegistroDeCapturasNoAcervo(dependencias.registrarCaptura),
    dependencias.relogio ?? { agora: () => new Date() },
  );
  const importador = new ImportadorDeFrequenciaDaCamara(banco, registrarFrequencia);
  return {
    registrarFrequencia,
    importarFrequenciaDaCamara: (loteId) => importador.importar(loteId),
    assinarConsumidores: (barramento, aoImportar) =>
      assinarConsumidores(barramento, banco, importador, aoImportar),
    criarRelay: (barramento) => new RelayDaOutbox(banco, outbox, barramento),
  };
}
