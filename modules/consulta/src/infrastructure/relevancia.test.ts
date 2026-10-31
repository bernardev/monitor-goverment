import { describe, expect, it } from 'vitest';

import { relevancia, termos } from './relevancia.js';

describe('relevância de um fato para a promessa', () => {
  it('fica com as palavras que dizem do que o texto trata, pela raiz', () => {
    expect(termos('Construir 50 creches em São Paulo para as famílias').map((t) => t.raiz)).toEqual(
      ['constr', 'creche', 'paulo', 'famili'],
    );
  });

  it('é a parte das palavras da promessa que aparece no fato', () => {
    const promessa = termos('Construir creches e reformar escolas em Sapucaia do Sul');
    const fato = termos('Construção de creche no município de Sapucaia do Sul - RS');

    expect(relevancia(promessa, fato)).toEqual({
      relevancia: 0.6,
      termosEmComum: ['construir', 'creches', 'sapucaia'],
    });
    expect(relevancia(promessa, termos('Pavimentação asfáltica'))).toEqual({
      relevancia: 0,
      termosEmComum: [],
    });
    expect(relevancia([], fato).relevancia).toBe(0);
  });
});
