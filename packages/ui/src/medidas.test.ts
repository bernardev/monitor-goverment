import { describe, expect, it } from 'vitest';

import { porcentagens, porMes } from './medidas';

describe('porcentagens', () => {
  it('somam 100 mesmo quando o arredondamento de cada parte não fecharia', () => {
    expect(porcentagens([44, 17, 1, 11])).toEqual([60, 23, 2, 15]);
    expect(porcentagens([1, 1, 1])).toEqual([34, 33, 33]);
    expect(porcentagens([3, 0])).toEqual([100, 0]);
  });

  it('um todo vazio não vira divisão por zero', () => {
    expect(porcentagens([0, 0])).toEqual([0, 0]);
    expect(porcentagens([])).toEqual([]);
  });
});

describe('porMes', () => {
  it('agrupa do mês mais antigo para o mais recente, com os dias em ordem', () => {
    const dias = [
      { dia: '2026-04-02', valor: 'b' },
      { dia: '2026-03-16', valor: 'a' },
      { dia: '2026-04-01', valor: 'c' },
    ];

    expect(porMes(dias)).toEqual([
      { nome: 'mar 2026', dias: [{ dia: '2026-03-16', valor: 'a' }] },
      {
        nome: 'abr 2026',
        dias: [
          { dia: '2026-04-01', valor: 'c' },
          { dia: '2026-04-02', valor: 'b' },
        ],
      },
    ]);
  });
});
