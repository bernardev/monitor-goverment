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
const UBS = '0192d5e0-7777-7000-8000-000000000001';
const PONTE = '0192d5e0-7777-7000-8000-000000000002';
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

function obra(idNaFonte: string, mudancas: Record<string, unknown> = {}) {
  return {
    idNaFonte,
    nome: `OBRA ${idNaFonte}`,
    descricao: null,
    natureza: 'Obra',
    especie: 'Construção',
    situacao: 'em_execucao',
    situacaoNaFonte: 'Em execução',
    uf: 'RS',
    municipios: [{ codigoIbge: '4320008', nome: 'Sapucaia do Sul' }],
    pontos: [{ latitude: '-29.84', longitude: '-51.13' }],
    endereco: null,
    inicioPrevisto: '2026-01-10',
    fimPrevisto: '2027-06-30',
    inicioEfetivo: '2026-03-01',
    fimEfetivo: null,
    investimentoPrevistoCentavos: '20000000',
    executores: [{ nome: 'PREFEITURA', cnpj: '11413810000196' }],
    medicao: { percentualCentesimos: 2335, em: '2026-10-21' },
    interrupcoes: [],
    emendas: [
      {
        codigoDaEmenda: '202690010001',
        ugEmitente: '257001',
        numeroDoEmpenho: '2026NE000123',
        acaoOrcamentaria: '2172',
        empenhadoCentavos: '48110437',
        emitidoEm: '2026-03-02',
      },
    ],
    capturaId: CAPTURA,
    ...mudancas,
  };
}

