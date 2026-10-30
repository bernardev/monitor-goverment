import { definirInbox } from '@prometeu/infraestrutura';
import {
  bigint,
  boolean,
  char,
  date,
  index,
  jsonb,
  pgSchema,
  primaryKey,
  integer,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Projeções de leitura (ADR-0008): descartáveis e reconstruíveis a partir dos eventos. Nenhuma regra
// de negócio mora aqui; só a forma que o site e a API pública precisam.

export const schemaDaConsulta = pgSchema('consulta');

const instante = (nome: string) => timestamp(nome, { withTimezone: true, mode: 'date' });

/**
 * Perfil de cada parlamentar. Eventos podem chegar fora de ordem (ADR-0007): cada grupo de campos
 * guarda quando o fato aconteceu (`*_em`) e só aceita fatos mais novos.
 */
export const parlamentar = schemaDaConsulta.table(
  'parlamentar',
  {
    pessoaId: uuid('pessoa_id').primaryKey(),
    nome: text('nome'),
    nomeEm: instante('nome_em'),
    siglaPartido: text('sigla_partido'),
    partidoEm: instante('partido_em'),
    urlDaFoto: text('url_da_foto'),
    fotoEm: instante('foto_em'),
    mandatoId: uuid('mandato_id'),
    cargo: text('cargo'),
    circunscricao: text('circunscricao'),
    mandatoInicio: instante('mandato_inicio'),
    mandatoFim: instante('mandato_fim'),
    mandatoCapturaId: uuid('mandato_captura_id'),
    /** Captura do fato mais recente aplicado ao perfil. */
    capturaId: uuid('captura_id'),
    atualizadoEm: instante('atualizado_em').notNull(),
  },
  (t) => [
    index('parlamentar_por_nome').on(t.nome),
    index('parlamentar_por_circunscricao').on(t.circunscricao),
  ],
);

/**
 * Frequência de cada parlamentar por dia de sessão. Os eventos de Atividade Legislativa trazem o
 * estado completo do dia; vale o mais novo (`ocorrido_em`).
 */
export const frequencia = schemaDaConsulta.table(
  'frequencia',
  {
    registroId: uuid('registro_id').primaryKey(),
    pessoaId: uuid('pessoa_id').notNull(),
    casa: text('casa').notNull(),
    dia: date('dia', { mode: 'string' }).notNull(),
    situacao: text('situacao').notNull(),
    motivoCategoria: text('motivo_categoria'),
    motivoDescricao: text('motivo_descricao'),
    registroNaFonte: text('registro_na_fonte').notNull(),
    sessoes: jsonb('sessoes').$type<{ descricao: string; presente: boolean }[]>().notNull(),
    capturaId: uuid('captura_id').notNull(),
    ocorridoEm: instante('ocorrido_em').notNull(),
  },
  (t) => [index('frequencia_por_pessoa').on(t.pessoaId, t.dia)],
);

/**
 * Votações nominais. O evento traz o estado completo da votação; vale o mais novo (`ocorrido_em`), e
 * os votos são trocados junto.
 */
export const votacao = schemaDaConsulta.table(
  'votacao',
  {
    votacaoId: uuid('votacao_id').primaryKey(),
    casa: text('casa').notNull(),
    codigoNaFonte: text('codigo_na_fonte').notNull(),
    dia: date('dia', { mode: 'string' }).notNull(),
    /** Nulo quando a casa não informa o horário (Senado). */
    registradaEm: instante('registrada_em'),
    descricao: text('descricao').notNull(),
    resultado: text('resultado').notNull(),
    secreta: boolean('secreta').notNull(),
    relacaoCompleta: boolean('relacao_completa').notNull().default(false),
    proposicoes: jsonb('proposicoes')
      .$type<
        {
          codigoNaFonte: string;
          sigla: string;
          numero: number;
          ano: number;
          ementa: string | null;
        }[]
      >()
      .notNull(),
    /** Quantos votos em cada opção. */
    placar: jsonb('placar').$type<Record<string, number>>().notNull(),
    /** Quem não votou, por situação; vazio quando a casa não lista quem não votou. */
    contagemSemVoto: jsonb('contagem_sem_voto')
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
    capturaId: uuid('captura_id').notNull(),
    capturaDosVotosId: uuid('captura_dos_votos_id').notNull(),
    ocorridoEm: instante('ocorrido_em').notNull(),
  },
  (t) => [index('votacao_por_dia').on(t.dia, t.registradaEm)],
);

/**
 * Um registro por parlamentar listado na votação: o voto (`opcao`) ou, quando a casa informa quem
 * não votou, a situação e o motivo (`situacao_sem_voto`). Um dos dois, nunca os dois.
 */
export const voto = schemaDaConsulta.table(
  'voto',
  {
    votacaoId: uuid('votacao_id').notNull(),
    pessoaId: uuid('pessoa_id').notNull(),
    opcao: text('opcao'),
    situacaoSemVoto: text('situacao_sem_voto'),
    motivoCategoria: text('motivo_categoria'),
    motivoDescricao: text('motivo_descricao'),
    registroNaFonte: text('registro_na_fonte'),
    siglaPartidoNaFonte: text('sigla_partido_na_fonte'),
  },
  (t) => [
    primaryKey({ columns: [t.votacaoId, t.pessoaId] }),
    index('voto_por_pessoa').on(t.pessoaId),
  ],
);

/**
 * Proposições, com autoria e tramitação. Os eventos trazem o estado completo; vale o mais novo
 * (`ocorrido_em`), e a autoria é trocada junto.
 */
export const proposicao = schemaDaConsulta.table(
  'proposicao',
  {
    proposicaoId: uuid('proposicao_id').primaryKey(),
    casa: text('casa').notNull(),
    codigoNaFonte: text('codigo_na_fonte').notNull(),
    sigla: text('sigla').notNull(),
    numero: integer('numero').notNull(),
    ano: integer('ano').notNull(),
    ementa: text('ementa'),
    apresentadaEm: instante('apresentada_em'),
    situacao: jsonb('situacao').$type<{ descricao: string; desde: string; orgao: string | null }>(),
    ultimaTramitacaoEm: instante('ultima_tramitacao_em'),
    normaGerada: text('norma_gerada'),
    urlDoTexto: text('url_do_texto'),
    autores: jsonb('autores')
      .$type<
        { pessoaId: string | null; nomeNaFonte: string; tipoNaFonte: string; proponente: boolean }[]
      >()
      .notNull(),
    /** Em ordem cronológica. */
    tramitacoes: jsonb('tramitacoes')
      .$type<
        {
          em: string;
          orgao: string | null;
          descricao: string;
          situacao: string | null;
          despacho: string | null;
        }[]
      >()
      .notNull(),
    capturaId: uuid('captura_id').notNull(),
    ocorridoEm: instante('ocorrido_em').notNull(),
  },
  (t) => [
    uniqueIndex('proposicao_por_codigo').on(t.casa, t.codigoNaFonte),
    index('proposicao_por_ultima_tramitacao').on(t.ultimaTramitacaoEm),
  ],
);

/** Quem é autor de quê, para achar as proposições de um parlamentar. */
export const autoria = schemaDaConsulta.table(
  'autoria',
  {
    proposicaoId: uuid('proposicao_id').notNull(),
    pessoaId: uuid('pessoa_id').notNull(),
    proponente: boolean('proponente').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.proposicaoId, t.pessoaId] }),
    index('autoria_por_pessoa').on(t.pessoaId),
  ],
);

