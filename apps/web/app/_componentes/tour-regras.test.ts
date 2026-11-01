import { describe, expect, it } from 'vitest';

import { deveAbrir, loginConcluido, posicaoDoCartao } from './tour-regras';

describe('loginConcluido', () => {
  it('é concluído quando volta para a página de origem', () => {
    expect(loginConcluido('http://localhost:3001/municipios/4314902')).toBe(true);
    expect(loginConcluido('http://localhost:3001/conta?erro=confirmacao')).toBe(true);
  });

  it('não é concluído quando o provedor recusou ou o login expirou', () => {
    expect(loginConcluido('http://localhost:3001/?erro=login_recusado')).toBe(false);
    expect(loginConcluido('http://localhost:3001/?erro=login_expirado')).toBe(false);
    expect(loginConcluido(null)).toBe(false);
  });
});

describe('deveAbrir', () => {
  it('abre logo depois do login, se o navegador ainda não viu', () => {
    expect(deveAbrir('outro=2; prometeu_boas_vindas=1', null)).toBe(true);
  });

  it('não abre de novo nem sem o login', () => {
    expect(deveAbrir('prometeu_boas_vindas=1', 'sim')).toBe(false);
    expect(deveAbrir('outro=2', null)).toBe(false);
    expect(deveAbrir('prometeu_boas_vindas=10', null)).toBe(false);
  });
});

describe('posicaoDoCartao', () => {
  const janela = { width: 1440, height: 900 };
  const cartao = { width: 440, height: 260 };

  it('fica abaixo do item destacado, alinhado à esquerda dele', () => {
    expect(posicaoDoCartao({ top: 20, left: 300, width: 120, height: 30 }, cartao, janela)).toEqual(
      {
        top: 66,
        left: 300,
      },
    );
  });

  it('não sai pela direita da janela', () => {
    expect(
      posicaoDoCartao({ top: 20, left: 1300, width: 120, height: 30 }, cartao, janela).left,
    ).toBe(984);
  });

  it('vai para cima quando não cabe abaixo', () => {
    expect(
      posicaoDoCartao({ top: 800, left: 100, width: 120, height: 40 }, cartao, janela).top,
    ).toBe(524);
  });

  it('sem item visível, fica no meio da tela', () => {
    expect(posicaoDoCartao(null, cartao, { width: 390, height: 844 })).toEqual({
      top: 292,
      left: 16,
    });
  });
});
