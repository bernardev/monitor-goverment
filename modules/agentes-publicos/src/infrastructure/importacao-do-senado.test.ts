import { MIGRACOES_DO_ACERVO, montarAcervo, SCHEMA_DO_ACERVO } from '@prometeu/acervo';
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
  MIGRACOES_DE_AGENTES_PUBLICOS,
  type ModuloAgentesPublicos,
  montarAgentesPublicos,
  type ResumoDaImportacao,
  SCHEMA_DE_AGENTES_PUBLICOS,
} from '../index.js';
import { AGORA } from '../testes/construtores.js';
import { identificadorExterno, mandato } from './esquema.js';

const LOTE = '0192d5e0-3333-7000-8000-0000000000a1';

// Tabelas prata como a plataforma de dados as cria (data-platform/migracoes, contratos v1.0.0).
const ORIGEM_DDL = `lote_id uuid NOT NULL, origem_fonte text NOT NULL, origem_url text NOT NULL,
  origem_coletada_em timestamptz NOT NULL, origem_sha256 char(64) NOT NULL,
  origem_caminho text NOT NULL, origem_tipo_de_conteudo text NOT NULL`;
const PRATA = sql.raw(`
  CREATE TABLE ingestao.senado_senador (
    codigo integer PRIMARY KEY, nome text NOT NULL, sigla_partido text, url_foto text, ${ORIGEM_DDL}
  );
  CREATE TABLE ingestao.senado_exercicios (
    codigo integer PRIMARY KEY, exercicios jsonb NOT NULL, ${ORIGEM_DDL}
  );
`);

const exercicio = (uf: string, inicio: string, fim: string | null, codigo: number) => ({
  codigo_exercicio: codigo,
  uf,
  inicio,
  fim,
  fim_do_mandato: '2031-01-31',
  causa_do_afastamento: fim === null ? null : 'RET',
});

/**
 * Ana é titular desde 2023. Bruno foi senador pelo RJ e, depois, suplente por MG em dois períodos.
 * Carla deixou o cargo e voltou no mesmo dia (o titular renunciou): é um período só. Dora vem com UF
 * que não existe.
 */
const SENADORES: readonly [number, string, string | null, unknown[]][] = [
  [900101, 'Ana Senadora', 'PEX', [exercicio('SP', '2023-02-01', null, 1)]],
  [
    900102,
    'Bruno Suplente',
    null,
    [
      exercicio('RJ', '2015-02-01', '2019-01-31', 2),
      exercicio('MG', '2024-03-01', '2024-07-01', 3),
      exercicio('MG', '2025-01-10', null, 4),
    ],
  ],
  [
    900103,
    'Carla Continua',
    'PMO',
    [exercicio('PE', '2022-12-07', '2023-09-04', 5), exercicio('PE', '2023-09-04', null, 6)],
  ],
  [900104, 'Dora Uf Errada', 'PEX', [exercicio('XX', '2023-02-01', null, 7)]],
];

const loteIngerido = (tabela = 'senado_senador'): EnvelopeDeEvento => ({
  id: LOTE,
  tipo: 'LoteIngerido',
  versao: 1,
  ocorridoEm: '2026-10-30T09:00:00.000Z',
  idDoAgregado: `senado.${tabela}`,
  idDeCorrelacao: `ingestao-${LOTE}`,
  dados: {
    fonte: 'senado',
    tabela,
    versaoDoContrato: '1.0.0',
    coletadoDe: '2026-10-30T09:00:00Z',
    coletadoAte: '2026-10-30T09:00:00Z',
    registros: SENADORES.length,
  },
});

