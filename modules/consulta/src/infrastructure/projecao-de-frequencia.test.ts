import type { EnvelopeDeEvento } from '@prometeu/contracts';
import { BancoDoContexto, migrar } from '@prometeu/infraestrutura';
import {
  BarramentoEmMemoria,
  iniciarPostgresDeTeste,
  type PostgresDeTeste,
} from '@prometeu/infraestrutura/testes';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type ConsultaDeFrequencia,
  MIGRACOES_DA_CONSULTA,
  montarConsulta,
  SCHEMA_DA_CONSULTA,
} from '../index.js';

const ANA = '0192d5e0-4444-7000-8000-00000000000a';
const MANDATO = '0192d5e0-6666-7000-8000-000000000001';
const CAPTURA_1 = '0192d5e0-5555-7000-8000-000000000001';
const CAPTURA_2 = '0192d5e0-5555-7000-8000-000000000002';
const REGISTRO_DIA_1 = '0192d5e0-8888-7000-8000-000000000001';
const REGISTRO_DIA_6 = '0192d5e0-8888-7000-8000-000000000006';
const REGISTRO_DIA_7 = '0192d5e0-8888-7000-8000-000000000007';

let sequencia = 0;
function evento(
  tipo: string,
  registroId: string,
  ocorridoEm: string,
  dados: Record<string, unknown>,
): EnvelopeDeEvento {
  sequencia += 1;
  return {
    id: `0192d5e0-9999-7000-8000-${String(sequencia).padStart(12, '0')}`,
    tipo,
    versao: 1,
    ocorridoEm,
    idDoAgregado: registroId,
    idDeCorrelacao: 'teste',
    dados,
  };
}

const dia = (data: string, situacao: string, motivo: unknown, capturaId = CAPTURA_1) => ({
  casa: 'camara_dos_deputados',
  dia: data,
  pessoaId: ANA,
  mandatoId: MANDATO,
  situacao,
  motivo,
  registroNaFonte: situacao === 'presente' ? 'Presença' : 'Ausência',
  sessoes: [{ descricao: `EXTRAORDINÁRIA - ${data}`, presente: situacao === 'presente' }],
  capturaId,
});

const MISSAO = { categoria: 'missao_autorizada', descricaoNaFonte: 'Missão Autorizada' };

describe('projeção de frequência', () => {
  let postgres: PostgresDeTeste;
  let banco: BancoDoContexto;
  let consulta: ConsultaDeFrequencia;
  const barramento = new BarramentoEmMemoria();

  beforeAll(async () => {
    postgres = await iniciarPostgresDeTeste();
    banco = BancoDoContexto.conectar(
      SCHEMA_DA_CONSULTA,
      postgres.urlDoContexto(SCHEMA_DA_CONSULTA),
    );
    await migrar(banco, MIGRACOES_DA_CONSULTA);
    const modulo = montarConsulta(banco);
    consulta = modulo.frequencia;
    await modulo.assinarConsumidores(barramento);
  });

  afterAll(async () => {
    await banco.fechar();
    await postgres.parar();
  });

  it('resume o período por situação e por motivo, com a fonte de cada dia', async () => {
    await barramento.publicar(
      evento('CapturaRegistrada', CAPTURA_1, '2026-10-30T09:00:00.000Z', {
        fonte: 'camara',
        url: 'https://www.camara.leg.br/SitCamaraWS/presencas',
        coletadaEm: '2026-10-30T09:00:00.000Z',
        sha256: 'a'.repeat(64),
        caminho: 'bronze/camara/p',
        tipoDeConteudo: 'text/xml',
      }),
    );
    await barramento.publicar(
      evento(
        'PresencaRegistrada',
        REGISTRO_DIA_1,
        '2026-10-30T09:00:01.000Z',
        dia('2026-10-01', 'presente', null),
      ),
    );
    await barramento.publicar(
      evento(
        'AusenciaRegistrada',
        REGISTRO_DIA_6,
        '2026-10-30T09:00:02.000Z',
        dia('2026-10-06', 'ausencia_justificada', MISSAO),
      ),
    );
    await barramento.publicar(
      evento(
        'AusenciaRegistrada',
        REGISTRO_DIA_7,
        '2026-10-30T09:00:03.000Z',
        dia('2026-10-07', 'ausente', null),
      ),
    );

    const frequencia = await consulta.doParlamentar(ANA, { de: '2026-10-01', ate: '2026-10-31' });

    expect(frequencia.resumo).toEqual({
      diasComSessao: 3,
      presencas: 1,
      ausenciasJustificadas: 1,
      ausenciasSemJustificativa: 1,
      porMotivo: [{ categoria: 'missao_autorizada', dias: 1 }],
    });
    expect(frequencia.dias.map((d) => d.dia)).toEqual(['2026-10-07', '2026-10-06', '2026-10-01']);
    expect(frequencia.dias[1]).toMatchObject({
      motivo: MISSAO,
      fonte: { capturaId: CAPTURA_1, url: 'https://www.camara.leg.br/SitCamaraWS/presencas' },
    });
  });

  it('a retificação substitui o dia, e um evento antigo que chega depois não desfaz', async () => {
    await barramento.publicar(
      evento('FrequenciaRetificada', REGISTRO_DIA_7, '2026-10-31T09:00:00.000Z', {
        ...dia('2026-10-07', 'ausencia_justificada', MISSAO, CAPTURA_2),
        situacaoAnterior: 'ausente',
      }),
    );
    await barramento.publicar(
      evento(
        'AusenciaRegistrada',
        REGISTRO_DIA_7,
        '2026-10-30T08:00:00.000Z',
        dia('2026-10-07', 'ausente', null),
      ),
    );

    const frequencia = await consulta.doParlamentar(ANA, { de: '2026-10-07', ate: '2026-10-07' });

    expect(frequencia.dias).toHaveLength(1);
    expect(frequencia.dias[0]).toMatchObject({
      situacao: 'ausencia_justificada',
      fonte: { capturaId: CAPTURA_2, url: null },
    });
    expect(frequencia.resumo.ausenciasSemJustificativa).toBe(0);
  });

  it('período sem registro não inventa ausência', async () => {
    const frequencia = await consulta.doParlamentar(ANA, { de: '2026-09-01', ate: '2026-09-30' });

    expect(frequencia.resumo.diasComSessao).toBe(0);
    expect(frequencia.dias).toEqual([]);
  });
});
