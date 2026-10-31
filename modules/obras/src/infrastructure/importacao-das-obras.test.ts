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
  MIGRACOES_DE_OBRAS,
  montarObras,
  type ResumoDaImportacao,
  SCHEMA_DE_OBRAS,
} from '../index.js';
import { obra, outbox } from './esquema.js';

const AGORA = new Date('2026-10-31T12:00:00.000Z');
const LOTE_1 = '0192d5e0-9999-7000-8000-0000000000a1';
const LOTE_2 = '0192d5e0-9999-7000-8000-0000000000a2';

// Tabelas prata como a plataforma de dados as cria (data-platform/migracoes, contrato v1.0.0).
const ORIGEM = `lote_id uuid NOT NULL, origem_fonte text NOT NULL, origem_url text NOT NULL,
  origem_coletada_em timestamptz NOT NULL, origem_sha256 char(64) NOT NULL,
  origem_caminho text NOT NULL, origem_tipo_de_conteudo text NOT NULL`;
const PRATA = sql.raw(`
  CREATE TABLE ingestao.obrasgov_empenho_de_emenda (
    id_projeto text NOT NULL, ug_emitente text NOT NULL, numero_empenho text NOT NULL,
    codigo_emenda text NOT NULL, acao_orcamentaria text, programa_trabalho text,
    plano_interno text, valor_empenhado_centavos bigint NOT NULL, pago_centavos bigint,
    emitido_em date, descricao text, ${ORIGEM},
    PRIMARY KEY (id_projeto, ug_emitente, numero_empenho, codigo_emenda)
  );
  CREATE TABLE ingestao.obrasgov_projeto (
    id_projeto text PRIMARY KEY, nome text NOT NULL, descricao text, natureza text, especie text,
    situacao text NOT NULL, uf char(2), cep text, endereco text, inicio_previsto date,
    fim_previsto date, inicio_efetivo date, fim_efetivo date, cadastrado_em date,
    organizacao_responsavel text, cnpj_organizacao_responsavel char(14),
    executores jsonb NOT NULL, tomadores jsonb NOT NULL, repassadores jsonb NOT NULL,
    investimentos_previstos jsonb NOT NULL, tipos jsonb NOT NULL, localizacoes jsonb NOT NULL,
    sistema_responsavel text, ${ORIGEM}
  );
  CREATE TABLE ingestao.obrasgov_execucao_fisica (
    id_execucao bigint PRIMARY KEY, id_projeto text NOT NULL, percentual_centesimos integer,
    inicio date, fim date, tipo_instrumento text, forma_execucao text, cadastrada_em date,
    atualizada_em date, motivos jsonb NOT NULL, ${ORIGEM}
  );
  CREATE TABLE ingestao.obrasgov_situacao (
    id_historico bigint PRIMARY KEY, id_projeto text NOT NULL, situacao text NOT NULL,
    em date NOT NULL, justificativa text, com_tratativas boolean, fase_das_tratativas text,
    ${ORIGEM}
  );
  CREATE TABLE ingestao.obrasgov_localizacao (
    id_geometria bigint NOT NULL, id_projeto text NOT NULL, uf char(2), municipio text,
    codigo_municipio_ibge char(7), origem text, ${ORIGEM},
    UNIQUE NULLS NOT DISTINCT (id_geometria, codigo_municipio_ibge)
  );
`);

const origem = (lote: string) => sql`
  ${lote}, 'obrasgov', 'https://api-publica.obrasgov.gestao.gov.br/obras/projeto-investimento',
  '2026-10-31T09:00:00Z', ${lote.replace(/-/g, '').padEnd(64, '0')}, 'bronze/obrasgov/p',
  'application/json'
`;

