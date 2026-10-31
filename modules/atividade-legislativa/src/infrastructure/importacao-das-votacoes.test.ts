import { createHash } from 'node:crypto';

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
import { outbox, votacaoNominal } from './esquema.js';

const LOTE_1 = '0192d5e0-5555-7000-8000-000000000001';
const LOTE_2 = '0192d5e0-5555-7000-8000-000000000002';

// Tabelas prata como a plataforma de dados as cria (data-platform/migracoes, contratos v1.0.0).
const ORIGEM_DDL = `lote_id uuid NOT NULL, origem_fonte text NOT NULL, origem_url text NOT NULL,
  origem_coletada_em timestamptz NOT NULL, origem_sha256 char(64) NOT NULL,
  origem_caminho text NOT NULL, origem_tipo_de_conteudo text NOT NULL`;
const PRATA = sql.raw(`
  CREATE TABLE ingestao.camara_votacao (
    id_votacao text PRIMARY KEY, data date NOT NULL, registrada_em timestamptz NOT NULL,
    descricao text NOT NULL, aprovacao boolean, proposicoes jsonb NOT NULL, ${ORIGEM_DDL}
  );
  CREATE TABLE ingestao.camara_votos (
    id_votacao text PRIMARY KEY, votos jsonb NOT NULL, ${ORIGEM_DDL}
  );
`);

/** Cada resposta tem o seu conteúdo e, portanto, o seu hash (o Acervo identifica a captura por ele). */
function origem(lote: string, versao: string, url: string) {
  const sha256 = createHash('sha256').update(`${versao}:${url}`).digest('hex');
  return sql`${lote}, 'camara', ${url}, '2026-10-30T09:00:00Z', ${sha256}, ${`bronze/camara/${sha256}`}, 'application/json'`;
}

const voto = (idDeputado: number, tipo: string | null, registradoEm: string) => ({
  id_deputado: idDeputado,
  voto: tipo,
  registrado_em: registradoEm,
  sigla_partido: 'PEX',
  sigla_uf: 'SP',
});

const PL_900 = JSON.stringify([
  { id: 9009001, sigla_tipo: 'PL', numero: 900, ano: 2026, ementa: 'Tema fictício.' },
]);

/**
 * Ana (900001) e o suplente Bruno (900002, no cargo até 15/10) votam no PL 900; a suplente Diana
 * (900004) também, registrada às 19h41 depois do afastamento das 13h do mesmo dia; Carla (900003) não é
 * conhecida de Agentes Públicos; a votação secreta é do dia 15, quando Bruno já tinha saído; a última
 * votação chegou sem a lista de votos. No segundo lote a Câmara corrige o voto do Bruno.
 */
function votacoes(lote: string, versao: string, votoDoBruno: string) {
  const v = (id: string) => origem(lote, versao, `https://camara/votacoes/${id}`);
  const votos = (id: string, lista: unknown[]) =>
    sql`(${id}, ${JSON.stringify(lista)}, ${origem(lote, versao, `https://camara/votacoes/${id}/votos`)})`;
  return [
    sql`
    INSERT INTO ingestao.camara_votacao VALUES
      ('900100-10', '2026-10-14', '2026-10-14T19:42:50-03:00', 'Aprovado o PL 900.', true,
        ${PL_900}, ${v('900100-10')}),
      ('900100-20', '2026-10-14', '2026-10-14T20:10:00-03:00', 'Rejeitado o requerimento.', false,
        '[]', ${v('900100-20')}),
      ('900200-5', '2026-10-15', '2026-10-15T12:03:39-03:00', 'Aprovado o PDL 901.', null,
        '[]', ${v('900200-5')}),
      ('900300-1', '2026-10-15', '2026-10-15T18:00:00-03:00', 'Aprovada a MPV 1.', true,
        '[]', ${v('900300-1')})
    ON CONFLICT (id_votacao) DO UPDATE SET lote_id = EXCLUDED.lote_id
  `,
    sql`
    INSERT INTO ingestao.camara_votos VALUES
      ${votos('900100-10', [
        voto(900001, 'Sim', '2026-10-14T19:41:40-03:00'),
        voto(900002, votoDoBruno, '2026-10-14T19:40:02-03:00'),
        voto(900004, 'Sim', '2026-10-14T19:41:45-03:00'),
      ])},
      ${votos('900100-20', [
        voto(900001, 'Não', '2026-10-14T20:09:00-03:00'),
        voto(900003, 'Sim', '2026-10-14T20:09:30-03:00'),
      ])},
      ${votos('900200-5', [voto(900001, null, '2026-10-15T12:01:00-03:00')])}
    ON CONFLICT (id_votacao) DO UPDATE SET
      votos = EXCLUDED.votos, lote_id = EXCLUDED.lote_id, origem_sha256 = EXCLUDED.origem_sha256,
      origem_caminho = EXCLUDED.origem_caminho
  `,
  ];
}

const loteIngerido = (id: string, tabela = 'camara_votacao'): EnvelopeDeEvento => ({
  id,
  tipo: 'LoteIngerido',
  versao: 1,
  ocorridoEm: '2026-10-30T09:00:00.000Z',
  idDoAgregado: `camara.${tabela}`,
  idDeCorrelacao: `ingestao-${id}`,
  dados: {
    fonte: 'camara',
    tabela,
    versaoDoContrato: '1.0.0',
    coletadoDe: '2026-09-30T09:00:00Z',
    coletadoAte: '2026-10-30T09:00:00Z',
    registros: 4,
  },
});

