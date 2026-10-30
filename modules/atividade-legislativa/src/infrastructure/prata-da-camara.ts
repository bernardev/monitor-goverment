import {
  boolean,
  date,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// Leitura das tabelas prata da Câmara (packages/contracts/prata/camara, v1). O schema `ingestao` é da
// plataforma de dados; este contexto só lê, com a permissão dada em infra/docker/postgres.
// Fica fora do drizzle.config.ts de propósito: estas tabelas não têm migração aqui.

const ingestao = pgSchema('ingestao');

export const camaraMatricula = ingestao.table('camara_matricula', {
  matricula: integer('matricula').notNull(),
  idDeputado: integer('id_deputado').notNull(),
});

const instante = (nome: string) => timestamp(nome, { withTimezone: true, mode: 'date' });

const origem = () => ({
  loteId: uuid('lote_id').notNull(),
  origemFonte: text('origem_fonte').notNull(),
  origemUrl: text('origem_url').notNull(),
  origemColetadaEm: instante('origem_coletada_em').notNull(),
  origemSha256: text('origem_sha256').notNull(),
  origemCaminho: text('origem_caminho').notNull(),
  origemTipoDeConteudo: text('origem_tipo_de_conteudo').notNull(),
});

export const camaraFrequenciaDia = ingestao.table('camara_frequencia_dia', {
  matricula: integer('matricula').notNull(),
  dia: date('dia', { mode: 'string' }).notNull(),
  frequencia: text('frequencia').notNull(),
  justificativa: text('justificativa'),
  sessoes: jsonb('sessoes').$type<{ descricao: string; frequencia: string }[]>().notNull(),
  ...origem(),
});

export const camaraVotacao = ingestao.table('camara_votacao', {
  idVotacao: text('id_votacao').notNull(),
  data: date('data', { mode: 'string' }).notNull(),
  registradaEm: instante('registrada_em').notNull(),
  descricao: text('descricao').notNull(),
  aprovacao: boolean('aprovacao'),
  proposicoes: jsonb('proposicoes')
    .$type<
      { id: number; sigla_tipo: string; numero: number; ano: number; ementa: string | null }[]
    >()
    .notNull(),
  ...origem(),
});

export const camaraVotos = ingestao.table('camara_votos', {
  idVotacao: text('id_votacao').notNull(),
  votos: jsonb('votos')
    .$type<
      {
        id_deputado: number;
        voto: string | null;
        registrado_em: string;
        sigla_partido: string;
        sigla_uf: string | null;
      }[]
    >()
    .notNull(),
  ...origem(),
});

/** Uma tramitação como a prata a guarda (contrato `camara_proposicao_tramitacoes`). */
export interface TramitacaoNaCamara {
  sequencia: number;
  data_hora: string;
  sigla_orgao: string | null;
  descricao_tramitacao: string | null;
  descricao_situacao: string | null;
  despacho: string | null;
  url: string | null;
}

export const camaraProposicao = ingestao.table('camara_proposicao', {
  idProposicao: integer('id_proposicao').notNull(),
  siglaTipo: text('sigla_tipo').notNull(),
  numero: integer('numero').notNull(),
  ano: integer('ano').notNull(),
  ementa: text('ementa'),
  apresentadaEm: instante('apresentada_em').notNull(),
  urlInteiroTeor: text('url_inteiro_teor'),
  situacao: jsonb('situacao').$type<TramitacaoNaCamara>(),
  ...origem(),
});

export const camaraProposicaoAutores = ingestao.table('camara_proposicao_autores', {
  idProposicao: integer('id_proposicao').notNull(),
  autores: jsonb('autores')
    .$type<
      {
        nome: string;
        tipo: string;
        id_deputado: number | null;
        ordem_assinatura: number;
        proponente: boolean;
      }[]
    >()
    .notNull(),
});

export const camaraProposicaoTramitacoes = ingestao.table('camara_proposicao_tramitacoes', {
  idProposicao: integer('id_proposicao').notNull(),
  tramitacoes: jsonb('tramitacoes').$type<TramitacaoNaCamara[]>().notNull(),
});
