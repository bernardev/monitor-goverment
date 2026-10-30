import type { EnvelopeDeEvento } from '@prometeu/contracts';
import { BancoDoContexto, migrar } from '@prometeu/infraestrutura';
import {
  BarramentoEmMemoria,
  iniciarPostgresDeTeste,
  type PostgresDeTeste,
} from '@prometeu/infraestrutura/testes';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type ConsultaDeVotacoes,
  MIGRACOES_DA_CONSULTA,
  montarConsulta,
  SCHEMA_DA_CONSULTA,
} from '../index.js';

const ANA = '0192d5e0-4444-7000-8000-00000000000a';
const BRUNO = '0192d5e0-4444-7000-8000-00000000000b';
const CARLA = '0192d5e0-4444-7000-8000-00000000000c';
const MANDATO = '0192d5e0-6666-7000-8000-000000000001';
const CAPTURA = '0192d5e0-5555-7000-8000-000000000001';
const CAPTURA_DOS_VOTOS = '0192d5e0-5555-7000-8000-000000000002';
const PL_900 = '0192d5e0-7777-7000-8000-000000000001';
const REQUERIMENTO = '0192d5e0-7777-7000-8000-000000000002';
const SETEMBRO = '0192d5e0-7777-7000-8000-000000000003';

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

const voto = (pessoaId: string, opcao: string, registroNaFonte: string | null) => ({
  pessoaId,
  mandatoId: MANDATO,
  opcao,
  registroNaFonte,
  registradoEm: '2026-10-14T22:40:00.000Z',
  siglaPartidoNaFonte: 'PEX',
});

const votacao = (
  tipo: 'VotacaoNominalRegistrada' | 'VotacaoNominalRetificada',
  id: string,
  dia: string,
  votos: unknown[],
  ocorridoEm = '2026-10-30T09:00:00.000Z',
) =>
  evento(tipo, id, ocorridoEm, {
    casa: 'camara_dos_deputados',
    codigoNaFonte: `cod-${id.slice(-1)}`,
    dia,
    registradaEm: `${dia}T22:42:50.000Z`,
    descricao: `Votação de ${dia}.`,
    resultado: 'aprovada',
    secreta: false,
    proposicoes: [
      { codigoNaFonte: '9009001', sigla: 'PL', numero: 900, ano: 2026, ementa: 'Tema fictício.' },
    ],
    votos,
    capturaId: CAPTURA,
    capturaDosVotosId: CAPTURA_DOS_VOTOS,
  });

const registrada = (pessoaId: string, nome: string) =>
  evento('PessoaRegistrada', pessoaId, '2026-10-30T09:00:00.000Z', {
    nome,
    siglaPartido: 'PEX',
    urlDaFoto: null,
    identificadores: [{ fonte: 'camara', codigo: nome }],
    capturaId: CAPTURA,
  });

/** Carla faltou com justificativa no dia 14; a frequência dela foi apurada. */
const ausenciaDaCarla = evento(
  'AusenciaRegistrada',
  '0192d5e0-8888-7000-8000-000000000001',
  '2026-10-30T09:00:00.000Z',
  {
    casa: 'camara_dos_deputados',
    dia: '2026-10-14',
    pessoaId: CARLA,
    mandatoId: MANDATO,
    situacao: 'ausencia_justificada',
    motivo: { categoria: 'missao_autorizada', descricaoNaFonte: 'Missão Autorizada' },
    registroNaFonte: 'Ausência justificada',
    sessoes: [{ descricao: 'DELIBERATIVA', presente: false }],
    capturaId: CAPTURA,
  },
);

const capturaRegistrada = (capturaId: string, url: string) =>
  evento('CapturaRegistrada', capturaId, '2026-10-30T09:00:00.000Z', {
    sha256: 'a'.repeat(64),
    fonte: 'camara',
    url,
    coletadaEm: '2026-10-30T09:00:00.000Z',
    tipoDeConteudo: 'application/json',
  });

