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
import { outbox, proposicao } from './esquema.js';

// Tabelas prata como a plataforma de dados as cria (data-platform/migracoes, contratos v1.0.0).
const ORIGEM_DDL = `lote_id uuid NOT NULL, origem_fonte text NOT NULL, origem_url text NOT NULL,
  origem_coletada_em timestamptz NOT NULL, origem_sha256 char(64) NOT NULL,
  origem_caminho text NOT NULL, origem_tipo_de_conteudo text NOT NULL`;
const PRATA = sql.raw(`
  CREATE TABLE ingestao.camara_proposicao (
    id_proposicao integer PRIMARY KEY, sigla_tipo text NOT NULL, numero integer NOT NULL,
    ano integer NOT NULL, ementa text, apresentada_em timestamptz NOT NULL, url_inteiro_teor text,
    situacao jsonb, ${ORIGEM_DDL}
  );
  CREATE TABLE ingestao.camara_proposicao_autores (
    id_proposicao integer PRIMARY KEY, autores jsonb NOT NULL, ${ORIGEM_DDL}
  );
  CREATE TABLE ingestao.camara_proposicao_tramitacoes (
    id_proposicao integer PRIMARY KEY, tramitacoes jsonb NOT NULL, ${ORIGEM_DDL}
  );
  CREATE TABLE ingestao.senado_processo (
    id_processo integer PRIMARY KEY, codigo_materia integer, sigla text NOT NULL,
    numero integer NOT NULL, ano integer NOT NULL, ementa text, apresentada_em date,
    casa_iniciadora text, tramitando boolean NOT NULL, situacao jsonb, autores jsonb NOT NULL,
    situacoes jsonb NOT NULL, norma_gerada text, url_documento text, ${ORIGEM_DDL}
  );
`);

function origem(lote: string, url: string) {
  const sha256 = createHash('sha256').update(`${lote}:${url}`).digest('hex');
  return sql`${lote}, 'camara', ${url}, '2026-10-30T09:00:00Z', ${sha256}, 'bronze/x', 'application/json'`;
}

const tramitacao = (sequencia: number, dataHora: string, descricao: string, despacho: string) => ({
  sequencia,
  data_hora: dataHora,
  sigla_orgao: 'CCJC',
  descricao_tramitacao: descricao,
  descricao_situacao: 'Aguardando Parecer',
  despacho,
  url: null,
});

/**
 * PL 901 da Ana (deputada), com um coautor que Agentes Públicos não conhece e uma comissão. A
 * sequência 2 vem repetida e datada antes da 1: a ordem final é cronológica. A MPV 902 chegou sem
 * a linha de autores.
 */
