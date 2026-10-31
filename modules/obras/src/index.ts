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
import { RegistrarObra } from './application/registrar-obra.js';
import { outbox } from './infrastructure/esquema.js';
import { ImportadorDeObrasDoObrasGov } from './infrastructure/importador-de-obras-do-obrasgov.js';
import { ObraRepositoryPostgres } from './infrastructure/obra-repository-postgres.js';
import { RegistroDeCapturasNoAcervo } from './infrastructure/registro-de-capturas-no-acervo.js';
import type { ResumoDaImportacao } from './infrastructure/resumo-da-importacao.js';
import { assinarConsumidores } from './interface/consumidores.js';

export type * from './domain/eventos.js';
export type { Interrupcao, SituacaoDaObra } from './domain/situacao-da-obra.js';
export type { Relogio } from './application/portas.js';
export type {
  RegistrarObra,
  RegistrarObraInput,
  RegistrarObraOutput,
} from './application/registrar-obra.js';
export type {
  FalhaDeImportacao,
  ResumoDaImportacao,
} from './infrastructure/resumo-da-importacao.js';
export { ConflitoDeConcorrencia } from './infrastructure/persistencia.js';

export const SCHEMA_DE_OBRAS = 'obras';
export const MIGRACOES_DE_OBRAS = fileURLToPath(new URL('../drizzle', import.meta.url));

export interface DependenciasDeObras {
  readonly banco: BancoDoContexto;
  /** Serviço de host aberto do Acervo (ADR-0016). */
  readonly registrarCaptura: RegistrarCaptura;
  readonly relogio?: Relogio;
}

export interface ModuloObras {
  readonly registrarObra: RegistrarObra;
  importarObrasDoObrasGov(loteId: string): Promise<ResumoDaImportacao>;
  assinarConsumidores(
    barramento: BarramentoDeEventos,
    aoImportar: (resumo: ResumoDaImportacao) => void,
  ): Promise<void>;
  criarRelay(barramento: BarramentoDeEventos): RelayDaOutbox;
}

export function montarObras(dependencias: DependenciasDeObras): ModuloObras {
  const { banco } = dependencias;
  const relogio = dependencias.relogio ?? { agora: () => new Date() };
  const registrarObra = new RegistrarObra(
    new ObraRepositoryPostgres(banco),
    new RegistroDeCapturasNoAcervo(dependencias.registrarCaptura),
    relogio,
  );
  const importador = new ImportadorDeObrasDoObrasGov(banco, registrarObra);
  return {
    registrarObra,
    importarObrasDoObrasGov: (loteId) => importador.importar(loteId),
    assinarConsumidores: (barramento, aoImportar) =>
      assinarConsumidores(barramento, banco, importador, aoImportar),
    criarRelay: (barramento) => new RelayDaOutbox(banco, outbox, barramento),
  };
}
