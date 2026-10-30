import type { EnvelopeDeEvento } from '@prometeu/contracts';
import { BancoDoContexto, migrar } from '@prometeu/infraestrutura';
import {
  BarramentoEmMemoria,
  iniciarPostgresDeTeste,
  type PostgresDeTeste,
} from '@prometeu/infraestrutura/testes';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type ModuloConsulta,
  MIGRACOES_DA_CONSULTA,
  montarConsulta,
  SCHEMA_DA_CONSULTA,
} from '../index.js';

const ANA = '0192d5e0-4444-7000-8000-00000000000a';
const DA_ANA = '0192d5e0-6666-7000-8000-000000000001';
const DA_ANA_2024 = '0192d5e0-6666-7000-8000-000000000002';
const DA_BANCADA = '0192d5e0-6666-7000-8000-000000000003';
const CAPTURA = '0192d5e0-5555-7000-8000-000000000001';

let sequencia = 0;
function evento(
  tipo: string,
  idDoAgregado: string,
  ocorridoEm: string,
  dados: Record<string, unknown>,
): EnvelopeDeEvento {
  sequencia += 1;
  return {
    id: `0192d5e0-9999-7000-8000-${String(sequencia).padStart(12, '0')}`,
    tipo,
    versao: 1,
    ocorridoEm,
    idDoAgregado,
    idDeCorrelacao: 'teste',
    dados,
  };
}

const classificacao = (codigo: string) => ({ codigo, nome: `Item ${codigo}` });

function destinacao(localidade: string, ibge: [string | null, string | null], centavos: string[]) {
  const [empenhado, liquidado, pago, inscritos, cancelados, restosPagos] = centavos;
  return {
    localidade,
    municipioIbge: ibge[0],
    ufIbge: ibge[1],
    funcao: classificacao('10'),
    subfuncao: classificacao('302'),
    programa: classificacao('5118'),
    acao: classificacao('2E90'),
    planoOrcamentario: classificacao('0000'),
    empenhadoCentavos: empenhado,
    liquidadoCentavos: liquidado,
    pagoCentavos: pago,
    restosInscritosCentavos: inscritos,
    restosCanceladosCentavos: cancelados,
    restosPagosCentavos: restosPagos,
  };
}

const SAO_PAULO = destinacao(
  'SÃO PAULO - SP',
  ['3550308', '3500000'],
  ['100000000', '60000000', '50000000', '0', '0', '0'],
);
const CAMPINAS = destinacao(
  'CAMPINAS - SP',
  ['3509502', '3500000'],
  ['20000000', '0', '0', '0', '0', '0'],
);

function emenda(
  tipo: string,
  id: string,
  ocorridoEm: string,
  campos: { codigo: string; ano: number; tipoDeEmenda: string; autor: [string | null, string] },
  destinacoes: unknown[],
) {
  return evento(tipo, id, ocorridoEm, {
    codigoNaFonte: campos.codigo,
    ano: campos.ano,
    tipo: campos.tipoDeEmenda,
    numero: '0001',
    autor: { pessoaId: campos.autor[0], nomeNaFonte: campos.autor[1], codigoNaFonte: '9001' },
    destinacoes,
    capturaId: CAPTURA,
  });
}

const DA_ANA_2026 = { codigo: '202690010001', ano: 2026, tipoDeEmenda: 'individual' } as const;

