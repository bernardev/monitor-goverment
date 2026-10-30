import type { DomainEvent } from '@prometeu/shared-kernel';

import type { Cargo } from './cargo.js';
import type { FonteExterna } from './identificador-externo.js';

// Dados só com primitivos serializáveis: vão para a outbox em JSON (ADR-0007) e são a linguagem
// publicada deste contexto para os outros (packages/contracts/eventos). Ausência é `null`.
// Todo evento traz a captura que prova o dado (ADR-0009).

export type PessoaRegistrada = DomainEvent<
  'PessoaRegistrada',
  {
    nome: string;
    siglaPartido: string | null;
    urlDaFoto: string | null;
    identificadores: { fonte: FonteExterna; codigo: string }[];
    capturaId: string;
  }
>;

export type NomePublicoAlterado = DomainEvent<
  'NomePublicoAlterado',
  { de: string; para: string; capturaId: string }
>;

export type FiliacaoPartidariaAlterada = DomainEvent<
  'FiliacaoPartidariaAlterada',
  { de: string | null; para: string | null; capturaId: string }
>;

export type FotoOficialAlterada = DomainEvent<
  'FotoOficialAlterada',
  { urlDaFoto: string | null; capturaId: string }
>;

export type MandatoRegistrado = DomainEvent<
  'MandatoRegistrado',
  {
    mandatoId: string;
    cargo: Cargo;
    circunscricao: string;
    inicio: string;
    fim: string | null;
    capturaId: string;
  }
>;

export type EventoDeAgentesPublicos =
  | PessoaRegistrada
  | NomePublicoAlterado
  | FiliacaoPartidariaAlterada
  | FotoOficialAlterada
  | MandatoRegistrado;
