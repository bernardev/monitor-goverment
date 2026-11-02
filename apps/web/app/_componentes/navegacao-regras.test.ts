import { describe, expect, it } from 'vitest';

import { secaoAtual } from './navegacao-regras';

const SECOES = ['/municipios', '/parlamentares', '/obras'];

describe('secaoAtual', () => {
  it('a própria seção e as páginas de dentro dela', () => {
    expect(secaoAtual('/parlamentares', SECOES)).toBe('/parlamentares');
    expect(secaoAtual('/parlamentares/123', SECOES)).toBe('/parlamentares');
  });
  it('fora das seções, nenhuma', () => {
    expect(secaoAtual('/', SECOES)).toBeUndefined();
    expect(secaoAtual('/obrasx', SECOES)).toBeUndefined();
  });
});