describe('projeção de emendas', () => {
  let postgres: PostgresDeTeste;
  let banco: BancoDoContexto;
  let consulta: ModuloConsulta;
  const barramento = new BarramentoEmMemoria();
  const publicar = async (...envelopes: EnvelopeDeEvento[]) => {
    for (const envelope of envelopes) await barramento.publicar(envelope);
  };

  beforeAll(async () => {
    postgres = await iniciarPostgresDeTeste();
    banco = BancoDoContexto.conectar(
      SCHEMA_DA_CONSULTA,
      postgres.urlDoContexto(SCHEMA_DA_CONSULTA),
    );
    await migrar(banco, MIGRACOES_DA_CONSULTA);
    consulta = montarConsulta(banco);
    await consulta.assinarConsumidores(barramento);

    await publicar(
      evento('CapturaRegistrada', CAPTURA, '2026-10-30T09:00:00.000Z', {
        fonte: 'portal_transparencia',
        url: 'https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares/UNICO',
        coletadaEm: '2026-10-30T09:00:00.000Z',
        sha256: 'e'.repeat(64),
        caminho: 'bronze/portal/emendas',
        tipoDeConteudo: 'application/zip',
        tamanhoEmBytes: 1,
      }),
      emenda(
        'EmendaRegistrada',
        DA_ANA,
        '2026-10-30T09:00:00.000Z',
        { ...DA_ANA_2026, autor: [ANA, 'ANA EXEMPLO'] },
        [SAO_PAULO, CAMPINAS],
      ),
      emenda(
        'EmendaRegistrada',
        DA_ANA_2024,
        '2026-10-30T09:00:00.000Z',
        {
          codigo: '202490010007',
          ano: 2024,
          tipoDeEmenda: 'individual',
          autor: [ANA, 'ANA EXEMPLO'],
        },
        [
          destinacao(
            'Nacional',
            [null, null],
            ['5000000', '5000000', '1000000', '4000000', '-100', '3000000'],
          ),
        ],
      ),
      emenda(
        'EmendaRegistrada',
        DA_BANCADA,
        '2026-10-30T09:00:00.000Z',
        {
          codigo: '202671060003',
          ano: 2026,
          tipoDeEmenda: 'bancada',
          autor: [null, 'BANCADA DA BAHIA'],
        },
        [
          destinacao(
            'SALVADOR - BA',
            ['2927408', '2900000'],
            ['900000000', '0', '0', '0', '0', '0'],
          ),
        ],
      ),
    );
  });

  afterAll(async () => {
    await banco.fechar();
    await postgres.parar();
  });

  it('lista do orçamento mais recente, e no mesmo ano a de maior empenho, com a execução somada', async () => {
    const pagina = await consulta.emendas.listar({ pagina: 1, itensPorPagina: 10 });

    expect(pagina.total).toBe(3);
    expect(pagina.itens.map((e) => e.codigoNaFonte)).toEqual([
      '202671060003',
      '202690010001',
      '202490010007',
    ]);
    expect(pagina.itens[1]).toMatchObject({
      emendaId: DA_ANA,
      tipo: 'individual',
      autor: { pessoaId: ANA, nome: 'ANA EXEMPLO' },
      ufs: ['SP'],
      localidades: ['SÃO PAULO - SP', 'CAMPINAS - SP'],
      execucao: { empenhadoCentavos: '120000000', pagoCentavos: '50000000' },
      fonte: { capturaId: CAPTURA, coletadaEm: '2026-10-30T09:00:00.000Z' },
    });
  });

  it('filtra por ano, tipo e UF de destino', async () => {
    const codigos = async (filtro: Record<string, unknown>) =>
      (await consulta.emendas.listar({ pagina: 1, itensPorPagina: 10, ...filtro })).itens.map(
        (e) => e.codigoNaFonte,
      );

    expect(await codigos({ ano: 2024 })).toEqual(['202490010007']);
    expect(await codigos({ tipo: 'bancada' })).toEqual(['202671060003']);
    expect(await codigos({ uf: 'sp' })).toEqual(['202690010001']);
    expect(await codigos({ uf: 'XX' })).toEqual([]);
  });

  it('detalha as destinações com a UF e a classificação orçamentária', async () => {
    const detalhe = await consulta.emendas.buscar(DA_ANA.toUpperCase());

    expect(detalhe?.destinacoes).toMatchObject([
      {
        localidade: 'SÃO PAULO - SP',
        municipioIbge: '3550308',
        uf: 'SP',
        acao: { codigo: '2E90', nome: 'Item 2E90' },
        execucao: { liquidadoCentavos: '60000000' },
      },
      { localidade: 'CAMPINAS - SP' },
    ]);
    expect(await consulta.emendas.buscar('nao-e-uuid')).toBeUndefined();
  });

  it('as emendas do parlamentar vêm com a soma de todas, não só as da página', async () => {
    const daAna = await consulta.emendas.doParlamentar(ANA, { pagina: 1, itensPorPagina: 1 });

    expect(daAna.total).toBe(2);
    expect(daAna.itens.map((e) => e.codigoNaFonte)).toEqual(['202690010001']);
    expect(daAna.soma).toEqual({
      empenhadoCentavos: '125000000',
      liquidadoCentavos: '65000000',
      pagoCentavos: '51000000',
      restosInscritosCentavos: '4000000',
      restosCanceladosCentavos: '-100',
      restosPagosCentavos: '3000000',
    });
    const ninguem = await consulta.emendas.doParlamentar(DA_BANCADA, {
      pagina: 1,
      itensPorPagina: 10,
    });
    expect(ninguem).toMatchObject({ total: 0, soma: { pagoCentavos: '0' } });
  });

  it('a execução mais nova vale; um evento atrasado não a desfaz', async () => {
    const pago = (valor: string) => [
      { ...SAO_PAULO, pagoCentavos: valor, liquidadoCentavos: valor },
      CAMPINAS,
    ];
    const autor = { ...DA_ANA_2026, autor: [ANA, 'ANA EXEMPLO'] as [string, string] };

    await publicar(
      emenda(
        'ExecucaoDaEmendaAtualizada',
        DA_ANA,
        '2026-10-31T09:00:00.000Z',
        autor,
        pago('90000000'),
      ),
      emenda(
        'ExecucaoDaEmendaAtualizada',
        DA_ANA,
        '2026-10-30T12:00:00.000Z',
        autor,
        pago('70000000'),
      ),
    );

    const detalhe = await consulta.emendas.buscar(DA_ANA);
    expect(detalhe?.execucao.pagoCentavos).toBe('90000000');
  });
});
