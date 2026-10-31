// Ponto de entrada público do módulo (ADR-0002). Outros módulos e apps só importam o que for
// exportado aqui: fachada de casos de uso e contratos. Nunca exporte entidades ou repositórios.
import { fileURLToPath } from 'node:url';

import type { RegistrarCaptura } from '@prometeu/acervo';
import type { ConsultaDePessoas } from '@prometeu/agentes-publicos';
import {
  type BancoDoContexto,
  type BarramentoDeEventos,
  RelayDaOutbox,
} from '@prometeu/infraestrutura';

import type { Relogio } from './application/portas.js';
import { RegistrarConvenio } from './application/registrar-convenio.js';
import { RegistrarEmenda } from './application/registrar-emenda.js';
import { RegistrarFavorecidosDaEmenda } from './application/registrar-favorecidos-da-emenda.js';
import { AutoresEmAgentesPublicos } from './infrastructure/autores-em-agentes-publicos.js';
import { ConvenioRepositoryPostgres } from './infrastructure/convenio-repository-postgres.js';
import { EmendaRepositoryPostgres } from './infrastructure/emenda-repository-postgres.js';
import { outbox } from './infrastructure/esquema.js';
import { FavorecidosDaEmendaRepositoryPostgres } from './infrastructure/favorecidos-da-emenda-repository-postgres.js';
import { ImportadorDeConveniosDoPortal } from './infrastructure/importador-de-convenios-do-portal.js';
import { ImportadorDeEmendasDoPortal } from './infrastructure/importador-de-emendas-do-portal.js';
import { ImportadorDeFavorecidosDoPortal } from './infrastructure/importador-de-favorecidos-do-portal.js';
import { RegistroDeCapturasNoAcervo } from './infrastructure/registro-de-capturas-no-acervo.js';
import type { ResumoDaImportacao } from './infrastructure/resumo-da-importacao.js';
import { assinarConsumidores } from './interface/consumidores.js';

export type * from './domain/eventos.js';
export type { Modalidade, TipoDeEmenda } from './domain/tipo-de-emenda.js';
export type { TipoDeFavorecido } from './domain/tipo-de-favorecido.js';
export type { Relogio } from './application/portas.js';
export type {
  RegistrarEmenda,
  RegistrarEmendaInput,
  RegistrarEmendaOutput,
} from './application/registrar-emenda.js';
export type {
  FalhaDeImportacao,
  ResumoDaImportacao,
} from './infrastructure/resumo-da-importacao.js';
export { ConflitoDeConcorrencia } from './infrastructure/persistencia.js';

export const SCHEMA_DE_FINANCAS_PUBLICAS = 'financas_publicas';
export const MIGRACOES_DE_FINANCAS_PUBLICAS = fileURLToPath(new URL('../drizzle', import.meta.url));

export interface DependenciasDeFinancasPublicas {
  readonly banco: BancoDoContexto;
  /** Serviço de host aberto do Acervo (ADR-0016). */
  readonly registrarCaptura: RegistrarCaptura;
  /** Serviço de host aberto de Agentes Públicos: quem é o autor da emenda. */
  readonly pessoas: Pick<ConsultaDePessoas, 'parlamentaresEmExercicio'>;
  readonly relogio?: Relogio;
}

export interface ModuloFinancasPublicas {
  readonly registrarEmenda: RegistrarEmenda;
  importarEmendasDoPortal(loteId: string): Promise<ResumoDaImportacao>;
  importarFavorecidosDoPortal(loteId: string): Promise<ResumoDaImportacao>;
  importarConveniosDoPortal(loteId: string): Promise<ResumoDaImportacao>;
  assinarConsumidores(
    barramento: BarramentoDeEventos,
    aoImportar: (resumo: ResumoDaImportacao) => void,
  ): Promise<void>;
  criarRelay(barramento: BarramentoDeEventos): RelayDaOutbox;
}

export function montarFinancasPublicas(
  dependencias: DependenciasDeFinancasPublicas,
): ModuloFinancasPublicas {
  const { banco } = dependencias;
  const relogio = dependencias.relogio ?? { agora: () => new Date() };
  const capturas = new RegistroDeCapturasNoAcervo(dependencias.registrarCaptura);
  const registrarEmenda = new RegistrarEmenda(
    new EmendaRepositoryPostgres(banco),
    new AutoresEmAgentesPublicos(dependencias.pessoas, relogio),
    capturas,
    relogio,
  );
  const importadores = {
    emendas: new ImportadorDeEmendasDoPortal(banco, registrarEmenda),
    favorecidos: new ImportadorDeFavorecidosDoPortal(
      banco,
      new RegistrarFavorecidosDaEmenda(
        new FavorecidosDaEmendaRepositoryPostgres(banco),
        capturas,
        relogio,
      ),
    ),
    convenios: new ImportadorDeConveniosDoPortal(
      banco,
      new RegistrarConvenio(new ConvenioRepositoryPostgres(banco), capturas, relogio),
    ),
  };
  return {
    registrarEmenda,
    importarEmendasDoPortal: (loteId) => importadores.emendas.importar(loteId),
    importarFavorecidosDoPortal: (loteId) => importadores.favorecidos.importar(loteId),
    importarConveniosDoPortal: (loteId) => importadores.convenios.importar(loteId),
    assinarConsumidores: (barramento, aoImportar) =>
      assinarConsumidores(barramento, banco, importadores, aoImportar),
    criarRelay: (barramento) => new RelayDaOutbox(banco, outbox, barramento),
  };
}