function projeto(lote: string, id: string, situacao: string) {
  return sql`(
    ${id}, ${`OBRA ${id}`}, NULL, 'Obra', 'Construção', ${situacao}, 'RS', NULL, NULL,
    '2026-01-10', '2027-06-30', NULL, NULL, '2026-02-17', NULL, NULL,
    '[{"nome": "PREFEITURA", "cnpj": "11413810000196"}]', '[]', '[]',
    '[{"fonte": "Federal", "valor_centavos": 20000000}, {"fonte": "Contrapartida", "valor_centavos": 10}]',
    '[]', '[{"latitude": "-29.84", "longitude": "-51.13"}]', 'Transferegov.br', ${origem(lote)}
  )`;
}

/**
 * A UBS é paga por duas emendas, tem duas medições e fica em dois municípios. A ponte só tem emenda
 * e paralisa no segundo lote. A obra de situação estranha é recusada sem impedir as outras.
 */
function linhas(lote: string, situacaoDaPonte: string) {
  return [
    sql`
    INSERT INTO ingestao.obrasgov_projeto VALUES
      ${projeto(lote, '151020.43-16', 'Em execução')},
      ${projeto(lote, '72343.33-91', situacaoDaPonte)},
      ${projeto(lote, '1.00-01', 'Inativada')}
    ON CONFLICT (id_projeto) DO UPDATE SET situacao = EXCLUDED.situacao,
      lote_id = EXCLUDED.lote_id, origem_sha256 = EXCLUDED.origem_sha256`,
    sql`
    INSERT INTO ingestao.obrasgov_empenho_de_emenda VALUES
      ('151020.43-16', '257001', '2026NE000123', '202690010001', '2172', NULL, NULL, 48110437,
        NULL, '2026-03-02', NULL, ${origem(lote)}),
      ('151020.43-16', '257001', '2026NE000124', '202690020002', NULL, NULL, NULL, 100,
        NULL, NULL, NULL, ${origem(lote)}),
      ('72343.33-91', '257001', '2025NE000001', '202571060003', NULL, NULL, NULL, 5000,
        NULL, NULL, NULL, ${origem(lote)}),
      ('1.00-01', '257001', '2025NE000002', '202571060003', NULL, NULL, NULL, 5000,
        NULL, NULL, NULL, ${origem(lote)})
    ON CONFLICT DO NOTHING`,
    sql`
    INSERT INTO ingestao.obrasgov_execucao_fisica VALUES
      (50, '151020.43-16', 1000, NULL, NULL, NULL, NULL, '2026-03-01', '2026-05-01', '[]',
        ${origem(lote)}),
      (51, '151020.43-16', 2335, NULL, NULL, NULL, NULL, '2026-03-01', '2026-10-21', '[]',
        ${origem(lote)}),
      (52, '151020.43-16', NULL, NULL, NULL, NULL, NULL, '2026-03-01', '2026-10-30', '[]',
        ${origem(lote)})
    ON CONFLICT DO NOTHING`,
    sql`
    INSERT INTO ingestao.obrasgov_localizacao VALUES
      (806557, '151020.43-16', 'RS', 'Sapucaia do Sul', '4320008', NULL, ${origem(lote)}),
      (806557, '151020.43-16', 'RS', 'Esteio', '4307708', NULL, ${origem(lote)}),
      (806558, '151020.43-16', NULL, NULL, NULL, NULL, ${origem(lote)})
    ON CONFLICT DO NOTHING
  `,
  ];
}

const PARALISACAO = sql`
  INSERT INTO ingestao.obrasgov_situacao VALUES
    (1188874, '72343.33-91', 'Paralisada', '2026-09-21', 'Solicitado pela empresa.', false, NULL,
      ${origem(LOTE_2)}),
    (3142681, '72343.33-91', 'Paralisada', '2026-09-21', 'Solicitado pela empresa.', false, NULL,
      ${origem(LOTE_2)})
`;

const loteIngerido = (id: string): EnvelopeDeEvento => ({
  id,
  tipo: 'LoteIngerido',
  versao: 1,
  ocorridoEm: '2026-10-31T09:00:00.000Z',
  idDoAgregado: 'obrasgov.obrasgov_projeto',
  idDeCorrelacao: `ingestao-${id}`,
  dados: {
    fonte: 'obrasgov',
    tabela: 'obrasgov_projeto',
    versaoDoContrato: '1.0.0',
    coletadoDe: '2026-10-31T09:00:00Z',
    coletadoAte: '2026-10-31T09:00:00Z',
    registros: 3,
  },
});

