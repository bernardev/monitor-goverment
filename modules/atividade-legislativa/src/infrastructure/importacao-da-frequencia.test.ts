import { MIGRACOES_DO_ACERVO, montarAcervo, SCHEMA_DO_ACERVO } from '@prometeu/acervo';
import {
  MIGRACOES_DE_AGENTES_PUBLICOS,
  montarAgentesPublicos,
  SCHEMA_DE_AGENTES_PUBLICOS,
} from '@prometeu/agentes-publicos';
import type { EnvelopeDeEvento } from '@prometeu/contracts';
import { BancoDoContexto, migrar } from '@prometeu/infraestrutura';
import {
  BarramentoEmMemoria,
  iniciarPostgresDeTeste,
  type PostgresDeTeste,
} from '@prometeu/infraestrutura/testes';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  MIGRACOES_DE_ATIVIDADE_LEGISLATIVA,
  montarAtividadeLegislativa,
  type ResumoDaImportacao,
  SCHEMA_DE_ATIVIDADE_LEGISLATIVA,
} from '../index.js';
import { AGORA } from '../testes/construtores.js';
import { outbox, registroDeFrequencia } from './esquema.js';

const LOTE_1 = '0192d5e0-4444-7000-8000-000000000001';
const LOTE_2 = '0192d5e0-4444-7000-8000-000000000002';

// Tabelas prata como a plataforma de dados as cria (data-platform/migracoes, contratos v1.0.0).
const ORIGEM_DDL = `lote_id uuid NOT NULL, origem_fonte text NOT NULL, origem_url text NOT NULL,
  origem_coletada_em timestamptz NOT NULL, origem_sha256 char(64) NOT NULL,
  origem_caminho text NOT NULL, origem_tipo_de_conteudo text NOT NULL`;
const PRATA = sql.raw(`
  CREATE TABLE ingestao.camara_matricula (
    matricula integer PRIMARY KEY, id_deputado integer NOT NULL, ${ORIGEM_DDL}
  );
  CREATE TABLE ingestao.camara_frequencia_dia (
    matricula integer NOT NULL, dia date NOT NULL, frequencia text NOT NULL, justificativa text,
    sessoes jsonb NOT NULL, ${ORIGEM_DDL}, PRIMARY KEY (matricula, dia)
  );
`);

const origem = (lote: string, sha256: string) =>
  sql`${lote}, 'camara', 'https://camara/presencas', '2026-10-30T09:00:00Z', ${sha256}, 'bronze/camara/p', 'text/xml'`;

const MATRICULAS = sql`
  INSERT INTO ingestao.camara_matricula VALUES
    (701, 900001, ${origem(LOTE_1, '1'.repeat(64))}),
    (702, 900002, ${origem(LOTE_1, '1'.repeat(64))})
`;

const sessoes = (frequencia: string) =>
  JSON.stringify([{ descricao: 'EXTRAORDINÁRIA Nº 210 - 06/10/2026', frequencia }]);

/** Ana (701) falta no dia 6 e a justificativa só aparece no segundo lote. */
function frequencias(lote: string, sha256: string, justificada: boolean) {
  const o = origem(lote, sha256);
  return sql`
    INSERT INTO ingestao.camara_frequencia_dia VALUES
      (701, '2026-10-01', 'Presença', null, ${sessoes('Presença')}, ${o}),
      (701, '2026-10-06', ${justificada ? 'Ausência justificada' : 'Ausência'},
        ${justificada ? 'Licença para Tratamento de Saúde' : null}, ${sessoes('Ausência')}, ${o}),
      (702, '2026-10-01', 'Presença (~)', null, ${sessoes('Presença (~)')}, ${o}),
      (703, '2026-10-01', 'Presença', null, ${sessoes('Presença')}, ${o}),
      (702, '2026-10-02', 'Ausência justificada', null, ${sessoes('Ausência')}, ${o})
    ON CONFLICT (matricula, dia) DO UPDATE SET
      frequencia = EXCLUDED.frequencia, justificativa = EXCLUDED.justificativa,
      lote_id = EXCLUDED.lote_id, origem_sha256 = EXCLUDED.origem_sha256
  `;
}

const loteIngerido = (id: string): EnvelopeDeEvento => ({
  id,
  tipo: 'LoteIngerido',
  versao: 1,
  ocorridoEm: '2026-10-30T09:00:00.000Z',
  idDoAgregado: 'camara.camara_frequencia_dia',
  idDeCorrelacao: `ingestao-${id}`,
  dados: {
    fonte: 'camara',
    tabela: 'camara_frequencia_dia',
    versaoDoContrato: '1.0.0',
    coletadoDe: '2026-09-30T09:00:00Z',
    coletadoAte: '2026-10-30T09:00:00Z',
    registros: 5,
  },
});

