import { describe, expect, it } from 'vitest';

import { pagoAteAgora, reais } from './formatacao';

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

describe('pagoAteAgora', () => {
  it('soma o pago no ano e os restos pagos depois', () => {
    expect(pagoAteAgora({ pagoCentavos: '100', restosPagosCentavos: '250' })).toBe(350n);
  });
});
