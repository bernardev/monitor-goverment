import type { ExecucaoDaEmenda } from '@prometeu/contracts';
import { textoDaContagem } from '@prometeu/ui';
import { describe, expect, it } from 'vitest';

import { reais } from '../../_componentes/formatacao';
import { fasesDaEmenda, numerosDaEmenda, periodoDaEmenda, periodoDosFavorecidos } from './numeros';

const execucao: ExecucaoDaEmenda = {
  empenhadoCentavos: '10000000000',
  liquidadoCentavos: '9000000000',
  pagoCentavos: '4000000000',
  restosInscritosCentavos: '5000000000',
  restosCanceladosCentavos: '0',
  restosPagosCentavos: '1000000000',
};

describe('periodoDaEmenda', () => {
  it('vai do orçamento do ano até a coleta', () => {
    expect(periodoDaEmenda(2025, '2026-10-30T19:46:00Z')).toBe(
      'orçamento de 2025, até a coleta de 30/10/2026',
    );
  });

  it('sem data de coleta, omite "até a coleta" e não mostra Invalid Date', () => {
    const periodo = periodoDaEmenda(2025, null);
    expect(periodo).toBe('orçamento de 2025');
    expect(periodo).not.toContain('Invalid');
  });
});

describe('numerosDaEmenda', () => {
  it('traz pago, empenhado e a parte já paga, todos com o período', () => {
    const numeros = numerosDaEmenda({ ano: 2025, execucao, coletadaEm: '2026-10-30T19:46:00Z' });
    expect(numeros.map((n) => n.valor)).toEqual(['R$ 50 milhões', 'R$ 100 milhões', '50,00%']);
    expect(numeros.map((n) => n.rotulo)).toEqual([
      'já pago a quem recebe',
      'empenhado (reservado no orçamento)',
      'do valor reservado já foi pago',
    ]);
    expect(new Set(numeros.map((n) => n.periodo))).toEqual(
      new Set(['orçamento de 2025, até a coleta de 30/10/2026']),
    );
    expect(numeros[2]?.valor).toBe(textoDaContagem(numeros[2]!.contagem!, 1));
  });

  it('sem valor empenhado, os três ficam em "—" e sem contagem', () => {
    const numeros = numerosDaEmenda({
      ano: 2025,
      execucao: {
        ...execucao,
        empenhadoCentavos: '0',
        pagoCentavos: '0',
        restosPagosCentavos: '0',
      },
      coletadaEm: null,
    });
    expect(numeros.map((n) => n.valor)).toEqual(['—', '—', '—']);
    expect(numeros.every((n) => n.contagem === undefined)).toBe(true);
    expect(numeros.every((n) => n.periodo === 'orçamento de 2025')).toBe(true);
  });
});

describe('fasesDaEmenda', () => {
  it('na ordem em que o dinheiro anda, em linguagem simples', () => {
    const fases = fasesDaEmenda(execucao);
    expect(fases.map((f) => f.chave)).toEqual([
      'empenhado',
      'liquidado',
      'pago',
      'restos',
      'cancelados',
      'restos-pagos',
      'total',
    ]);
    const texto = JSON.stringify(fases.map((f) => [f.rotulo, f.detalhe]));
    expect(texto).not.toMatch(/restos a pagar/i);
    expect(fases[6]?.texto).toBe(reais('5000000000'));
  });
});

describe('periodoDosFavorecidos', () => {
  it('vai do primeiro ao último mês de recebimento', () => {
    expect(
      periodoDosFavorecidos([
        { primeiroMes: '2025-08', ultimoMes: '2025-10' },
        { primeiroMes: '2025-06', ultimoMes: '2026-01' },
      ]),
    ).toBe('jun. de 2025 a jan. de 2026');
  });

  it('sem favorecido, diz que não há pagamento registrado', () => {
    expect(periodoDosFavorecidos([])).toBe('nenhum pagamento registrado');
  });
});