describe('importação de senadores do Senado (prata → Agentes Públicos)', () => {
  let postgres: PostgresDeTeste;
  let bancos: BancoDoContexto[];
  let banco: BancoDoContexto;
  const barramento = new BarramentoEmMemoria();
  const resumos: ResumoDaImportacao[] = [];
  let modulo: ModuloAgentesPublicos;

  beforeAll(async () => {
    postgres = await iniciarPostgresDeTeste();
    const conectar = (schema: string) =>
      BancoDoContexto.conectar(schema, postgres.urlDoContexto(schema));
    const acervo = conectar(SCHEMA_DO_ACERVO);
    banco = conectar(SCHEMA_DE_AGENTES_PUBLICOS);
    const ingestao = conectar('ingestao');
    bancos = [acervo, banco, ingestao];
    await migrar(acervo, MIGRACOES_DO_ACERVO);
    await migrar(banco, MIGRACOES_DE_AGENTES_PUBLICOS);
    await ingestao.drizzle.execute(PRATA);
    for (const [codigo, nome, partido, exercicios] of SENADORES) {
      const origem = sql`${LOTE}, 'senado', ${`https://senado/senador/${String(codigo)}`},
        '2026-10-30T09:00:00Z', ${String(codigo).padStart(64, '0')}, 'bronze/senado/s',
        'application/json'`;
      await ingestao.drizzle.execute(
        sql`INSERT INTO ingestao.senado_senador VALUES (${codigo}, ${nome}, ${partido}, null, ${origem})`,
      );
      await ingestao.drizzle.execute(
        sql`INSERT INTO ingestao.senado_exercicios VALUES (${codigo}, ${JSON.stringify(exercicios)}, ${origem})`,
      );
    }

    const relogio = { agora: () => AGORA };
    modulo = montarAgentesPublicos({
      banco,
      registrarCaptura: montarAcervo(acervo, relogio).registrarCaptura,
      relogio,
    });
    await modulo.assinarConsumidores(barramento, (resumo) => resumos.push(resumo));
    await barramento.publicar(loteIngerido());
  });

  afterAll(async () => {
    await Promise.all(bancos.map((b) => b.fechar()));
    await postgres.parar();
  });

  it('cria as pessoas pelo código do Senado e devolve o que recusou', async () => {
    expect(resumos.at(-1)).toMatchObject({ loteId: LOTE, lidos: 4, pessoasNovas: 3 });
    expect(resumos.at(-1)?.falhas).toEqual([
      expect.objectContaining({ codigoNaFonte: '900104', erro: 'codigo_ibge.uf_invalida' }),
    ]);
    const codigos = await banco.drizzle
      .select()
      .from(identificadorExterno)
      .orderBy(identificadorExterno.codigo);
    expect(codigos.map((i) => `${i.fonte}:${i.codigo}`)).toEqual([
      'senado:900101',
      'senado:900102',
      'senado:900103',
    ]);
  });

  it('um mandato por exercício; o que se toca no mesmo dia vira um só', async () => {
    const mandatos = await banco.drizzle.select().from(mandato).orderBy(mandato.inicio);

    expect(
      mandatos.map((m) => [m.cargo, m.circunscricao, m.inicio.toISOString(), m.fim?.toISOString()]),
    ).toEqual([
      ['senador', '33', '2015-02-01T03:00:00.000Z', '2019-02-01T02:59:59.999Z'],
      ['senador', '26', '2022-12-07T03:00:00.000Z', '2031-02-01T02:59:59.999Z'],
      ['senador', '35', '2023-02-01T03:00:00.000Z', '2031-02-01T02:59:59.999Z'],
      ['senador', '31', '2024-03-01T03:00:00.000Z', '2024-07-02T02:59:59.999Z'],
      ['senador', '31', '2025-01-10T03:00:00.000Z', '2031-02-01T02:59:59.999Z'],
    ]);
  });

  it('outros contextos acham o senador em exercício pelo código do Senado', async () => {
    const bruno = { fonte: 'senado', codigo: '900102' } as const;

    expect(
      await modulo.mandatos.vigente(bruno, 'senador', new Date('2024-05-01T15:00:00Z')),
    ).toMatchObject({ circunscricao: '31' });
    expect(
      await modulo.mandatos.vigente(bruno, 'senador', new Date('2024-10-01T15:00:00Z')),
    ).toBeUndefined();
    expect(
      await modulo.mandatos.vigente(bruno, 'deputado_federal', new Date('2024-05-01T15:00:00Z')),
    ).toBeUndefined();
  });
});
