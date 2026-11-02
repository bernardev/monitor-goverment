import { textoDaContagem } from '@prometeu/ui';
import { describe, expect, it } from 'vitest';

import { numerosDaCidade } from './numeros';

const COM_TUDO = {
  pagoCentavos: 13_410_000_000n,
  empenhadoCentavos: 20_000_000_000n,
  emendas: 12,
  obras: 3,
  emendasColetadasEm: '2026-10-30T19:46:00Z',
  obrasColetadasEm: '2026-10-31T10:00:00Z',
};

const SEM_NADA = {
  pagoCentavos: 0n,
  empenhadoCentavos: 0n,
  emendas: 0,
  obras: 0,
  emendasColetadasEm: null,
  obrasColetadasEm: null,
};

describe('numerosDaCidade', () => {
  it('traz pago, empenhado, emendas e obras, cada um com o seu período', () => {
    const [pago, empenhado, emendas, obras] = numerosDaCidade(COM_TUDO);
    expect(pago?.valor).toBe('R$ 134,1 milhões');
    expect(empenhado?.valor).toBe('R$ 200 milhões');
    expect(emendas?.valor).toBe('12');
    expect(obras?.valor).toBe('3');
    expect(pago?.periodo).toBe('desde o orçamento de 2023, até a coleta de 30/10/2026');
    expect(obras?.periodo).toBe('desde o orçamento de 2023, até a coleta de 31/10/2026');
  });

  it('o valor das contagens é o texto final, o mesmo que o servidor entrega sem JavaScript', () => {
    const [, , emendas, obras] = numerosDaCidade({ ...COM_TUDO, emendas: 1234 });
    expect(emendas?.contagem && textoDaContagem(emendas.contagem, 1)).toBe(emendas?.valor);
    expect(obras?.contagem && textoDaContagem(obras.contagem, 1)).toBe(obras?.valor);
  });

  it('concorda singular e plural nos rótulos', () => {
    const [, , um] = numerosDaCidade({ ...COM_TUDO, emendas: 1, obras: 1 });
    const [, , varias, muitas] = numerosDaCidade(COM_TUDO);
    expect(um?.rotulo).toBe('emenda com destino à cidade');
    expect(varias?.rotulo).toBe('emendas com destino à cidade');
    expect(muitas?.rotulo).toBe('obras pagas com emendas');
    expect(numerosDaCidade({ ...COM_TUDO, obras: 1 })[3]?.rotulo).toBe('obra paga com emendas');
  });

  it('sem emendas e sem obras mostra "—", sem contagem, e mantém rótulo e período', () => {
    const numeros = numerosDaCidade(SEM_NADA);
    expect(numeros).toHaveLength(4);
    for (const n of numeros) {
      expect(n.valor).toBe('—');
      expect(n.contagem).toBeUndefined();
      expect(n.rotulo).not.toBe('');
      expect(n.periodo).toBe('desde o orçamento de 2023');
    }
  });
});
