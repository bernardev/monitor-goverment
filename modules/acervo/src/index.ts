// Ponto de entrada público do módulo (ADR-0002). Outros módulos e apps só importam o que for
// exportado aqui: fachada de casos de uso e contratos. Nunca exporte entidades ou repositórios.
import { fileURLToPath } from 'node:url';

import {
  type BancoDoContexto,
  type BarramentoDeEventos,
  RelayDaOutbox,
} from '@prometeu/infraestrutura';

import {
  type ArmazemDeCapturas,
  type BaixadorDeDocumentos,
  CapturarDocumento,
} from './application/capturar-documento.js';
import type { Relogio } from './application/portas.js';
import { RegistrarCaptura } from './application/registrar-captura.js';
import { CapturaRepositoryPostgres } from './infrastructure/captura-repository-postgres.js';
import { ArmazemS3, type ConfiguracaoDoS3 } from './infrastructure/armazem-s3.js';
import { BaixadorHttp } from './infrastructure/baixador-http.js';
import { outbox } from './infrastructure/esquema.js';

export type {
  RegistrarCaptura,
  RegistrarCapturaInput,
  RegistrarCapturaOutput,
} from './application/registrar-captura.js';
export type {
  CapturarDocumento,
  CapturarDocumentoInput,
  CapturarDocumentoOutput,
} from './application/capturar-documento.js';
export type { ConfiguracaoDoS3 } from './infrastructure/armazem-s3.js';
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

export interface DependenciasDaCapturaDeDocumentos {
  readonly banco: BancoDoContexto;
  readonly s3: ConfiguracaoDoS3;
  readonly relogio?: Relogio;
  /** Trocáveis nos testes; em produção, HTTP com proteção contra SSRF e S3. */
  readonly baixador?: BaixadorDeDocumentos;
  readonly armazem?: ArmazemDeCapturas;
}

/**
 * Captura de documentos pela curadoria (ADR-0009). Separada de `montarAcervo` porque só quem captura
 * precisa de rede externa e do armazenamento de objetos. `preparar` cria o balde, se faltar.
 */
export function montarCapturaDeDocumentos(dependencias: DependenciasDaCapturaDeDocumentos): {
  readonly capturarDocumento: CapturarDocumento;
  preparar(): Promise<void>;
} {
  const s3 = new ArmazemS3(dependencias.s3);
  return {
    capturarDocumento: new CapturarDocumento(
      new CapturaRepositoryPostgres(dependencias.banco),
      dependencias.baixador ?? new BaixadorHttp(),
      dependencias.armazem ?? s3,
      dependencias.relogio ?? relogioDoSistema,
    ),
    preparar: () => (dependencias.armazem ? Promise.resolve() : s3.preparar()),
  };
}
