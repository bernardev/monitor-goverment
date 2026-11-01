import { describe, expect, it } from 'vitest';

import {
  cnpj,
  documentoDoFavorecido,
  mes,
  nomeDoFavorecido,
  pagoAteAgora,
  partesPagoEAPagar,
  percentual,
  reais,
  reaisResumidos,
} from './formatacao';

// O Intl separa o símbolo com espaço inquebrável, que `\s` também casa.
const semNbsp = (texto: string) => texto.replace(/\s/g, ' ');

describe('reais', () => {
  it.each([
    ['123456789', 'R$ 1.234.567,89'],
    ['5', 'R$ 0,05'],
    ['0', 'R$ 0,00'],
    ['-100', '-R$ 1,00'],
    // Acima de 2^53 centavos: nenhum arredondamento.
    ['9007199254740993', 'R$ 90.071.992.547.409,93'],
  ])('%s centavos → %s', (centavos, esperado) => {
    expect(semNbsp(reais(centavos))).toBe(esperado);
  });
});

describe('reaisResumidos', () => {
  it('lê numa frase, sem arredondar para cima', () => {
    expect(reaisResumidos('13417949652')).toBe('R$ 134,1 milhões');
    expect(reaisResumidos(150000000n)).toBe('R$ 1,5 milhão');
    expect(reaisResumidos('250000000000')).toBe('R$ 2,5 bilhões');
    expect(reaisResumidos('4950000')).toBe('R$ 49,5 mil');
  });
});

describe('partesPagoEAPagar', () => {
  it('o que falta pagar nunca fica negativo', () => {
    expect(partesPagoEAPagar(150000000n, 200000000n).map((p) => [p.rotulo, p.valor])).toEqual([
      ['pago', 1500000],
      ['a pagar', 500000],
    ]);
    expect(partesPagoEAPagar(300n, 200n).map((p) => p.valor)).toEqual([3, 0]);
  });
});

describe('pagoAteAgora', () => {
  it('soma o pago no ano e os restos pagos depois', () => {
    expect(pagoAteAgora({ pagoCentavos: '100', restosPagosCentavos: '250' })).toBe(350n);
  });
});

describe('favorecidos', () => {
  it('formata o mês e o CNPJ', () => {
    expect(mes('2026-05')).toBe('mai/2026');
    expect(cnpj('12345678000190')).toBe('12.345.678/0001-90');
    expect(cnpj('250005')).toBe('250005');
  });

  it('o somado não tem nome nem documento: aparece pelo tipo', () => {
    const somado = { tipo: 'pessoas_fisicas', nome: null, documento: null };
    expect(nomeDoFavorecido(somado)).toBe('Pessoas físicas');
    expect(documentoDoFavorecido(somado)).toBeNull();
    expect(documentoDoFavorecido({ tipo: 'unidade_gestora', documento: '250005' })).toBe(
      'unidade gestora 250005',
    );
  });
});

describe('percentual', () => {
  it.each([
    [2335, '23,35%'],
    [0, '0,00%'],
    [10_000, '100,00%'],
    [10_194, '101,94%'],
  ])('%s centésimos → %s', (centesimos, esperado) => {
    expect(percentual(centesimos)).toBe(esperado);
  });
});
