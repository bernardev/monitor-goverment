import {
  bigint,
  boolean,
  char,
  date,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// Leitura da prata do Obrasgov.br (packages/contracts/prata/obrasgov, v1). O schema `ingestao` é da
// plataforma de dados; este contexto só lê. Fora do drizzle.config.ts.

const ingestao = pgSchema('ingestao');
const dia = (nome: string) => date(nome, { mode: 'string' });

/** Colunas de origem (packages/contracts/prata/colunas-de-origem.md). */
function origem() {
  return {
    loteId: uuid('lote_id').notNull(),
    origemFonte: text('origem_fonte').notNull(),
    origemUrl: text('origem_url').notNull(),
    origemColetadaEm: timestamp('origem_coletada_em', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    origemSha256: text('origem_sha256').notNull(),
    origemCaminho: text('origem_caminho').notNull(),
    origemTipoDeConteudo: text('origem_tipo_de_conteudo').notNull(),
  };
}

export const obrasgovEmpenhoDeEmenda = ingestao.table('obrasgov_empenho_de_emenda', {
  idProjeto: text('id_projeto').notNull(),
  ugEmitente: text('ug_emitente').notNull(),
  numeroEmpenho: text('numero_empenho').notNull(),
  codigoEmenda: text('codigo_emenda').notNull(),
  acaoOrcamentaria: text('acao_orcamentaria'),
  valorEmpenhadoCentavos: bigint('valor_empenhado_centavos', { mode: 'bigint' }).notNull(),
  emitidoEm: dia('emitido_em'),
  ...origem(),
});

export const obrasgovProjeto = ingestao.table('obrasgov_projeto', {
  idProjeto: text('id_projeto').notNull(),
  nome: text('nome').notNull(),
  descricao: text('descricao'),
  natureza: text('natureza'),
  especie: text('especie'),
  situacao: text('situacao').notNull(),
  uf: char('uf', { length: 2 }),
  endereco: text('endereco'),
  inicioPrevisto: dia('inicio_previsto'),
  fimPrevisto: dia('fim_previsto'),
  inicioEfetivo: dia('inicio_efetivo'),
  fimEfetivo: dia('fim_efetivo'),
  executores: jsonb('executores').$type<{ nome: string | null; cnpj: string | null }[]>().notNull(),
  investimentosPrevistos: jsonb('investimentos_previstos')
    .$type<{ fonte: string | null; valor_centavos: number }[]>()
    .notNull(),
  localizacoes: jsonb('localizacoes').$type<{ latitude: string; longitude: string }[]>().notNull(),
  ...origem(),
});

export const obrasgovExecucaoFisica = ingestao.table('obrasgov_execucao_fisica', {
  idExecucao: bigint('id_execucao', { mode: 'number' }).notNull(),
  idProjeto: text('id_projeto').notNull(),
  percentualCentesimos: integer('percentual_centesimos'),
  atualizadaEm: dia('atualizada_em'),
  cadastradaEm: dia('cadastrada_em'),
  ...origem(),
});

export const obrasgovSituacao = ingestao.table('obrasgov_situacao', {
  idHistorico: bigint('id_historico', { mode: 'number' }).notNull(),
  idProjeto: text('id_projeto').notNull(),
  situacao: text('situacao').notNull(),
  em: dia('em').notNull(),
  justificativa: text('justificativa'),
  comTratativas: boolean('com_tratativas'),
  ...origem(),
});

export const obrasgovLocalizacao = ingestao.table('obrasgov_localizacao', {
  idGeometria: bigint('id_geometria', { mode: 'number' }).notNull(),
  idProjeto: text('id_projeto').notNull(),
  municipio: text('municipio'),
  codigoMunicipioIbge: char('codigo_municipio_ibge', { length: 7 }),
  ...origem(),
});
