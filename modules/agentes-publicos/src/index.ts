// Ponto de entrada público do módulo (ADR-0002). Outros módulos e apps só importam o que for
// exportado aqui: fachada de casos de uso e contratos. Nunca exporte entidades ou repositórios.
import { fileURLToPath } from 'node:url';

import type { RegistrarCaptura } from '@prometeu/acervo';
import {
  type BancoDoContexto,
  type BarramentoDeEventos,
  RelayDaOutbox,
} from '@prometeu/infraestrutura';

import type { Relogio } from './application/portas.js';
import { SincronizarAgentePublico } from './application/sincronizar-agente-publico.js';
import {
  type ConsultaDeMandatos,
  ConsultaDeMandatosPostgres,
} from './infrastructure/consulta-de-mandatos-postgres.js';
import { outbox } from './infrastructure/esquema.js';
import {
  ImportadorDeDeputadosDaCamara,
  type ResumoDaImportacao,
} from './infrastructure/importador-de-deputados-da-camara.js';
import { PessoaRepositoryPostgres } from './infrastructure/pessoa-repository-postgres.js';
import { RegistroDeCapturasNoAcervo } from './infrastructure/registro-de-capturas-no-acervo.js';
import { assinarConsumidores } from './interface/consumidores.js';

export type { Cargo } from './domain/cargo.js';
export type * from './domain/eventos.js';
export type {
  SincronizarAgentePublico,
  SincronizarAgentePublicoInput,
  SincronizarAgentePublicoOutput,
} from './application/sincronizar-agente-publico.js';
export type {
  ConsultaDeMandatos,
  MandatoPublicado,
  PessoaNaFonte,
} from './infrastructure/consulta-de-mandatos-postgres.js';
export type {
  FalhaDeImportacao,
  ResumoDaImportacao,
} from './infrastructure/importador-de-deputados-da-camara.js';

export const SCHEMA_DE_AGENTES_PUBLICOS = 'agentes_publicos';
export const MIGRACOES_DE_AGENTES_PUBLICOS = fileURLToPath(new URL('../drizzle', import.meta.url));

export interface DependenciasDeAgentesPublicos {
  readonly banco: BancoDoContexto;
  /** Serviço de host aberto do Acervo (ADR-0016). */
  readonly registrarCaptura: RegistrarCaptura;
  readonly relogio?: Relogio;
}

export interface ModuloAgentesPublicos {
  readonly sincronizar: SincronizarAgentePublico;
  /** Serviço de host aberto: outros contextos consultam mandatos por id. */
  readonly mandatos: ConsultaDeMandatos;
  importarDeputadosDaCamara(loteId: string): Promise<ResumoDaImportacao>;
  assinarConsumidores(
    barramento: BarramentoDeEventos,
    aoImportar: (resumo: ResumoDaImportacao) => void,
  ): Promise<void>;
  criarRelay(barramento: BarramentoDeEventos): RelayDaOutbox;
}

export function montarAgentesPublicos(
  dependencias: DependenciasDeAgentesPublicos,
): ModuloAgentesPublicos {
  const { banco } = dependencias;
  const sincronizar = new SincronizarAgentePublico(
    new PessoaRepositoryPostgres(banco),
    new RegistroDeCapturasNoAcervo(dependencias.registrarCaptura),
    dependencias.relogio ?? { agora: () => new Date() },
  );
  const importador = new ImportadorDeDeputadosDaCamara(banco, sincronizar);
  return {
    sincronizar,
    mandatos: new ConsultaDeMandatosPostgres(banco),
    importarDeputadosDaCamara: (loteId) => importador.importar(loteId),
    assinarConsumidores: (barramento, aoImportar) =>
      assinarConsumidores(barramento, banco, importador, aoImportar),
    criarRelay: (barramento) => new RelayDaOutbox(banco, outbox, barramento),
  };
}

/** Só a consulta de mandatos, para quem não importa dados (a API editorial, por exemplo). */
export function montarConsultaDeMandatos(banco: BancoDoContexto): ConsultaDeMandatos {
  return new ConsultaDeMandatosPostgres(banco);
}