async function camara(ingestao: BancoDoContexto, lote: string, comPauta: boolean): Promise<void> {
  const atos = [
    tramitacao(2, '2026-03-01T10:00:00-03:00', 'Recebimento', 'Recebido.'),
    tramitacao(1, '2026-03-02T10:00:00-03:00', 'Apresentação de Proposição', 'Apresentado.'),
    tramitacao(2, '2026-03-01T10:00:00-03:00', 'Recebimento', 'Segundo despacho.'),
    ...(comPauta
      ? [tramitacao(3, '2026-10-28T15:00:00-03:00', 'Inclusão na Ordem do Dia', 'Pauta.')]
      : []),
  ];
  const situacao = atos.at(-1);
  await ingestao.drizzle.execute(sql`
    INSERT INTO ingestao.camara_proposicao VALUES
      (900301, 'PL', 901, 2026, 'Tema fictício.', '2026-03-02T10:00:00-03:00', null,
       ${JSON.stringify(situacao)}, ${origem(lote, 'https://camara/proposicoes/900301')}),
      (900302, 'MPV', 902, 2026, 'Crédito fictício.', '2026-03-02T10:00:00-03:00', null, null,
       ${origem(lote, 'https://camara/proposicoes/900302')})
    ON CONFLICT (id_proposicao) DO UPDATE SET situacao = EXCLUDED.situacao,
      lote_id = EXCLUDED.lote_id, origem_sha256 = EXCLUDED.origem_sha256`);
  await ingestao.drizzle.execute(sql`
    INSERT INTO ingestao.camara_proposicao_autores VALUES (900301, ${JSON.stringify([
      {
        nome: 'Ana Exemplo',
        tipo: 'Deputado(a)',
        id_deputado: 900001,
        ordem_assinatura: 1,
        proponente: true,
      },
      {
        nome: 'Ex Deputado',
        tipo: 'Deputado(a)',
        id_deputado: 999999,
        ordem_assinatura: 2,
        proponente: true,
      },
      {
        nome: 'Ana Exemplo',
        tipo: 'Deputado(a)',
        id_deputado: 900001,
        ordem_assinatura: 3,
        proponente: false,
      },
      {
        nome: 'Comissão de Exemplo',
        tipo: 'Órgão',
        id_deputado: null,
        ordem_assinatura: 4,
        proponente: false,
      },
    ])}, ${origem(lote, 'https://camara/proposicoes/900301/autores')})
    ON CONFLICT (id_proposicao) DO NOTHING`);
  await ingestao.drizzle.execute(sql`
    INSERT INTO ingestao.camara_proposicao_tramitacoes VALUES (900301, ${JSON.stringify(atos)},
      ${origem(lote, 'https://camara/proposicoes/900301/tramitacoes')})
    ON CONFLICT (id_proposicao) DO UPDATE SET tramitacoes = EXCLUDED.tramitacoes`);
}

async function senado(ingestao: BancoDoContexto, lote: string): Promise<void> {
  await ingestao.drizzle.execute(sql`
    INSERT INTO ingestao.senado_processo VALUES (
      900401, 9000401, 'PL', 903, 2026, 'Altera uma lei fictícia.', '2026-04-01', 'SF', true,
      ${JSON.stringify({ sigla: 'AGDREL', descricao: 'AGUARDANDO DESIGNAÇÃO DO RELATOR', desde: '2026-10-20' })},
      ${JSON.stringify([
        {
          nome: 'Ana Senadora',
          tipo: 'SENADOR',
          codigo_parlamentar: 900101,
          sigla_partido: 'PEX',
          uf: 'SP',
          ordem: 1,
        },
        {
          nome: 'Bruno Deputado',
          tipo: 'DEPUTADO',
          codigo_parlamentar: null,
          sigla_partido: 'PMO',
          uf: 'BA',
          ordem: 2,
        },
      ])},
      ${JSON.stringify([
        {
          sigla: 'PRONTPLEN',
          descricao: 'PRONTA PARA A PAUTA NO PLENÁRIO',
          inicio: '2026-04-01',
          fim: '2026-10-20',
          colegiado: null,
        },
        {
          sigla: 'AGDREL',
          descricao: 'AGUARDANDO DESIGNAÇÃO DO RELATOR',
          inicio: '2026-10-20',
          fim: null,
          colegiado: 'CCJ',
        },
      ])},
      null, null, ${origem(lote, 'https://senado/processo/900401')})`);
}

const loteIngerido = (id: string, fonte: string, tabela: string): EnvelopeDeEvento => ({
  id,
  tipo: 'LoteIngerido',
  versao: 1,
  ocorridoEm: '2026-10-30T09:00:00.000Z',
  idDoAgregado: `${fonte}.${tabela}`,
  idDeCorrelacao: `ingestao-${id}`,
  dados: {
    fonte,
    tabela,
    versaoDoContrato: '1.0.0',
    coletadoDe: '2026-10-27T09:00:00Z',
    coletadoAte: '2026-10-30T09:00:00Z',
    registros: 2,
  },
});

