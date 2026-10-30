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
import { votacaoNominal } from './esquema.js';

const LOTE = '0192d5e0-6666-7000-8000-0000000000a1';

// Tabela prata como a plataforma de dados a cria (data-platform/migracoes, contrato v1.0.0).
const PRATA = sql.raw(`
  CREATE TABLE ingestao.senado_votacao (
    codigo_sessao_votacao integer PRIMARY KEY, codigo_sessao integer NOT NULL, data date NOT NULL,
    descricao text NOT NULL, identificacao text, codigo_materia integer, sigla_materia text,
    numero_materia text, ano_materia integer, ementa text, aprovada boolean,
    secreta boolean NOT NULL, votos jsonb NOT NULL,
    lote_id uuid NOT NULL, origem_fonte text NOT NULL, origem_url text NOT NULL,
    origem_coletada_em timestamptz NOT NULL, origem_sha256 char(64) NOT NULL,
    origem_caminho text NOT NULL, origem_tipo_de_conteudo text NOT NULL
  );
`);

const senador = (codigo: number, sigla: string, descricao: string | null = null) => ({
  codigo_parlamentar: codigo,
  sigla_voto: sigla,
  descricao_voto: descricao,
  sigla_partido: 'PEX',
  sigla_uf: 'SP',
});

/**
 * Ana votou Sim, Bruno estava de licença saúde e Carla presidia. Dora saiu do exercício na véspera,
 * de licença, e o Senado ainda a lista enquanto o suplente não toma posse. Na segunda votação aparece
 * uma sigla que ninguém traduziu; na terceira, um senador que Agentes Públicos não conhece.
 */
const VOTACOES: readonly [number, unknown[]][] = [
  [
    9101,
    [
      senador(900101, 'Sim'),
      senador(900102, 'LS', 'Licença saúde'),
      senador(900103, 'Presidente (art. 51 RISF)'),
      senador(900104, 'LS', 'Licença saúde'),
    ],
  ],
  [9102, [senador(900101, 'Sim'), senador(900102, 'XYZ')]],
  [9103, [senador(900101, 'Não'), senador(900199, 'Sim')]],
];

const loteIngerido = (): EnvelopeDeEvento => ({
  id: LOTE,
  tipo: 'LoteIngerido',
  versao: 1,
  ocorridoEm: '2026-10-30T09:00:00.000Z',
  idDoAgregado: 'senado.senado_votacao',
  idDeCorrelacao: `ingestao-${LOTE}`,
  dados: {
    fonte: 'senado',
    tabela: 'senado_votacao',
    versaoDoContrato: '1.0.0',
    coletadoDe: '2026-09-30T09:00:00Z',
    coletadoAte: '2026-10-30T09:00:00Z',
    registros: VOTACOES.length,
  },
});

describe('importação das votações do Senado (prata → Atividade Legislativa)', () => {
  let postgres: PostgresDeTeste;
  let bancos: BancoDoContexto[];
  let banco: BancoDoContexto;
  const barramento = new BarramentoEmMemoria();
  const resumos: ResumoDaImportacao[] = [];

  beforeAll(async () => {
    postgres = await iniciarPostgresDeTeste();
    const conectar = (schema: string) =>
      BancoDoContexto.conectar(schema, postgres.urlDoContexto(schema));
    const acervo = conectar(SCHEMA_DO_ACERVO);
    const agentes = conectar(SCHEMA_DE_AGENTES_PUBLICOS);
    banco = conectar(SCHEMA_DE_ATIVIDADE_LEGISLATIVA);
    const ingestao = conectar('ingestao');
    bancos = [acervo, agentes, banco, ingestao];
    await migrar(acervo, MIGRACOES_DO_ACERVO);
    await migrar(agentes, MIGRACOES_DE_AGENTES_PUBLICOS);
    await migrar(banco, MIGRACOES_DE_ATIVIDADE_LEGISLATIVA);
    await ingestao.drizzle.execute(PRATA);
    for (const [codigo, votos] of VOTACOES) {
      await ingestao.drizzle.execute(sql`
        INSERT INTO ingestao.senado_votacao VALUES (
          ${codigo}, 900001, '2026-10-14', ${`Votação nominal ${String(codigo)}.`}, 'PLP 901/2026',
          9000001, 'PLP', '901', 2026, 'Tema fictício.', true, false, ${JSON.stringify(votos)},
          ${LOTE}, 'senado', 'https://senado/votacao', '2026-10-30T09:00:00Z', ${'e'.repeat(64)},
          'bronze/senado/v', 'application/json'
        )`);
    }

    const relogio = { agora: () => AGORA };
    const registrarCaptura = montarAcervo(acervo, relogio).registrarCaptura;
    const agentesPublicos = montarAgentesPublicos({ banco: agentes, registrarCaptura, relogio });
    for (const [codigo, nome, fim] of [
      ['900101', 'Ana Senadora', '2031-02-01T02:59:59.999Z'],
      ['900102', 'Bruno Senador', '2031-02-01T02:59:59.999Z'],
      ['900103', 'Carla Presidente', '2031-02-01T02:59:59.999Z'],
      ['900104', 'Dora Licenciada', '2026-10-14T02:59:59.999Z'],
    ] as const) {
      const sincronizada = await agentesPublicos.sincronizar.execute({
        identificador: { fonte: 'senado', codigo },
        nome,
        siglaPartido: 'PEX',
        urlDaFoto: null,
        mandatos: [
          {
            cargo: 'senador',
            circunscricao: '35',
            inicio: new Date('2023-02-01T03:00:00.000Z'),
            fim: new Date(fim),
          },
        ],
        origem: {
          fonte: 'senado',
          url: 'https://senado/senador',
          coletadaEm: AGORA,
          sha256: 'f'.repeat(64),
          caminho: 'bronze/senado/s',
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
    await barramento.publicar(loteIngerido());
  });

  afterAll(async () => {
    await Promise.all(bancos.map((b) => b.fechar()));
    await postgres.parar();
  });

  it('registra a votação com quem votou e quem não votou, e devolve o que recusou', async () => {
    expect(resumos.at(-1)).toMatchObject({
      loteId: LOTE,
      importacao: 'votacoes_do_senado',
      lidos: 3,
      novos: 1,
    });
    expect(resumos.at(-1)?.falhas.map((f) => [f.codigoNaFonte, f.erro])).toEqual([
      ['9102', 'votacao.grafia_desconhecida'],
      ['9103', 'votacao.sem_mandato'],
    ]);

    const [votacao] = await banco.drizzle.select().from(votacaoNominal);
    expect(votacao).toMatchObject({
      casa: 'senado_federal',
      codigoNaFonte: '9101',
      registradaEm: null,
      relacaoCompleta: true,
    });
    expect(votacao?.votos.map((v) => [v.opcao, v.registroNaFonte, v.registradoEm]).sort()).toEqual([
      ['presidente_da_sessao', 'Presidente (art. 51 RISF)', null],
      ['sim', 'Sim', null],
    ]);
    expect(votacao?.semVoto.map((s) => [s.situacao, s.motivoCategoria, s.motivoDescricao])).toEqual(
      [
        ['ausencia_justificada', 'licenca_saude', 'Licença saúde'],
        ['ausencia_justificada', 'licenca_saude', 'Licença saúde'],
      ],
    );
    // A mesma resposta traz a votação e os votos.
    expect(votacao?.capturaId).toEqual(votacao?.capturaDosVotosId);
  });
});
