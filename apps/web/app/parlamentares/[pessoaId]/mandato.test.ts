import { describe, expect, it } from 'vitest';

import { emExercicio, textoDoMandato } from './mandato';

const HOJE = new Date('2026-11-02T12:00:00Z');

describe('emExercicio', () => {
  it('sem fim, o mandato segue', () => {
    expect(emExercicio(null, HOJE)).toBe(true);
  });
  it('com fim no futuro (fim da legislatura), segue em exercício', () => {
    expect(emExercicio('2027-01-31T00:00:00Z', HOJE)).toBe(true);
  });
  it('com fim no passado, não está mais em exercício', () => {
    expect(emExercicio('2023-01-31T00:00:00Z', HOJE)).toBe(false);
  });
});

describe('textoDoMandato', () => {
  it('com fim, mostra o período inteiro', () => {
    expect(textoDoMandato('2023-02-01T12:00:00Z', '2027-01-31T12:00:00Z')).toBe(
      'mandato de 1 de fevereiro de 2023 a 31 de janeiro de 2027',
    );
  });
  it('sem fim, mostra desde quando', () => {
    expect(textoDoMandato('2023-02-01T12:00:00Z', null)).toBe(
      'mandato desde 1 de fevereiro de 2023',
    );
  });
});
