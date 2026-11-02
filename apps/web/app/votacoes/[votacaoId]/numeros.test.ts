import { textoDaContagem } from '@prometeu/ui';
import { describe, expect, it } from 'vitest';

import { numerosDaVotacao, textoDosVotos } from './numeros';

const placar = {
  sim: 300,
  nao: 120,
  abstencao: 4,
  obstrucao: 1,
  presidente_da_sessao: 1,
  secreto: 0,
};

describe('numerosDaVotacao', () => {
  it('traz sim, não e os outros votos, cada um com o dia da votação', () => {
    const numeros = numerosDaVotacao({ placar, secreta: false, dia: '2026-03-12' });
    expect(numeros.map((n) => n.valor)).toEqual(['300', '120', '6']);
    expect(numeros.map((n) => n.rotulo)).toEqual([
      'votos sim',
      'votos não',
      'outros registros (abstenção, obstrução ou presidente da sessão)',
    ]);
    expect(new Set(numeros.map((n) => n.periodo))).toEqual(new Set(['em 12 de março de 2026']));
  });

  it('o valor é o texto final da contagem, o mesmo que o servidor entrega sem JavaScript', () => {
    for (const n of numerosDaVotacao({ placar, secreta: false, dia: '2026-03-12' })) {
      expect(n.contagem).toBeDefined();
      expect(n.valor).toBe(textoDaContagem(n.contagem!, 1));
    }
  });

  it('usa o singular com um voto', () => {
    const [sim] = numerosDaVotacao({
      placar: { ...placar, sim: 1 },
      secreta: false,
      dia: '2026-03-12',
    });
    expect(sim?.rotulo).toBe('voto sim');
  });

  it('votação secreta não tem faixa: a casa não diz como cada um votou', () => {
    expect(
      numerosDaVotacao({ placar: { ...placar, secreto: 80 }, secreta: true, dia: '2026-03-12' }),
    ).toEqual([]);
  });
});

describe('textoDosVotos', () => {
  it('conta os nomes da lista da casa, sem chamar de placar', () => {
    expect(textoDosVotos({ secreta: false, nomes: 503 })).toBe(
      '503 nomes na lista de votos da casa, com o partido do dia da votação.',
    );
    expect(textoDosVotos({ secreta: false, nomes: 1 })).toContain('1 nome na lista');
  });

  it('votação secreta com nomes: diz quem votou, sem o voto de cada um', () => {
    expect(textoDosVotos({ secreta: true, nomes: 67 })).toBe(
      '67 parlamentares na lista de quem votou; o voto de cada um é secreto.',
    );
  });

  it('votação secreta sem nomes: diz que o voto foi secreto, não "0 parlamentares"', () => {
    const texto = textoDosVotos({ secreta: true, nomes: 0 });
    expect(texto).toBe('Votação secreta: a casa não informa o voto de cada um.');
    expect(texto).not.toContain('0 parlamentares');
  });

  it('votação aberta sem nenhum nome diz que a lista veio vazia', () => {
    expect(textoDosVotos({ secreta: false, nomes: 0 })).toBe(
      'A lista de votos da casa não traz nenhum nome.',
    );
  });
});
