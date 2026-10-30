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
const PL = '0192d5e0-8888-7000-8000-000000000001';
const MPV = '0192d5e0-8888-7000-8000-000000000002';
const VOTACAO = '0192d5e0-7777-7000-8000-000000000001';
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

const ato = (em: string, descricao: string) => ({
  em,
  orgao: 'CCJC',
  descricao,
  situacao: null,
  despacho: null,
});

const proposicao = (
  tipo: string,
  id: string,
  codigo: string,
  sigla: string,
  tramitacoes: unknown[],
  ocorridoEm = '2026-10-30T09:00:00.000Z',
) =>
  evento(tipo, id, ocorridoEm, {
    casa: 'camara_dos_deputados',
    codigoNaFonte: codigo,
    sigla,
    numero: 901,
    ano: 2026,
    ementa: 'Tema fictício.',
    apresentadaEm: '2026-03-02T13:00:00.000Z',
    autores: [
      { pessoaId: ANA, nomeNaFonte: 'Ana Exemplo', tipoNaFonte: 'Deputado(a)', proponente: true },
      {
        pessoaId: null,
        nomeNaFonte: 'Poder Executivo',
        tipoNaFonte: 'Órgão do Poder Executivo',
        proponente: true,
      },
    ],
    situacao: { descricao: 'Aguardando Parecer', desde: '2026-10-20T13:00:00.000Z', orgao: 'CCJC' },
    tramitacoes,
    normaGerada: null,
    urlDoTexto: null,
    capturaId: CAPTURA,
  });

describe('projeção de proposições', () => {
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
      proposicao('ProposicaoRegistrada', PL, '900301', 'PL', [
        ato('2026-03-02T13:00:00.000Z', 'Apresentação'),
        ato('2026-10-20T13:00:00.000Z', 'Parecer do Relator'),
      ]),
      proposicao('ProposicaoRegistrada', MPV, '900302', 'MPV', [
        ato('2026-03-02T13:00:00.000Z', 'Apresentação'),
      ]),
      evento('VotacaoNominalRegistrada', VOTACAO, '2026-10-30T09:00:00.000Z', {
        casa: 'camara_dos_deputados',
        codigoNaFonte: '900100-10',
        dia: '2026-10-21',
        registradaEm: '2026-10-21T22:00:00.000Z',
        descricao: 'Aprovado o PL 901.',
        resultado: 'aprovada',
        secreta: false,
        proposicoes: [
          { codigoNaFonte: '900301', sigla: 'PL', numero: 901, ano: 2026, ementa: null },
          { codigoNaFonte: '123', sigla: 'PL', numero: 123, ano: 2020, ementa: null },
        ],
        votos: [
          {
            pessoaId: ANA,
            mandatoId: ANA,
            opcao: 'sim',
            registroNaFonte: 'Sim',
            registradoEm: '2026-10-21T21:40:00.000Z',
            siglaPartidoNaFonte: 'PEX',
          },
        ],
        capturaId: CAPTURA,
        capturaDosVotosId: CAPTURA,
      }),
    );
  });

  afterAll(async () => {
    await banco.fechar();
    await postgres.parar();
  });

  it('lista da movimentada por último à mais parada, e filtra por tipo', async () => {
    const todas = await consulta.proposicoes.listar({ pagina: 1, itensPorPagina: 10 });
    expect(todas.itens.map((p) => [p.sigla, p.ultimaTramitacaoEm])).toEqual([
      ['PL', '2026-10-20T13:00:00.000Z'],
      ['MPV', '2026-03-02T13:00:00.000Z'],
    ]);

    const mpvs = await consulta.proposicoes.listar({ sigla: 'MPV', pagina: 1, itensPorPagina: 10 });
    expect(mpvs.itens.map((p) => p.proposicaoId)).toEqual([MPV]);
  });

  it('detalha com autoria, tramitação do mais recente ao mais antigo e as votações', async () => {
    const detalhe = await consulta.proposicoes.buscar(PL);

    expect(detalhe?.autores.map((a) => [a.nome, a.pessoaId])).toEqual([
      ['Ana Exemplo', ANA],
      ['Poder Executivo', null],
    ]);
    expect(detalhe?.tramitacoes.map((t) => t.descricao)).toEqual([
      'Parecer do Relator',
      'Apresentação',
    ]);
    expect(detalhe?.votacoes.map((v) => v.votacaoId)).toEqual([VOTACAO]);
    expect(await consulta.proposicoes.buscar('nao-e-uuid')).toBeUndefined();
  });

  it('a votação aponta a proposição já coletada; a que falta fica sem ligação', async () => {
    const votacao = await consulta.votacoes.buscar(VOTACAO);

    expect(votacao?.proposicoes.map((p) => [p.codigoNaFonte, p.proposicaoId])).toEqual([
      ['900301', PL],
      ['123', null],
    ]);
  });

  it('a tramitação que avança substitui o estado; um evento mais velho não desfaz', async () => {
    await publicar(
      proposicao(
        'TramitacaoAvancou',
        MPV,
        '900302',
        'MPV',
        [ato('2026-03-02T13:00:00.000Z', 'Apresentação'), ato('2026-10-29T13:00:00.000Z', 'Pauta')],
        '2026-10-30T10:00:00.000Z',
      ),
      proposicao('ProposicaoRetificada', MPV, '900302', 'MPV', [], '2026-10-30T09:30:00.000Z'),
    );

    const detalhe = await consulta.proposicoes.buscar(MPV);
    expect(detalhe?.tramitacoes.map((t) => t.descricao)).toEqual(['Pauta', 'Apresentação']);
    expect(detalhe?.ultimaTramitacaoEm).toBe('2026-10-29T13:00:00.000Z');
  });

  it('as proposições de autoria do parlamentar', async () => {
    const daAna = await consulta.proposicoes.doParlamentar(ANA, { pagina: 1, itensPorPagina: 10 });

    expect(daAna.total).toBe(2);
    expect(daAna.itens.map((a) => [a.proposicao.sigla, a.proponente])).toEqual([
      ['MPV', true],
      ['PL', true],
    ]);
  });
});