describe('importação das votações nominais da Câmara (prata → Atividade Legislativa)', () => {
  let postgres: PostgresDeTeste;
  let bancos: BancoDoContexto[];
  let banco: BancoDoContexto;
  let ingestao: BancoDoContexto;
  const barramento = new BarramentoEmMemoria();
  const resumos: ResumoDaImportacao[] = [];
  const pessoas = new Map<string, string>();

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

    const relogio = { agora: () => AGORA };
    const registrarCaptura = montarAcervo(acervo, relogio).registrarCaptura;
    const agentesPublicos = montarAgentesPublicos({ banco: agentes, registrarCaptura, relogio });
    for (const [codigo, nome, inicio, fim] of [
      ['900001', 'Ana Exemplo', '2023-02-01T15:05:00.000Z', '2027-02-01T02:59:59.999Z'],
      ['900002', 'Bruno Modelo', '2026-06-16T20:13:00.000Z', '2026-10-15T03:00:00.000Z'],
      ['900004', 'Diana Suplente', '2026-06-16T20:13:00.000Z', '2026-10-14T16:00:00.000Z'],
    ] as const) {
      const sincronizada = await agentesPublicos.sincronizar.execute({
        identificador: { fonte: 'camara', codigo },
        nome,
        siglaPartido: 'PEX',
        urlDaFoto: null,
        mandatos: [
          {
            cargo: 'deputado_federal',
            circunscricao: '35',
            inicio: new Date(inicio),
            fim: new Date(fim),
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
      pessoas.set(codigo, sincronizada.value.pessoaId);
    }

    const modulo = montarAtividadeLegislativa({
      banco,
      registrarCaptura,
      mandatos: agentesPublicos.mandatos,
      pessoas: agentesPublicos.pessoas,
      relogio,
    });
    await modulo.assinarConsumidores(barramento, (resumo) => resumos.push(resumo));
  });

  afterAll(async () => {
    await Promise.all(bancos.map((b) => b.fechar()));
    await postgres.parar();
  });

  it('registra as votações com cada voto ligado ao mandato e devolve o que recusou', async () => {
    for (const insercao of votacoes(LOTE_1, 'v1', 'Não')) {
      await ingestao.drizzle.execute(insercao);
    }

    await barramento.publicar(loteIngerido(LOTE_1));

    expect(resumos.at(-1)).toMatchObject({
      loteId: LOTE_1,
      importacao: 'votacoes_da_camara',
      lidos: 4,
      novos: 2,
    });
    expect(resumos.at(-1)?.falhas.map((f) => [f.codigoNaFonte, f.erro])).toEqual([
      ['900100-20', 'votacao.sem_mandato'],
      ['900300-1', 'votacao.votos_ausentes'],
    ]);

    const registradas = await banco.drizzle
      .select()
      .from(votacaoNominal)
      .orderBy(votacaoNominal.registradaEm);
    expect(registradas.map((v) => [v.codigoNaFonte, v.dia, v.resultado])).toEqual([
      ['900100-10', '2026-10-14', 'aprovada'],
      ['900200-5', '2026-10-15', 'nao_informado'],
    ]);
    const [pl900, secreta] = registradas;
    expect(pl900?.proposicoes).toEqual([
      { codigoNaFonte: '9009001', sigla: 'PL', numero: 900, ano: 2026, ementa: 'Tema fictício.' },
    ]);
    expect(pl900?.votos.map((v) => [v.pessoaId, v.opcao, v.registroNaFonte]).sort()).toEqual(
      [
        [pessoas.get('900001'), 'sim', 'Sim'],
        [pessoas.get('900002'), 'nao', 'Não'],
        [pessoas.get('900004'), 'sim', 'Sim'],
      ].sort(),
    );
    expect(secreta?.votos.map((v) => [v.opcao, v.registroNaFonte])).toEqual([['secreto', null]]);
    expect(pl900?.capturaId).not.toEqual(pl900?.capturaDosVotosId);

    const eventos = await banco.drizzle.select().from(outbox);
    expect(eventos.map((e) => e.tipo)).toEqual([
      'VotacaoNominalRegistrada',
      'VotacaoNominalRegistrada',
    ]);
  });

  it('a correção da Câmara num lote seguinte retifica a votação', async () => {
    await banco.drizzle.execute(sql`TRUNCATE atividade_legislativa.outbox`);
    for (const insercao of votacoes(LOTE_2, 'v2', 'Abstenção')) {
      await ingestao.drizzle.execute(insercao);
    }

    await barramento.publicar(loteIngerido(LOTE_2));

    expect(resumos.at(-1)).toMatchObject({ loteId: LOTE_2, lidos: 4, novos: 0 });
    const eventos = await banco.drizzle.select().from(outbox);
    expect(eventos.map((e) => [e.tipo, e.dados['codigoNaFonte']])).toEqual([
      ['VotacaoNominalRetificada', '900100-10'],
    ]);
  });

  it('o mesmo lote entregue de novo não produz efeito', async () => {
    const quantos = resumos.length;

    await barramento.publicar(loteIngerido(LOTE_2));

    expect(resumos).toHaveLength(quantos);
  });

  it('ignora lotes de outras tabelas', async () => {
    const quantos = resumos.length;

    await barramento.publicar(loteIngerido('0192d5e0-5555-7000-8000-000000000009', 'camara_votos'));

    expect(resumos).toHaveLength(quantos);
  });
});
