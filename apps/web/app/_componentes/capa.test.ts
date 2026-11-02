import { describe, expect, it } from 'vitest';

import { dataPorExtenso, resumirTexto, tituloDaManchete } from './capa';

describe('dataPorExtenso', () => {
  it('escreve o dia da semana e a data completa', () => {
    expect(dataPorExtenso(new Date('2026-11-02T15:00:00Z'))).toBe(
      'segunda-feira, 2 de novembro de 2026',
    );
  });
  it('conta o dia no horário de Brasília, não em UTC', () => {
    expect(dataPorExtenso(new Date('2026-11-03T01:00:00Z'))).toBe(
      'segunda-feira, 2 de novembro de 2026',
    );
  });
});

const proposicao = (sigla: string, numero: number, ano: number) => ({
  sigla,
  numero,
  ano,
  ementa: '',
  codigoNaFonte: String(numero),
  proposicaoId: null,
});

describe('tituloDaManchete', () => {
  it('diz a casa e a proposição votada, sem afirmar o resultado', () => {
    expect(
      tituloDaManchete({
        casa: 'camara_dos_deputados',
        proposicoes: [proposicao('PLP', 281, 2019)],
      }),
    ).toBe('Votação no plenário da Câmara: PLP 281/2019');
  });
  it('conta as outras proposições', () => {
    expect(
      tituloDaManchete({
        casa: 'senado_federal',
        proposicoes: [proposicao('PL', 1, 2026), proposicao('PL', 2, 2026)],
      }),
    ).toBe('Votação no plenário do Senado: PL 1/2026 e outra');
    expect(
      tituloDaManchete({
        casa: 'senado_federal',
        proposicoes: [
          proposicao('PL', 1, 2026),
          proposicao('PL', 2, 2026),
          proposicao('PL', 3, 2026),
        ],
      }),
    ).toBe('Votação no plenário do Senado: PL 1/2026 e outras 2');
  });
  it('sem proposição, fica só a casa', () => {
    expect(tituloDaManchete({ casa: 'senado_federal', proposicoes: [] })).toBe(
      'Votação no plenário do Senado',
    );
  });
});

describe('resumirTexto', () => {
  it('deixa o texto curto como está', () => {
    expect(resumirTexto('Falta de recursos.', 50)).toBe('Falta de recursos.');
  });
  it('corta no espaço, sem deixar palavra pela metade nem pontuação antes das reticências', () => {
    expect(resumirTexto('Suspensão da liberação de recursos, conforme o ofício.', 30)).toBe(
      'Suspensão da liberação de…',
    );
  });
  it('junta quebras de linha', () => {
    expect(resumirTexto('a\n\n  b', 10)).toBe('a b');
  });
});
