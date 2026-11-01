import { describe, expect, it } from 'vitest';

import { caminhoDeVolta } from './volta';

describe('caminhoDeVolta', () => {
  it('aceita um caminho do próprio app, com busca e âncora', () => {
    expect(caminhoDeVolta('/parlamentares/abc?pagina=2#votou')).toBe(
      '/parlamentares/abc?pagina=2#votou',
    );
  });

  it.each([
    [null],
    [''],
    ['https://outro.site'],
    ['//outro.site/x'],
    ['/\\outro.site'],
    ['javascript:alert(1)'],
    ['/a\nb'],
  ])('qualquer outra coisa volta para o início (%j)', (pedido) => {
    expect(caminhoDeVolta(pedido)).toBe('/');
  });
});
