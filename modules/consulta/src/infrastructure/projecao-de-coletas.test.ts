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

const AGORA = new Date('2026-10-31T12:00:00.000Z');

let sequencia = 0;
function lote(
  fonte: string,
  tabela: string,
  ocorridoEm: string,
  registros: number,
): EnvelopeDeEvento {
  sequencia += 1;
  const id = `0192d5e0-9999-7000-8000-${String(sequencia).padStart(12, '0')}`;
  return {
    id,
    tipo: 'LoteIngerido',
    versao: 1,
    ocorridoEm,
    idDoAgregado: `${fonte}.${tabela}`,
    idDeCorrelacao: `ingestao-${id}`,
    dados: {
      fonte,
      tabela,
      versaoDoContrato: '1.0.0',
      coletadoDe: ocorridoEm,
      coletadoAte: ocorridoEm,
      registros,
    },
  };
}

describe('situação das fontes', () => {
  let postgres: PostgresDeTeste;
  let banco: BancoDoContexto;
  let consulta: ModuloConsulta;
  const barramento = new BarramentoEmMemoria();

  beforeAll(async () => {
    postgres = await iniciarPostgresDeTeste();
    banco = BancoDoContexto.conectar(
      SCHEMA_DA_CONSULTA,
      postgres.urlDoContexto(SCHEMA_DA_CONSULTA),
    );
    await migrar(banco, MIGRACOES_DA_CONSULTA);
    consulta = montarConsulta(banco, { agora: () => AGORA });
    await consulta.assinarConsumidores(barramento);
    for (const envelope of [
      lote('camara', 'camara_votacao', '2026-10-31T09:00:00.000Z', 12),
      // Atrasado: não desfaz a coleta mais nova.
      lote('camara', 'camara_votacao', '2026-10-29T09:00:00.000Z', 99),
      lote('camara', 'camara_deputado', '2026-10-30T09:00:00.000Z', 600),
      lote('portal_transparencia', 'transparencia_emenda', '2026-10-29T09:00:00.000Z', 25_000),
      lote('obrasgov', 'obrasgov_projeto', '2026-10-21T09:00:00.000Z', 10_000),
    ]) {
      await barramento.publicar(envelope);
    }
  });

  afterAll(async () => {
    await banco.fechar();
    await postgres.parar();
  });

  it('diz de cada fonte a última coleta e se ela está em dia com a agenda', async () => {
    const fontes = await consulta.fontes.situacao();

    expect(fontes.map((f) => [f.fonte, f.situacao, f.ultimaColetaEm])).toEqual([
      ['camara', 'em_dia', '2026-10-31T09:00:00.000Z'],
      ['senado', 'nunca_coletada', null],
      // Diária, coletada há 51 horas: passou do prazo de 24 horas mais a folga.
      ['portal_transparencia', 'atrasada', '2026-10-29T09:00:00.000Z'],
      // Semanal, coletada há 10 dias.
      ['obrasgov', 'atrasada', '2026-10-21T09:00:00.000Z'],
    ]);
    expect(fontes[0]?.tabelas).toEqual([
      {
        tabela: 'camara_deputado',
        ultimaColetaEm: '2026-10-30T09:00:00.000Z',
        registros: 600,
        versaoDoContrato: '1.0.0',
      },
      {
        tabela: 'camara_votacao',
        ultimaColetaEm: '2026-10-31T09:00:00.000Z',
        registros: 12,
        versaoDoContrato: '1.0.0',
      },
    ]);
  });
});
