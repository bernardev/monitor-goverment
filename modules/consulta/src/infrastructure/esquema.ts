import { definirInbox } from '@prometeu/infraestrutura';
import {
  boolean,
  char,
  date,
  index,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
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
    registradaEm: instante('registrada_em').notNull(),
    descricao: text('descricao').notNull(),
    resultado: text('resultado').notNull(),
    secreta: boolean('secreta').notNull(),
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
    capturaId: uuid('captura_id').notNull(),
    capturaDosVotosId: uuid('captura_dos_votos_id').notNull(),
    ocorridoEm: instante('ocorrido_em').notNull(),
  },
  (t) => [index('votacao_por_dia').on(t.dia, t.registradaEm)],
);

export const voto = schemaDaConsulta.table(
  'voto',
  {
    votacaoId: uuid('votacao_id').notNull(),
    pessoaId: uuid('pessoa_id').notNull(),
    opcao: text('opcao').notNull(),
    registroNaFonte: text('registro_na_fonte'),
    siglaPartidoNaFonte: text('sigla_partido_na_fonte'),
  },
  (t) => [
    primaryKey({ columns: [t.votacaoId, t.pessoaId] }),
    index('voto_por_pessoa').on(t.pessoaId),
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