describe('projeção de votações nominais', () => {
  let postgres: PostgresDeTeste;
  let banco: BancoDoContexto;
  let consulta: ConsultaDeVotacoes;
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
    const modulo = montarConsulta(banco);
    consulta = modulo.votacoes;
    await modulo.assinarConsumidores(barramento);

    await publicar(
      registrada(ANA, 'Ana Exemplo'),
      registrada(BRUNO, 'Bruno Modelo'),
      capturaRegistrada(CAPTURA, 'https://camara/votacoes/1'),
      capturaRegistrada(CAPTURA_DOS_VOTOS, 'https://camara/votacoes/1/votos'),
      ausenciaDaCarla,
      votacao('VotacaoNominalRegistrada', PL_900, '2026-10-14', [
        voto(ANA, 'sim', 'Sim'),
        voto(BRUNO, 'nao', 'Não'),
      ]),
      votacao('VotacaoNominalRegistrada', REQUERIMENTO, '2026-10-15', [voto(BRUNO, 'sim', 'Sim')]),
      votacao('VotacaoNominalRegistrada', SETEMBRO, '2026-09-02', [voto(ANA, 'sim', 'Sim')]),
    );
  });

  afterAll(async () => {
    await banco.fechar();
    await postgres.parar();
  });

  it('detalha a votação com o placar, o voto e o nome de cada um e as duas fontes', async () => {
    const detalhe = await consulta.buscar(PL_900);

    expect(detalhe).toMatchObject({
      votacaoId: PL_900,
      dia: '2026-10-14',
      resultado: 'aprovada',
      placar: { sim: 1, nao: 1, abstencao: 0, secreto: 0 },
      fonte: { capturaId: CAPTURA, url: 'https://camara/votacoes/1' },
      fonteDosVotos: { capturaId: CAPTURA_DOS_VOTOS, url: 'https://camara/votacoes/1/votos' },
    });
    expect(detalhe?.votos.map((v) => [v.nome, v.siglaPartido, v.opcao])).toEqual([
      ['Ana Exemplo', 'PEX', 'sim'],
      ['Bruno Modelo', 'PEX', 'nao'],
    ]);
    expect(await consulta.buscar('nao-e-uuid')).toBeUndefined();
  });

  it('lista as votações do período, da mais recente para a mais antiga', async () => {
    const pagina = await consulta.listar({
      de: '2026-10-01',
      ate: '2026-10-31',
      pagina: 1,
      itensPorPagina: 10,
    });

    expect(pagina.total).toBe(2);
    expect(pagina.itens.map((v) => v.votacaoId)).toEqual([REQUERIMENTO, PL_900]);
  });

  it('a retificação troca os votos; um evento mais velho não desfaz', async () => {
    await publicar(
      votacao(
        'VotacaoNominalRetificada',
        PL_900,
        '2026-10-14',
        [voto(ANA, 'sim', 'Sim'), voto(BRUNO, 'abstencao', 'Abstenção')],
        '2026-10-30T10:00:00.000Z',
      ),
      votacao(
        'VotacaoNominalRetificada',
        PL_900,
        '2026-10-14',
        [voto(ANA, 'nao', 'Não')],
        '2026-10-30T09:30:00.000Z',
      ),
    );

    const detalhe = await consulta.buscar(PL_900);
    expect(detalhe?.placar).toMatchObject({ sim: 1, nao: 0, abstencao: 1 });
    expect(detalhe?.votos.map((v) => v.opcao)).toEqual(['sim', 'abstencao']);
  });

  it('do parlamentar: votações em que votou e as do dia em que a frequência foi apurada', async () => {
    const periodo = { de: '2026-10-01', ate: '2026-10-31' };

    const daAna = await consulta.doParlamentar(ANA, periodo);
    expect(daAna.participacoes.map((p) => [p.votacao.votacaoId, p.voto?.opcao])).toEqual([
      [PL_900, 'sim'],
    ]);

    // Carla não votou no PL 900, mas a casa apurou a ausência dela no dia: entra, sem voto.
    const daCarla = await consulta.doParlamentar(CARLA, periodo);
    const [daVotacao] = daCarla.participacoes;
    expect(daCarla.participacoes).toHaveLength(1);
    expect(daVotacao?.votacao.votacaoId).toBe(PL_900);
    expect(daVotacao?.voto).toBeNull();
    expect(daVotacao?.frequenciaNoDia).toEqual({
      situacao: 'ausencia_justificada',
      motivo: { categoria: 'missao_autorizada', descricaoNaFonte: 'Missão Autorizada' },
      registroNaFonte: 'Ausência justificada',
    });
    expect(daCarla.resumo).toEqual({
      votacoes: 1,
      comVoto: 0,
      semVotoRegistrado: 1,
      porOpcao: [],
    });

    const doBruno = await consulta.doParlamentar(BRUNO, periodo);
    expect(doBruno.resumo).toMatchObject({
      votacoes: 2,
      comVoto: 2,
      porOpcao: [
        { opcao: 'sim', votos: 1 },
        { opcao: 'abstencao', votos: 1 },
      ],
    });
  });

  it('Senado (contrato v2): sem horário, com quem não votou e o motivo', async () => {
    const SENADO = '0192d5e0-7777-7000-8000-000000000004';
    await publicar({
      ...evento('VotacaoNominalRegistrada', SENADO, '2026-10-30T09:00:00.000Z', {
        casa: 'senado_federal',
        codigoNaFonte: '9101',
        dia: '2026-10-14',
        registradaEm: null,
        descricao: 'Votação nominal do PLP 901/2026.',
        resultado: 'aprovada',
        secreta: false,
        relacaoCompleta: true,
        proposicoes: [],
        votos: [{ ...voto(ANA, 'sim', 'Sim'), registradoEm: null }],
        semVoto: [
          {
            pessoaId: CARLA,
            mandatoId: MANDATO,
            situacao: 'ausencia_justificada',
            motivo: { categoria: 'licenca_saude', descricaoNaFonte: 'Licença saúde' },
            registroNaFonte: 'LS',
            siglaPartidoNaFonte: 'PEX',
          },
        ],
        capturaId: CAPTURA,
        capturaDosVotosId: CAPTURA,
      }),
      versao: 2,
    });

    const detalhe = await consulta.buscar(SENADO);
    expect(detalhe).toMatchObject({
      registradaEm: null,
      relacaoCompleta: true,
      placar: { sim: 1 },
      semVoto: [
        {
          pessoaId: CARLA,
          situacao: 'ausencia_justificada',
          motivo: { categoria: 'licenca_saude' },
          registroNaFonte: 'LS',
        },
      ],
    });
    expect(detalhe?.votos.map((v) => v.pessoaId)).toEqual([ANA]);
    expect(
      (
        await consulta.listar({
          casa: 'senado_federal',
          de: '2026-10-01',
          ate: '2026-10-31',
          pagina: 1,
          itensPorPagina: 10,
        })
      ).itens.map((v) => v.votacaoId),
    ).toEqual([SENADO]);

    const daCarla = await consulta.doParlamentar(CARLA, { de: '2026-10-14', ate: '2026-10-14' });
    const noSenado = daCarla.participacoes.find((p) => p.votacao.votacaoId === SENADO);
    expect(noSenado?.voto).toBeNull();
    expect(noSenado?.semVoto).toMatchObject({
      situacao: 'ausencia_justificada',
      registroNaFonte: 'LS',
    });
  });
});