describe('importação da frequência da Câmara (prata → Atividade Legislativa)', () => {
  let postgres: PostgresDeTeste;
  let bancos: BancoDoContexto[];
  let banco: BancoDoContexto;
  let ingestao: BancoDoContexto;
  const barramento = new BarramentoEmMemoria();
  const resumos: ResumoDaImportacao[] = [];

  beforeAll(async () => {
    postgres = await iniciarPostgresDeTeste();
    const conectar = (schema: string) =>
      BancoDoContexto.conectar(schema, postgres.urlDoContexto(schema));
    const acervo = conectar(SCHEMA_DO_ACERVO);
    const agentes = conectar(SCHEMA_DE_AGENTES_PUBLICOS);
    banco = conectar(SCHEMA_DE_ATIVIDADE_LEGISLATIVA);
    ingestao = conectar('ingestao');
    bancos = [acervo, agentes, banco, ingestao];
    await migrar(acervo, MIGRACOES_DO_ACERVO);
    await migrar(agentes, MIGRACOES_DE_AGENTES_PUBLICOS);
    await migrar(banco, MIGRACOES_DE_ATIVIDADE_LEGISLATIVA);
    await ingestao.drizzle.execute(PRATA);
    await ingestao.drizzle.execute(MATRICULAS);

    const relogio = { agora: () => AGORA };
    const registrarCaptura = montarAcervo(acervo, relogio).registrarCaptura;
    const agentesPublicos = montarAgentesPublicos({ banco: agentes, registrarCaptura, relogio });
    for (const [codigo, nome, uf] of [
      ['900001', 'Ana Exemplo', '35'],
      ['900002', 'Bruno Modelo', '33'],
    ] as const) {
      const sincronizada = await agentesPublicos.sincronizar.execute({
        identificador: { fonte: 'camara', codigo },
        nome,
        siglaPartido: 'PEX',
        urlDaFoto: null,
        mandatos: [
          {
            cargo: 'deputado_federal',
            circunscricao: uf,
            inicio: new Date('2023-02-01T03:00:00.000Z'),
            fim: new Date('2027-02-01T02:59:59.999Z'),
          },
        ],
        origem: {
          fonte: 'camara',
          url: 'https://camara/deputados',
          coletadaEm: AGORA,
          sha256: 'd'.repeat(64),
          caminho: 'bronze/camara/d',
          tipoDeConteudo: 'application/json',
        },
      });
      if (!sincronizada.ok) throw new Error(sincronizada.error.message);
    }

    const modulo = montarAtividadeLegislativa({
      banco,
      registrarCaptura,
      mandatos: agentesPublicos.mandatos,
      relogio,
    });
    await modulo.assinarConsumidores(barramento, (resumo) => resumos.push(resumo));
  });

  afterAll(async () => {
    await Promise.all(bancos.map((b) => b.fechar()));
    await postgres.parar();
  });

  it('registra presenças e ausências com o mandato vigente e devolve o que não traduziu', async () => {
    await ingestao.drizzle.execute(frequencias(LOTE_1, 'a'.repeat(64), false));

    await barramento.publicar(loteIngerido(LOTE_1));

    expect(resumos.at(-1)).toMatchObject({ loteId: LOTE_1, lidos: 5, novos: 3 });
    expect(resumos.at(-1)?.falhas.map((f) => [f.codigoNaFonte, f.erro])).toEqual([
      ['matricula:702:2026-10-02', 'frequencia.justificativa_sem_motivo'],
      ['matricula:703:2026-10-01', 'frequencia.matricula_desconhecida'],
    ]);
    const registros = await banco.drizzle
      .select()
      .from(registroDeFrequencia)
      .orderBy(registroDeFrequencia.dia, registroDeFrequencia.registroNaFonte);
    expect(registros.map((r) => [r.dia, r.situacao, r.registroNaFonte])).toEqual([
      ['2026-10-01', 'presente', 'Presença'],
      ['2026-10-01', 'presente', 'Presença (~)'],
      ['2026-10-06', 'ausente', 'Ausência'],
    ]);
    const eventos = await banco.drizzle.select().from(outbox);
    expect(eventos.map((e) => e.tipo).sort()).toEqual([
      'AusenciaRegistrada',
      'PresencaRegistrada',
      'PresencaRegistrada',
    ]);
  });

  it('a justificativa que chega num lote seguinte retifica o dia', async () => {
    await banco.drizzle.execute(sql`TRUNCATE atividade_legislativa.outbox`);
    await ingestao.drizzle.execute(frequencias(LOTE_2, 'b'.repeat(64), true));

    await barramento.publicar(loteIngerido(LOTE_2));

    expect(resumos.at(-1)).toMatchObject({ loteId: LOTE_2, novos: 0 });
    const eventos = await banco.drizzle.select().from(outbox);
    expect(eventos.map((e) => [e.tipo, e.dados['situacaoAnterior'], e.dados['motivo']])).toEqual([
      [
        'FrequenciaRetificada',
        'ausente',
        { categoria: 'licenca_saude', descricaoNaFonte: 'Licença para Tratamento de Saúde' },
      ],
    ]);
  });

  it('o mesmo lote entregue de novo não produz efeito', async () => {
    const antes = await banco.drizzle.select().from(outbox);

    await barramento.publicar(loteIngerido(LOTE_2));

    expect(await banco.drizzle.select().from(outbox)).toHaveLength(antes.length);
  });
});
