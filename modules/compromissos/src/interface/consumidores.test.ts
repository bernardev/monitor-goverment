import type { EnvelopeDeEvento } from '@prometeu/contracts';
import { gerarUuidV7 } from '@prometeu/shared-kernel';
import { describe, expect, it } from 'vitest';

import { fatoQueMudou } from './consumidores.js';

const captura = gerarUuidV7();
const agregado = gerarUuidV7();

function envelope(tipo: string, dados: Record<string, unknown>): EnvelopeDeEvento {
  return {
    id: gerarUuidV7(),
    tipo,
    versao: 1,
    ocorridoEm: '2026-10-30T12:00:00.000Z',
    idDoAgregado: agregado,
    idDeCorrelacao: gerarUuidV7(),
    dados: { ...dados, capturaId: captura },
  };
}

describe('Política da reavaliação: o que cada evento diz que mudou', () => {
  it('emenda: soma o pago no ano e os restos pagos de todas as destinações', () => {
    const destinacao = (pago: string, restos: string) => ({
      pagoCentavos: pago,
      restosPagosCentavos: restos,
    });
    expect(
      fatoQueMudou(
        envelope('ExecucaoDaEmendaAtualizada', {
          numero: '0007',
          ano: 2025,
          destinacoes: [destinacao('100000000', '50'), destinacao('0', '23456750')],
        }),
      ),
    ).toEqual({
      tipoDoAlvo: 'emenda',
      idDoAlvo: agregado,
      motivo: 'A execução da emenda 0007/2025 mudou: R$ 1.234.568,00 pagos até agora.',
      capturaId: captura,
    });
  });

  it('obra paralisada: data e justificativa, quando a fonte informa', () => {
    expect(
      fatoQueMudou(
        envelope('ObraParalisada', { em: '2026-09-21', justificativa: 'Falta de repasse.' }),
      )?.motivo,
    ).toBe('A obra foi paralisada em 21/09/2026. Justificativa: Falta de repasse.');
    expect(
      fatoQueMudou(envelope('ObraParalisada', { em: null, justificativa: null }))?.motivo,
    ).toBe('A obra foi paralisada.');
  });

  it('obra atualizada só interessa quando chega a uma situação final', () => {
    expect(
      fatoQueMudou(
        envelope('ObraAtualizada', { situacao: 'concluida', situacaoNaFonte: 'Concluída' }),
      ),
    ).toMatchObject({
      tipoDoAlvo: 'obra',
      motivo: 'A obra consta como concluída na fonte (Concluída).',
    });
    expect(
      fatoQueMudou(
        envelope('ObraAtualizada', { situacao: 'em_execucao', situacaoNaFonte: 'Em execução' }),
      ),
    ).toBeUndefined();
  });

  it('proposição: o último passo da tramitação', () => {
    expect(
      fatoQueMudou(
        envelope('TramitacaoAvancou', {
          sigla: 'PL',
          numero: 1234,
          ano: 2025,
          tramitacoes: [{ descricao: 'Apresentação' }, { descricao: 'Aprovado o parecer.' }],
        }),
      ),
    ).toMatchObject({
      tipoDoAlvo: 'proposicao',
      motivo: 'O PL 1234/2025 tramitou: Aprovado o parecer.',
    });
  });

  it('ignora eventos que não assina', () => {
    expect(fatoQueMudou(envelope('ObraRegistrada', {}))).toBeUndefined();
  });
});
