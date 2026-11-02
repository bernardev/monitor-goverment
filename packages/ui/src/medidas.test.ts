import { describe, expect, it } from 'vitest';

import { atributosDaContagem, porcentagens, porMes, textoDaContagem } from './medidas';

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

describe('textoDaContagem', () => {
  it('no fim da contagem mostra o valor final formatado', () => {
    expect(textoDaContagem({ alvo: 73.3, casas: 1, prefixo: 'R$ ', sufixo: ' milhões' }, 1)).toBe(
      'R$ 73,3 milhões',
    );
    expect(textoDaContagem({ alvo: 25131 }, 1)).toBe('25.131');
  });
  it('no começo mostra zero e no meio arredonda', () => {
    expect(textoDaContagem({ alvo: 81, sufixo: '%' }, 0)).toBe('0%');
    expect(textoDaContagem({ alvo: 12 }, 0.5)).toBe('6');
  });
});

describe('atributosDaContagem', () => {
  it('sem contagem não marca nada', () => {
    expect(atributosDaContagem(undefined)).toEqual({});
  });
  it('com contagem leva o alvo e o formato', () => {
    expect(atributosDaContagem({ alvo: 5, sufixo: ' de 12' })).toEqual({
      'data-conta': '5',
      'data-casas': '0',
      'data-prefixo': '',
      'data-sufixo': ' de 12',
    });
  });
});
