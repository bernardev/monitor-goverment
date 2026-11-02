import { describe, expect, it } from 'vitest';

import {
  dataPorExtenso,
  fraseDaInterrupcao,
  juntarFrases,
  periodoDaPresenca,
  resumirTexto,
  rotuloDeEmendas,
  rotuloDeObras,
  tituloDaManchete,
} from './capa';

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

describe('juntarFrases', () => {
  it('põe ponto onde falta e não duplica pontuação', () => {
    expect(juntarFrases('Votação de 1 de março', 'Resultado: aprovada.', 'Sobre o texto…')).toBe(
      'Votação de 1 de março. Resultado: aprovada. Sobre o texto…',
    );
  });
  it('ignora o que está vazio', () => {
    expect(juntarFrases('A', '', null, undefined, ' B ')).toBe('A. B.');
  });
});

describe('fraseDaInterrupcao', () => {
  const paralisada = {
    tipo: 'paralisada',
    em: '2026-03-06',
    justificativa: 'Falta de recursos.',
  } as const;
  it('diz quando parou e o motivo', () => {
    expect(fraseDaInterrupcao([paralisada])).toBe(
      'Parou em 6 de março de 2026. Motivo informado: Falta de recursos.',
    );
  });
  it('sem justificativa, diz que a fonte não informa', () => {
    expect(fraseDaInterrupcao([{ ...paralisada, justificativa: null }])).toBe(
      'Parou em 6 de março de 2026. A fonte não informa o motivo.',
    );
  });
  it('prefere a paralisação mais recente a outro tipo de interrupção', () => {
    const cancelada = { tipo: 'cancelada', em: '2026-09-01', justificativa: null } as const;
    expect(fraseDaInterrupcao([cancelada, paralisada])).toContain('Parou em 6 de março');
  });
  it('sem paralisação, usa o verbo do tipo que há', () => {
    const cancelada = { tipo: 'cancelada', em: '2026-09-01', justificativa: null } as const;
    expect(fraseDaInterrupcao([cancelada])).toBe(
      'Cancelada em 1 de setembro de 2026. A fonte não informa o motivo.',
    );
  });
  it('sem interrupção, não inventa frase', () => {
    expect(fraseDaInterrupcao([])).toBe('');
  });
});

describe('concordância dos totais', () => {
  it('emendas', () => {
    expect(rotuloDeEmendas(1)).toBe('emenda ao orçamento acompanhada');
    expect(rotuloDeEmendas(25131)).toBe('emendas ao orçamento acompanhadas');
  });
  it('obras concluídas', () => {
    expect(rotuloDeObras(1, 1)).toBe('obra concluída, de 1 com dinheiro de emenda');
    expect(rotuloDeObras(878, 10121)).toBe('obras concluídas, de 10.121 com dinheiro de emenda');
    expect(rotuloDeObras(0, 1)).toBe('obras concluídas, de 1 com dinheiro de emenda');
  });
});

describe('presença', () => {
  const fontes = [
    { fonte: 'senado', ultimaColetaEm: '2026-10-29T10:00:00Z', tabelas: [] },
    {
      fonte: 'camara',
      ultimaColetaEm: '2026-10-31T18:04:00Z',
      tabelas: [
        { tabela: 'camara_deputado', ultimaColetaEm: '2026-10-31T17:00:00Z' },
        { tabela: 'camara_frequencia_dia', ultimaColetaEm: '2026-10-31T15:50:00Z' },
      ],
    },
  ];
  it('usa a coleta da tabela de frequência da Câmara', () => {
    expect(periodoDaPresenca(fontes)).toBe('dias de sessão coletados até 31/10/2026');
  });
  it('sem a tabela, cai na última coleta da Câmara', () => {
    expect(periodoDaPresenca([{ ...fontes[1]!, tabelas: [] }])).toBe(
      'dias de sessão coletados até 31/10/2026',
    );
  });
  it('sem coleta ou sem a fonte, diz que não há dias coletados', () => {
    expect(periodoDaPresenca(undefined)).toBe('sem dias de sessão coletados');
    expect(periodoDaPresenca([fontes[0]!])).toBe('sem dias de sessão coletados');
  });
});
