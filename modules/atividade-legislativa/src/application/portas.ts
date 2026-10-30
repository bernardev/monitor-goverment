import type { DomainError, Result } from '@prometeu/shared-kernel';

import type { CasaLegislativa } from '../domain/casa-legislativa.js';
import type { DiaDeSessao } from '../domain/dia-de-sessao.js';
import type { CapturaId, PessoaId } from '../domain/identificadores.js';
import type { MandatoVigente, RegistroDeFrequencia } from '../domain/registro-de-frequencia.js';

export interface RegistroDeFrequenciaRepository {
  buscar(
    casa: CasaLegislativa,
    pessoa: PessoaId,
    dia: DiaDeSessao,
  ): Promise<RegistroDeFrequencia | undefined>;
  /** Grava o registro e seus eventos na mesma transação (ADR-0007). */
  salvar(registro: RegistroDeFrequencia): Promise<void>;
}

/** Como a fonte identifica o parlamentar (`camara:204554`). */
export interface ParlamentarNaFonte {
  readonly fonte: 'camara' | 'senado';
  readonly codigo: string;
}

/**
 * Mandatos do contexto Agentes Públicos, o único que diz quem é quem (mapa de contextos). Este
 * contexto não guarda identificadores das fontes: pergunta a quem é dono deles.
 */
export interface MandatosDosParlamentares {
  vigenteNoDia(
    parlamentar: ParlamentarNaFonte,
    casa: CasaLegislativa,
    dia: DiaDeSessao,
  ): Promise<MandatoVigente | undefined>;
}

/** De onde veio um dado: a resposta bruta guardada no bronze (ADR-0016). */
export interface OrigemDoDado {
  readonly fonte: string;
  readonly url: string;
  readonly coletadaEm: Date;
  readonly sha256: string;
  readonly caminho: string;
  readonly tipoDeConteudo: string;
}

/** Registro de capturas no contexto Acervo; idempotente pelo hash (ADR-0016). */
export interface RegistroDeCapturas {
  registrar(origem: OrigemDoDado): Promise<Result<CapturaId, DomainError>>;
}

export interface Relogio {
  agora(): Date;
}
