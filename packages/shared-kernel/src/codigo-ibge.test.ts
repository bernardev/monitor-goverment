import { describe, expect, it } from 'vitest';

import { CodigoIbge } from './codigo-ibge.js';

function codigo(valor: string): CodigoIbge {
  const resultado = CodigoIbge.criar(valor);
  if (!resultado.ok) throw new Error(resultado.error.message);
  return resultado.value;
}

describe('CodigoIbge', () => {
  it.each([
    ['0', 'federal', undefined],
    ['35', 'estadual', 'SP'],
    ['3550308', 'municipal', 'SP'],
    ['2611606', 'municipal', 'PE'],
    ['53', 'distrital', 'DF'],
    ['5300108', 'distrital', 'DF'],
  ] as const)('%s pertence à esfera %s (UF %s)', (valor, esfera, uf) => {
    const ente = codigo(valor);
    expect(ente.esfera()).toBe(esfera);
    expect(ente.uf()).toBe(uf);
  });

  it.each(['', '1', '00', '99', '3550', '9950308', '35503080', 'SP'])('rejeita "%s"', (valor) => {
    const resultado = CodigoIbge.criar(valor);
    expect(resultado.ok).toBe(false);
  });

  it.each([
    ['SP', '35'],
    ['df', '53'],
    [' ba ', '29'],
  ])('a UF %s tem o código %s', (sigla, esperado) => {
    const resultado = CodigoIbge.daUf(sigla);
    expect(resultado.ok && resultado.value.valor).toBe(esperado);
  });

  it.each(['', 'XX', 'São Paulo'])('rejeita a UF "%s"', (sigla) => {
    const resultado = CodigoIbge.daUf(sigla);
    expect(resultado.ok ? undefined : resultado.error.code).toBe('codigo_ibge.uf_invalida');
  });

  it('é igual a outro código com o mesmo valor', () => {
    expect(codigo('35').equals(codigo(' 35 '))).toBe(true);
    expect(CodigoIbge.uniao().ehUniao()).toBe(true);
  });
});
