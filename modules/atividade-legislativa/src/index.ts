// Ponto de entrada público do módulo (ADR-0002). Outros módulos e apps só importam o que for
// exportado aqui: fachada de casos de uso e contratos. Nunca exporte entidades ou repositórios.
import { fileURLToPath } from 'node:url';

import type { RegistrarCaptura } from '@prometeu/acervo';
import type { ConsultaDeMandatos, ConsultaDePessoas } from '@prometeu/agentes-publicos';
import {
  type BancoDoContexto,
  type BarramentoDeEventos,
  RelayDaOutbox,
} from '@prometeu/infraestrutura';

import type { Relogio } from './application/portas.js';
import { RegistrarFrequencia } from './application/registrar-frequencia.js';
import { RegistrarProposicao } from './application/registrar-proposicao.js';
import { RegistrarVotacaoNominal } from './application/registrar-votacao-nominal.js';
import { outbox } from './infrastructure/esquema.js';
import { ImportadorDeFrequenciaDaCamara } from './infrastructure/importador-de-frequencia-da-camara.js';
import { ImportadorDeProposicoesDaCamara } from './infrastructure/importador-de-proposicoes-da-camara.js';
import { ImportadorDeProposicoesDoSenado } from './infrastructure/importador-de-proposicoes-do-senado.js';
import { ImportadorDeVotacoesDaCamara } from './infrastructure/importador-de-votacoes-da-camara.js';
import { ImportadorDeVotacoesDoSenado } from './infrastructure/importador-de-votacoes-do-senado.js';
import { MandatosEmAgentesPublicos } from './infrastructure/mandatos-em-agentes-publicos.js';
import { PessoasEmAgentesPublicos } from './infrastructure/pessoas-em-agentes-publicos.js';
import { ProposicaoRepositoryPostgres } from './infrastructure/proposicao-repository-postgres.js';
import { RegistroDeCapturasNoAcervo } from './infrastructure/registro-de-capturas-no-acervo.js';
import { RegistroDeFrequenciaRepositoryPostgres } from './infrastructure/registro-de-frequencia-repository-postgres.js';
import type { ResumoDaImportacao } from './infrastructure/resumo-da-importacao.js';
import { VotacaoNominalRepositoryPostgres } from './infrastructure/votacao-nominal-repository-postgres.js';
import { assinarConsumidores } from './interface/consumidores.js';

export type { CasaLegislativa } from './domain/casa-legislativa.js';
export type { CategoriaDoMotivo } from './domain/motivo-da-ausencia.js';
export type { Situacao } from './domain/situacao.js';
export type { OpcaoDeVoto, ResultadoDaVotacao, SituacaoSemVoto } from './domain/voto.js';
export type { TipoDeProposicao } from './domain/proposicao.js';
export type * from './domain/eventos.js';
export type { Relogio } from './application/portas.js';
export type {
  RegistrarFrequencia,
  RegistrarFrequenciaInput,
  RegistrarFrequenciaOutput,
} from './application/registrar-frequencia.js';
export type {
  RegistrarVotacaoNominal,
  RegistrarVotacaoNominalInput,
  RegistrarVotacaoNominalOutput,
} from './application/registrar-votacao-nominal.js';
export type {
  FalhaDeImportacao,
  ResumoDaImportacao,
} from './infrastructure/resumo-da-importacao.js';
export { ConflitoDeConcorrencia } from './infrastructure/persistencia.js';

export const SCHEMA_DE_ATIVIDADE_LEGISLATIVA = 'atividade_legislativa';
export const MIGRACOES_DE_ATIVIDADE_LEGISLATIVA = fileURLToPath(
  new URL('../drizzle', import.meta.url),
);

export interface DependenciasDeAtividadeLegislativa {
  readonly banco: BancoDoContexto;
  /** Serviço de host aberto do Acervo (ADR-0016). */
  readonly registrarCaptura: RegistrarCaptura;
  /** Serviço de host aberto de Agentes Públicos: quem é o parlamentar e qual o mandato. */
  readonly mandatos: Pick<ConsultaDeMandatos, 'vigente' | 'ultimoEncerradoAntes'>;
  /** Serviço de host aberto de Agentes Públicos: o autor parlamentar pelo código da fonte. */
  readonly pessoas: ConsultaDePessoas;
  readonly relogio?: Relogio;
}

export interface ModuloAtividadeLegislativa {
  readonly registrarFrequencia: RegistrarFrequencia;
  readonly registrarVotacaoNominal: RegistrarVotacaoNominal;
  importarFrequenciaDaCamara(loteId: string): Promise<ResumoDaImportacao>;
  importarVotacoesDaCamara(loteId: string): Promise<ResumoDaImportacao>;
  importarVotacoesDoSenado(loteId: string): Promise<ResumoDaImportacao>;
  importarProposicoesDaCamara(loteId: string): Promise<ResumoDaImportacao>;
  importarProposicoesDoSenado(loteId: string): Promise<ResumoDaImportacao>;
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
  const mandatos = new MandatosEmAgentesPublicos(dependencias.mandatos);
  const capturas = new RegistroDeCapturasNoAcervo(dependencias.registrarCaptura);
  const relogio = dependencias.relogio ?? { agora: () => new Date() };
  const registrarFrequencia = new RegistrarFrequencia(
    new RegistroDeFrequenciaRepositoryPostgres(banco),
    mandatos,
    capturas,
    relogio,
  );
  const registrarVotacaoNominal = new RegistrarVotacaoNominal(
    new VotacaoNominalRepositoryPostgres(banco),
    mandatos,
    capturas,
    relogio,
  );
  const registrarProposicao = new RegistrarProposicao(
    new ProposicaoRepositoryPostgres(banco),
    new PessoasEmAgentesPublicos(dependencias.pessoas),
    capturas,
    relogio,
  );
  const importadores = {
    frequencia: new ImportadorDeFrequenciaDaCamara(banco, registrarFrequencia),
    votacoes: new ImportadorDeVotacoesDaCamara(banco, registrarVotacaoNominal),
    votacoesDoSenado: new ImportadorDeVotacoesDoSenado(banco, registrarVotacaoNominal),
    proposicoes: new ImportadorDeProposicoesDaCamara(banco, registrarProposicao),
    proposicoesDoSenado: new ImportadorDeProposicoesDoSenado(banco, registrarProposicao),
  };
  return {
    registrarFrequencia,
    registrarVotacaoNominal,
    importarFrequenciaDaCamara: (loteId) => importadores.frequencia.importar(loteId),
    importarVotacoesDaCamara: (loteId) => importadores.votacoes.importar(loteId),
    importarVotacoesDoSenado: (loteId) => importadores.votacoesDoSenado.importar(loteId),
    importarProposicoesDaCamara: (loteId) => importadores.proposicoes.importar(loteId),
    importarProposicoesDoSenado: (loteId) => importadores.proposicoesDoSenado.importar(loteId),
    assinarConsumidores: (barramento, aoImportar) =>
      assinarConsumidores(barramento, banco, importadores, aoImportar),
    criarRelay: (barramento) => new RelayDaOutbox(banco, outbox, barramento),
  };
}