describe('importação das obras do Obrasgov.br (prata → Obras)', () => {
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
    banco = conectar(SCHEMA_DE_OBRAS);
    ingestao = conectar('ingestao');
    bancos = [acervo, banco, ingestao];
    await migrar(acervo, MIGRACOES_DO_ACERVO);
    await migrar(banco, MIGRACOES_DE_OBRAS);
    await ingestao.drizzle.execute(PRATA);

    const relogio = { agora: () => AGORA };
    const modulo = montarObras({
      banco,
      registrarCaptura: montarAcervo(acervo, relogio).registrarCaptura,
      relogio,
    });
    await modulo.assinarConsumidores(barramento, (resumo) => resumos.push(resumo));
  });

  afterAll(async () => {
    await Promise.all(bancos.map((b) => b.fechar()));
    await postgres.parar();
  });

  it('junta por obra as emendas, a medição mais recente e os municípios', async () => {
    for (const comando of linhas(LOTE_1, 'Cadastrada')) await ingestao.drizzle.execute(comando);

    await barramento.publicar(loteIngerido(LOTE_1));

    expect(resumos.at(-1)).toMatchObject({
      loteId: LOTE_1,
      lidos: 3,
      novos: 2,
      falhas: [{ codigoNaFonte: '1.00-01', erro: 'obra.situacao_desconhecida' }],
    });
    const obras = await banco.drizzle.select().from(obra).orderBy(obra.idNaFonte);
    expect(obras.map((o) => [o.idNaFonte, o.apuracao.situacao])).toEqual([
      ['151020.43-16', 'em_execucao'],
      ['72343.33-91', 'planejada'],
    ]);
    const ubs = obras[0]?.apuracao;
    expect(ubs?.medicao).toEqual({ percentualCentesimos: 2335, em: '2026-10-21' });
    expect(ubs?.investimentoPrevisto).toBe('20000010');
    expect(ubs?.municipios).toEqual([
      { codigoIbge: '4307708', nome: 'Esteio' },
      { codigoIbge: '4320008', nome: 'Sapucaia do Sul' },
    ]);
    expect(ubs?.emendas.map((e) => [e.codigoDaEmenda, e.empenhado])).toEqual([
      ['202690010001', '48110437'],
      ['202690020002', '100'],
    ]);
  });

  it('a paralisação no lote seguinte vira ObraAtualizada e ObraParalisada', async () => {
    await banco.drizzle.execute(sql`TRUNCATE obras.outbox`);
    for (const comando of linhas(LOTE_2, 'Paralisada')) await ingestao.drizzle.execute(comando);
    await ingestao.drizzle.execute(PARALISACAO);

    await barramento.publicar(loteIngerido(LOTE_2));

    expect(resumos.at(-1)).toMatchObject({ loteId: LOTE_2, novos: 0 });
    const eventos = await banco.drizzle.select().from(outbox);
    expect(eventos.map((e) => [e.tipo, e.dados['idNaFonte']])).toEqual([
      ['ObraAtualizada', '72343.33-91'],
      ['ObraParalisada', '72343.33-91'],
    ]);
    expect(eventos[1]?.dados).toMatchObject({ em: '2026-09-21', emendas: ['202571060003'] });
    // A fonte repete a mesma paralisação com outro identificador: fica uma só.
    expect(eventos[0]?.dados['interrupcoes']).toEqual([
      { tipo: 'paralisada', em: '2026-09-21', justificativa: 'Solicitado pela empresa.' },
    ]);
  });

  it('o mesmo lote entregue de novo não produz efeito', async () => {
    const quantos = resumos.length;

    await barramento.publicar(loteIngerido(LOTE_2));

    expect(resumos).toHaveLength(quantos);
  });
});
