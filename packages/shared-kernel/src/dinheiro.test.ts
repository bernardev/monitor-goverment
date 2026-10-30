import { describe, expect, it } from 'vitest';

import { Dinheiro } from './dinheiro.js';

function reais(texto: string): Dinheiro {
  const resultado = Dinheiro.deReais(texto);
  if (!resultado.ok) throw new Error(resultado.error.message);
  return resultado.value;
}

describe('Dinheiro', () => {
  it('converte texto decimal em centavos exatos', () => {
    expect(reais('1234.56').centavos).toBe(123456n);
    expect(reais('0.5').centavos).toBe(50n);
    expect(reais('-10').centavos).toBe(-1000n);
  });

  it('soma sem erro de ponto flutuante', () => {
    expect(reais('0.1').somar(reais('0.2')).equals(reais('0.3'))).toBe(true);
  });

  it('suporta valores acima do limite seguro de number', () => {
    const muito = reais('92233720368547758.07');
    expect(muito.somar(reais('0.01')).paraDecimal()).toBe('92233720368547758.08');
  });

  it('rejeita formatos que pertencem à camada anticorrupção', () => {
    for (const invalido of ['1.234,56', 'R$ 10', '10.123', '', 'abc']) {
      const resultado = Dinheiro.deReais(invalido);
      expect(resultado.ok, invalido).toBe(false);
      if (!resultado.ok) expect(resultado.error.code).toBe('dinheiro.formato_invalido');
    }
  });

  it('rejeita centavos fracionários', () => {
    expect(Dinheiro.deCentavos(10.5).ok).toBe(false);
  });

  it('formata de forma canônica, inclusive negativos menores que um real', () => {
    expect(reais('-0.05').paraDecimal()).toBe('-0.05');
    expect(reais('7').toString()).toBe('BRL 7.00');
  });

  it('compara valores', () => {
    expect(reais('1').compararCom(reais('2'))).toBe(-1);
    expect(reais('2').compararCom(reais('2.00'))).toBe(0);
    expect(Dinheiro.zero().ehZero()).toBe(true);
    expect(reais('-1').ehNegativo()).toBe(true);
  });
});
