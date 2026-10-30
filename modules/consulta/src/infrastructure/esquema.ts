import { definirInbox } from '@prometeu/infraestrutura';
import { char, index, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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

export const captura = schemaDaConsulta.table('captura', {
  capturaId: uuid('captura_id').primaryKey(),
  fonte: text('fonte').notNull(),
  url: text('url').notNull(),
  coletadaEm: instante('coletada_em').notNull(),
  sha256: char('sha256', { length: 64 }).notNull(),
});

export const inbox = definirInbox(schemaDaConsulta);