describe('projeção de obras', () => {
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
      evento('EmendaRegistrada', DA_ANA, '2026-10-30T09:00:00.000Z', {
        codigoNaFonte: '202690010001',
        ano: 2026,
        tipo: 'individual',
        numero: '0001',
        autor: { pessoaId: ANA, nomeNaFonte: 'ANA EXEMPLO', codigoNaFonte: '9001' },
        destinacoes: [
          {
            localidade: 'SAPUCAIA DO SUL - RS',
            municipioIbge: '4320008',
            ufIbge: '4300000',
            funcao: classificacao('10'),
            subfuncao: classificacao('301'),
            programa: classificacao('5119'),
            acao: classificacao('2172'),
            planoOrcamentario: classificacao('0000'),
            modalidade: 'finalidade_definida',
            empenhadoCentavos: '48110437',
            liquidadoCentavos: '0',
            pagoCentavos: '0',
            restosInscritosCentavos: '0',
            restosCanceladosCentavos: '0',
            restosPagosCentavos: '0',
          },
        ],
        capturaId: CAPTURA,
      }),
      evento('ObraRegistrada', UBS, '2026-10-31T09:00:00.000Z', obra('151020.43-16')),
      evento(
        'ObraRegistrada',
        PONTE,
        '2026-10-31T09:00:00.000Z',
        obra('72343.33-91', {
          uf: 'SP',
          situacao: 'planejada',
          medicao: null,
          investimentoPrevistoCentavos: '90000000',
          emendas: [
            {
              codigoDaEmenda: '202571060003',
              ugEmitente: '257001',
              numeroDoEmpenho: '2025NE000001',
              acaoOrcamentaria: null,
              empenhadoCentavos: '5000',
              emitidoEm: null,
            },
          ],
        }),
      ),
    );
  });

  afterAll(async () => {
    await banco.fechar();
    await postgres.parar();
  });

  it('lista da obra de maior investimento para a de menor, e filtra por UF e situação', async () => {
    const todas = await consulta.obras.listar({ pagina: 1, itensPorPagina: 10 });
    expect(todas.total).toBe(2);
    expect(todas.itens.map((o) => o.idNaFonte)).toEqual(['72343.33-91', '151020.43-16']);
    expect(todas.itens[1]).toMatchObject({
      obraId: UBS,
      situacao: 'em_execucao',
      medicao: { percentualCentesimos: 2335 },
      municipios: [{ codigoIbge: '4320008' }],
      investimentoPrevistoCentavos: '20000000',
    });

    const codigos = async (filtro: Record<string, unknown>) =>
      (await consulta.obras.listar({ pagina: 1, itensPorPagina: 10, ...filtro })).itens.map(
        (o) => o.idNaFonte,
      );
    expect(await codigos({ uf: 'rs' })).toEqual(['151020.43-16']);
    expect(await codigos({ situacao: 'planejada' })).toEqual(['72343.33-91']);
    expect(await codigos({ uf: 'XX' })).toEqual([]);
  });

  it('detalha a obra com a emenda coletada e o autor dela', async () => {
    const detalhe = await consulta.obras.buscar(UBS.toUpperCase());

    expect(detalhe?.emendas).toEqual([
      {
        codigoDaEmenda: '202690010001',
        emendaId: DA_ANA,
        autor: { pessoaId: ANA, nome: 'ANA EXEMPLO' },
        numeroDoEmpenho: '2026NE000123',
        acaoOrcamentaria: '2172',
        empenhadoCentavos: '48110437',
        emitidoEm: '2026-03-02',
      },
    ]);
    const ponte = await consulta.obras.buscar(PONTE);
    expect(ponte?.emendas[0]).toMatchObject({ emendaId: null, autor: null });
    expect(await consulta.obras.buscar('nao-e-uuid')).toBeUndefined();
  });

  it('a emenda traz as obras que paga', async () => {
    const emenda = await consulta.emendas.buscar(DA_ANA);

    expect(emenda?.obras.map((o) => o.obraId)).toEqual([UBS]);
  });

  it('busca obras pelo nome, sem acento nem maiúsculas, e pelo município', async () => {
    const nomes = async (filtro: Record<string, unknown>) =>
      (await consulta.obras.listar({ pagina: 1, itensPorPagina: 10, ...filtro })).itens.map(
        (o) => o.idNaFonte,
      );

    expect(await nomes({ nome: 'obra 151020' })).toEqual(['151020.43-16']);
    expect(await nomes({ municipio: '4320008' })).toEqual(['72343.33-91', '151020.43-16']);
    expect(await nomes({ municipio: '3550308' })).toEqual([]);
  });

  it('o município vem da emenda e da obra, com o nome escrito pela obra', async () => {
    expect(await consulta.municipios.buscar('SAPUCAIA')).toEqual([
      { codigoIbge: '4320008', nome: 'Sapucaia do Sul', uf: 'RS' },
    ]);
    expect(await consulta.municipios.porCodigo('4320008')).toMatchObject({ uf: 'RS' });
    expect(await consulta.municipios.buscar('s')).toEqual([]);
    const daCidade = await consulta.emendas.listar({
      pagina: 1,
      itensPorPagina: 10,
      municipio: '4320008',
    });
    expect(daCidade.itens.map((e) => e.emendaId)).toEqual([DA_ANA]);
  });

  it('os fatos da autora candidatos a vínculo, do mais relevante para a promessa ao menos', async () => {
    const candidatos = await consulta.candidatos.doAutor(ANA, 'Obras de saúde em Sapucaia do Sul');

    expect(candidatos).toEqual([
      {
        tipoDoAlvo: 'obra',
        idDoAlvo: UBS,
        titulo: 'OBRA 151020.43-16',
        detalhe: 'Construção · Sapucaia do Sul · RS',
        estagios: ['execucao', 'entrega'],
        relevancia: 0.67,
        termosEmComum: ['obras', 'sapucaia'],
        capturaId: CAPTURA,
      },
      {
        tipoDoAlvo: 'emenda',
        idDoAlvo: DA_ANA,
        titulo: 'Emenda 0001/2026',
        detalhe: 'Item 2172 · Item 5119 · SAPUCAIA DO SUL - RS',
        estagios: ['orcamento', 'execucao'],
        relevancia: 0.33,
        termosEmComum: ['sapucaia'],
        capturaId: CAPTURA,
      },
    ]);
    // A obra da ponte é paga por emenda de outra pessoa: não entra.
    expect(await consulta.candidatos.doAutor(PONTE, 'qualquer')).toEqual([]);
  });

  it('a obra mais nova vale; um evento atrasado não a desfaz', async () => {
    const paralisada = obra('151020.43-16', {
      situacao: 'paralisada',
      situacaoNaFonte: 'Paralisada',
      interrupcoes: [
        { tipo: 'paralisada', em: '2025-01-10', justificativa: 'Chuvas.' },
        { tipo: 'paralisada', em: '2026-09-21', justificativa: null },
      ],
    });

    await publicar(
      evento('ObraAtualizada', UBS, '2026-11-01T09:00:00.000Z', paralisada),
      evento('ObraAtualizada', UBS, '2026-10-31T12:00:00.000Z', obra('151020.43-16')),
    );

    const detalhe = await consulta.obras.buscar(UBS);
    expect(detalhe?.situacao).toBe('paralisada');
    // Da interrupção mais recente para a mais antiga.
    expect(detalhe?.interrupcoes.map((i) => i.em)).toEqual(['2026-09-21', '2025-01-10']);
  });
});
