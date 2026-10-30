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
import { RelogioFixo } from '../testes/fakes.js';
import { mandato, outbox, pessoa } from './esquema.js';

const LOTE_1 = '0192d5e0-3333-7000-8000-000000000001';
const LOTE_2 = '0192d5e0-3333-7000-8000-000000000002';

// Tabelas prata como a plataforma de dados as cria (data-platform/migracoes, contrato v1.0.0).
const PRATA = sql.raw(`
  CREATE TABLE ingestao.camara_legislatura (
    id_legislatura integer PRIMARY KEY, data_inicio date NOT NULL, data_fim date NOT NULL,
    lote_id uuid NOT NULL, origem_fonte text NOT NULL, origem_url text NOT NULL,
    origem_coletada_em timestamptz NOT NULL, origem_sha256 char(64) NOT NULL,
    origem_caminho text NOT NULL, origem_tipo_de_conteudo text NOT NULL
  );
  CREATE TABLE ingestao.camara_deputado (
    id_deputado integer NOT NULL, id_legislatura integer NOT NULL, nome text NOT NULL,
    sigla_partido text NOT NULL, sigla_uf char(2) NOT NULL, url_foto text, email text,
    lote_id uuid NOT NULL, origem_fonte text NOT NULL, origem_url text NOT NULL,
    origem_coletada_em timestamptz NOT NULL, origem_sha256 char(64) NOT NULL,
    origem_caminho text NOT NULL, origem_tipo_de_conteudo text NOT NULL,
    PRIMARY KEY (id_deputado, id_legislatura)
  );
`);

const LEGISLATURA_57 = sql`
  INSERT INTO ingestao.camara_legislatura VALUES
    (57, '2023-02-01', '2027-01-31', ${LOTE_1}, 'camara', 'https://camara/legislaturas/57',
     '2026-10-30T09:00:00Z', ${'1'.repeat(64)}, 'bronze/camara/l', 'application/json');
`;

function deputados(lote: string, sha256: string, partidoDaAna: string) {
  const origem = sql`${lote}, 'camara', 'https://camara/deputados', '2026-10-30T09:00:00Z', ${sha256}, 'bronze/camara/d', 'application/json'`;
  return sql`
    INSERT INTO ingestao.camara_deputado VALUES
      (900001, 57, 'Ana Exemplo', ${partidoDaAna}, 'SP', null, null, ${origem}),
      (900002, 57, 'Bruno Modelo', 'PMO', 'BA', 'https://camara.leg.br/900002.jpg', null, ${origem}),
      (900003, 57, 'Uf Inexistente', 'PEX', 'XX', null, null, ${origem})
    ON CONFLICT (id_deputado, id_legislatura) DO UPDATE SET
      sigla_partido = EXCLUDED.sigla_partido, lote_id = EXCLUDED.lote_id,
      origem_sha256 = EXCLUDED.origem_sha256
  `;
}

const loteIngerido = (id: string, tabela = 'camara_deputado'): EnvelopeDeEvento => ({
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
    coletadoDe: '2026-10-30T09:00:00Z',
    coletadoAte: '2026-10-30T09:00:00Z',
    registros: 3,
  },
});