/** Execução de uma destinação, em centavos como texto (JSON não tem inteiro de 64 bits). */
export interface ExecucaoProjetada {
  empenhadoCentavos: string;
  liquidadoCentavos: string;
  pagoCentavos: string;
  restosInscritosCentavos: string;
  restosCanceladosCentavos: string;
  restosPagosCentavos: string;
}

interface ClassificacaoProjetada {
  codigo: string;
  nome: string;
}

export interface DestinacaoProjetada extends ExecucaoProjetada {
  localidade: string;
  municipioIbge: string | null;
  ufIbge: string | null;
  funcao: ClassificacaoProjetada;
  subfuncao: ClassificacaoProjetada;
  programa: ClassificacaoProjetada;
  acao: ClassificacaoProjetada;
  planoOrcamentario: ClassificacaoProjetada;
  modalidade: 'finalidade_definida' | 'transferencia_especial' | null;
}

const centavos = (nome: string) => bigint(nome, { mode: 'bigint' }).notNull();

/**
 * Emendas parlamentares com a execução já somada, para listar e ordenar sem abrir as destinações.
 * `ufs` são as siglas das UFs de destino, para o filtro por estado.
 */
export const emenda = schemaDaConsulta.table(
  'emenda',
  {
    emendaId: uuid('emenda_id').primaryKey(),
    codigoNaFonte: text('codigo_na_fonte').notNull(),
    ano: integer('ano').notNull(),
    tipo: text('tipo').notNull(),
    numero: text('numero').notNull(),
    autorPessoaId: uuid('autor_pessoa_id'),
    autorNome: text('autor_nome').notNull(),
    ufs: text('ufs').array().notNull(),
    destinacoes: jsonb('destinacoes').$type<DestinacaoProjetada[]>().notNull(),
    empenhado: centavos('empenhado_centavos'),
    liquidado: centavos('liquidado_centavos'),
    pago: centavos('pago_centavos'),
    restosInscritos: centavos('restos_inscritos_centavos'),
    restosCancelados: centavos('restos_cancelados_centavos'),
    restosPagos: centavos('restos_pagos_centavos'),
    capturaId: uuid('captura_id').notNull(),
    ocorridoEm: instante('ocorrido_em').notNull(),
  },
  (t) => [
    uniqueIndex('emenda_por_codigo').on(t.codigoNaFonte),
    index('emenda_por_ano').on(t.ano),
    index('emenda_por_autor').on(t.autorPessoaId),
    index('emenda_por_uf').using('gin', t.ufs),
  ],
);

export const captura = schemaDaConsulta.table('captura', {
  capturaId: uuid('captura_id').primaryKey(),
  fonte: text('fonte').notNull(),
  url: text('url').notNull(),
  coletadaEm: instante('coletada_em').notNull(),
  sha256: char('sha256', { length: 64 }).notNull(),
});

export const inbox = definirInbox(schemaDaConsulta);