describe('importação das proposições (prata → Atividade Legislativa)', () => {
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
    for (const [fonte, codigo, nome, cargo] of [
      ['camara', '900001', 'Ana Exemplo', 'deputado_federal'],
      ['senado', '900101', 'Ana Senadora', 'senador'],
    ] as const) {
      const sincronizada = await agentesPublicos.sincronizar.execute({
        identificador: { fonte, codigo },
        nome,
        siglaPartido: 'PEX',
        urlDaFoto: null,
        mandatos: [
          {
            cargo,
            circunscricao: '35',
            inicio: new Date('2023-02-01T03:00:00.000Z'),
            fim: new Date('2027-02-01T02:59:59.999Z'),
          },
        ],
        origem: {
          fonte,
          url: `https://${fonte}/parlamentar`,
          coletadaEm: AGORA,
          sha256: createHash('sha256').update(codigo).digest('hex'),
          caminho: 'bronze/x',
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

  it('Câmara: autoria ligada às pessoas conhecidas e tramitação em ordem cronológica', async () => {
    const LOTE = '0192d5e0-7777-7000-8000-0000000000c1';
    await camara(ingestao, LOTE, false);

    await barramento.publicar(loteIngerido(LOTE, 'camara', 'camara_proposicao'));

    expect(resumos.at(-1)).toMatchObject({
      importacao: 'proposicoes_da_camara',
      lidos: 2,
      novos: 1,
    });
    expect(resumos.at(-1)?.falhas.map((f) => [f.codigoNaFonte, f.erro])).toEqual([
      ['900302', 'proposicao.dados_incompletos'],
    ]);
    const [pl] = await banco.drizzle.select().from(proposicao);
    expect(pl?.autores.map((a) => [a.nomeNaFonte, a.pessoaId])).toEqual([
      ['Ana Exemplo', pessoas.get('900001')],
      ['Ex Deputado', null],
      ['Comissão de Exemplo', null],
    ]);
    expect(pl?.tramitacoes.map((t) => t.despacho)).toEqual([
      'Recebido.',
      'Segundo despacho.',
      'Apresentado.',
    ]);
  });

  it('Câmara: um ato novo num lote seguinte vira TramitacaoAvancou', async () => {
    const LOTE = '0192d5e0-7777-7000-8000-0000000000c2';
    await banco.drizzle.execute(sql`TRUNCATE atividade_legislativa.outbox`);
    await camara(ingestao, LOTE, true);

    await barramento.publicar(loteIngerido(LOTE, 'camara', 'camara_proposicao'));

    const eventos = await banco.drizzle.select().from(outbox);
    expect(eventos.map((e) => [e.tipo, e.dados['novasTramitacoes']])).toEqual([
      ['TramitacaoAvancou', 1],
    ]);
  });

  it('Senado: a situação de cada momento vira a tramitação; só o senador vira pessoa', async () => {
    const LOTE = '0192d5e0-7777-7000-8000-0000000000c3';
    await senado(ingestao, LOTE);

    await barramento.publicar(loteIngerido(LOTE, 'senado', 'senado_processo'));

    expect(resumos.at(-1)).toMatchObject({ importacao: 'proposicoes_do_senado', novos: 1 });
    const [pl] = await banco.drizzle
      .select()
      .from(proposicao)
      .where(sql`casa = 'senado_federal'`);
    expect(pl?.autores.map((a) => [a.nomeNaFonte, a.pessoaId])).toEqual([
      ['Ana Senadora', pessoas.get('900101')],
      ['Bruno Deputado', null],
    ]);
    expect(pl?.tramitacoes.map((t) => [t.em, t.orgao, t.descricao])).toEqual([
      ['2026-04-01T03:00:00.000Z', null, 'PRONTA PARA A PAUTA NO PLENÁRIO'],
      ['2026-10-20T03:00:00.000Z', 'CCJ', 'AGUARDANDO DESIGNAÇÃO DO RELATOR'],
    ]);
    expect(pl?.situacao).toEqual({
      descricao: 'AGUARDANDO DESIGNAÇÃO DO RELATOR',
      desde: '2026-10-20T03:00:00.000Z',
      orgao: 'CCJ',
    });
  });
});