describe('importação de deputados da Câmara (prata → Agentes Públicos)', () => {
  let postgres: PostgresDeTeste;
  let bancoDoAcervo: BancoDoContexto;
  let banco: BancoDoContexto;
  let ingestao: BancoDoContexto;
  const barramento = new BarramentoEmMemoria();
  const resumos: ResumoDaImportacao[] = [];
  let modulo: ModuloAgentesPublicos;

  beforeAll(async () => {
    postgres = await iniciarPostgresDeTeste();
    bancoDoAcervo = BancoDoContexto.conectar(
      SCHEMA_DO_ACERVO,
      postgres.urlDoContexto(SCHEMA_DO_ACERVO),
    );
    banco = BancoDoContexto.conectar(
      SCHEMA_DE_AGENTES_PUBLICOS,
      postgres.urlDoContexto(SCHEMA_DE_AGENTES_PUBLICOS),
    );
    ingestao = BancoDoContexto.conectar('ingestao', postgres.urlDoContexto('ingestao'));
    await migrar(bancoDoAcervo, MIGRACOES_DO_ACERVO);
    await migrar(banco, MIGRACOES_DE_AGENTES_PUBLICOS);
    await ingestao.drizzle.execute(PRATA);
    await ingestao.drizzle.execute(LEGISLATURA_57);

    const relogio = new RelogioFixo(AGORA);
    modulo = montarAgentesPublicos({
      banco,
      registrarCaptura: montarAcervo(bancoDoAcervo, relogio).registrarCaptura,
      relogio,
    });
    await modulo.assinarConsumidores(barramento, (resumo) => resumos.push(resumo));
  });

  afterAll(async () => {
    await Promise.all([bancoDoAcervo.fechar(), banco.fechar(), ingestao.fechar()]);
    await postgres.parar();
  });

  it('importa o lote: pessoas, mandatos, capturas e eventos na outbox', async () => {
    await ingestao.drizzle.execute(deputados(LOTE_1, 'a'.repeat(64), 'PEX'));

    await barramento.publicar(loteIngerido(LOTE_1));

    expect(resumos.at(-1)).toMatchObject({ loteId: LOTE_1, lidos: 3, pessoasNovas: 2 });
    expect(resumos.at(-1)?.falhas).toEqual([
      expect.objectContaining({ codigoNaFonte: '900003', erro: 'codigo_ibge.uf_invalida' }),
    ]);

    const pessoas = await banco.drizzle.select().from(pessoa).orderBy(pessoa.nome);
    expect(pessoas.map((p) => [p.nome, p.siglaPartido])).toEqual([
      ['Ana Exemplo', 'PEX'],
      ['Bruno Modelo', 'PMO'],
    ]);
    const mandatos = await banco.drizzle.select().from(mandato).orderBy(mandato.circunscricao);
    expect(mandatos.map((m) => [m.cargo, m.circunscricao, m.inicio.toISOString()])).toEqual([
      ['deputado_federal', '29', '2023-02-01T03:00:00.000Z'],
      ['deputado_federal', '35', '2023-02-01T03:00:00.000Z'],
    ]);

    const eventos = await banco.drizzle.select().from(outbox);
    expect(eventos.map((e) => e.tipo).sort()).toEqual([
      'MandatoRegistrado',
      'MandatoRegistrado',
      'PessoaRegistrada',
      'PessoaRegistrada',
    ]);
    expect(new Set(eventos.map((e) => e.idDeCorrelacao))).toEqual(new Set([`ingestao-${LOTE_1}`]));

    const capturas = await bancoDoAcervo.drizzle.execute(
      sql`SELECT count(*)::int AS n FROM acervo.captura`,
    );
    expect(capturas.rows).toEqual([{ n: 1 }]);
  });

  it('outros contextos consultam o mandato importado pelo id', async () => {
    const [registrado] = await banco.drizzle
      .select()
      .from(mandato)
      .where(sql`circunscricao = '35'`);
    if (!registrado) throw new Error('Mandato não importado.');

    expect(await modulo.mandatos.buscar(registrado.id)).toMatchObject({
      cargo: 'deputado_federal',
      circunscricao: '35',
      fim: new Date('2027-02-01T02:59:59.999Z'),
    });
    expect(await modulo.mandatos.buscar('0192d5e0-9999-7000-8000-000000000000')).toBeUndefined();
    expect(await modulo.mandatos.buscar('nao-e-uuid')).toBeUndefined();
  });

  it('o mesmo evento entregue de novo não produz efeito', async () => {
    const antes = await banco.drizzle.select().from(outbox);

    await barramento.publicar(loteIngerido(LOTE_1));

    expect(await banco.drizzle.select().from(outbox)).toHaveLength(antes.length);
  });

  it('um lote novo registra só a troca de partido, com a nova captura', async () => {
    await banco.drizzle.execute(sql`TRUNCATE agentes_publicos.outbox`);
    await ingestao.drizzle.execute(deputados(LOTE_2, 'b'.repeat(64), 'S.PART.'));

    await barramento.publicar(loteIngerido(LOTE_2));

    const eventos = await banco.drizzle.select().from(outbox);
    expect(eventos.map((e) => [e.tipo, e.dados['de'], e.dados['para']])).toEqual([
      ['FiliacaoPartidariaAlterada', 'PEX', null],
    ]);
    expect(resumos.at(-1)).toMatchObject({ loteId: LOTE_2, pessoasNovas: 0 });
  });

  it('ignora lotes de outras tabelas', async () => {
    const quantos = resumos.length;

    await barramento.publicar(
      loteIngerido('0192d5e0-3333-7000-8000-000000000009', 'camara_legislatura'),
    );

    expect(resumos).toHaveLength(quantos);
  });
});
