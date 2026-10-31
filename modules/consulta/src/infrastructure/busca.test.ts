import { describe, expect, it } from 'vitest';

import { paraBusca } from './busca.js';

describe('paraBusca', () => {
  it.each([
    ['São Paulo', 'sao paulo'],
    ['  GENERAL   PAZUELLO ', 'general pazuello'],
    ['Itaquaquecetuba', 'itaquaquecetuba'],
    ['Açaí Ñ', 'acai n'],
    ['100%_', String.raw`100\%\_`],
  ])('%s → %s', (termo, esperado) => {
    expect(paraBusca(termo)).toBe(esperado);
  });
});
