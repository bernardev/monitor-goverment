import { describe, expect, it } from 'vitest';

import { erro, umMandato, umaCandidatura, umaPessoa, valor } from '../testes/construtores.js';
import { AutorDaPromessa } from './autor-da-promessa.js';
import { PessoaId, PromessaId } from './identificadores.js';
import { Meta } from './meta.js';
import { Tema } from './tema.js';
import { TextoCanonico } from './texto-canonico.js';
import { Trecho } from './trecho.js';
import { podeTransitar } from './veredito.js';

describe('TextoCanonico', () => {
  it('normaliza espaços e recusa vazio ou longo demais', () => {
    expect(valor(TextoCanonico.criar('  Construir   500\ncreches ')).valor).toBe(
      'Construir 500 creches',
    );
    expect(erro(TextoCanonico.criar('   '))).toBe('promessa.texto_vazio');
    expect(erro(TextoCanonico.criar('a'.repeat(501)))).toBe('promessa.texto_longo');
  });
});

describe('Tema', () => {
  it('aceita só código em minúsculas sem acento', () => {
    expect(valor(Tema.criar('seguranca_publica')).codigo).toBe('seguranca_publica');
    expect(erro(Tema.criar('Saúde'))).toBe('promessa.tema_invalido');
  });
});

describe('Meta', () => {
  it('exige descrição e prazo válido', () => {
    expect(valor(Meta.criar('500 creches', new Date('2028-12-31'))).descricao).toBe('500 creches');
    expect(erro(Meta.criar(''))).toBe('meta.descricao_vazia');
    expect(erro(Meta.criar('500 creches', new Date('invalida')))).toBe('meta.prazo_invalido');
  });
});

describe('Trecho', () => {
  it('valida página e intervalo de tempo', () => {
    expect(erro(Trecho.criar('', { tipo: 'pagina', pagina: 1 }))).toBe('trecho.citacao_vazia');
    expect(erro(Trecho.criar('Frase.', { tipo: 'pagina', pagina: 0 }))).toBe(
      'trecho.pagina_invalida',
    );
    expect(
      erro(
        Trecho.criar('Frase.', {
          tipo: 'intervalo_de_tempo',
          inicioEmSegundos: 60,
          fimEmSegundos: 60,
        }),
      ),
    ).toBe('trecho.intervalo_invalido');
  });

  it('compara a localização independentemente da citação', () => {
    const a = valor(Trecho.criar('Frase A.', { tipo: 'pagina', pagina: 3 }));
    const b = valor(Trecho.criar('Frase B.', { tipo: 'pagina', pagina: 3 }));
    const video = valor(
      Trecho.criar('Frase A.', {
        tipo: 'intervalo_de_tempo',
        inicioEmSegundos: 3,
        fimEmSegundos: 9,
      }),
    );
    expect(a.estaNoMesmoLugarQue(b)).toBe(true);
    expect(a.equals(b)).toBe(false);
    expect(a.estaNoMesmoLugarQue(video)).toBe(false);
  });
});

describe('AutorDaPromessa', () => {
  it('precisa de candidatura ou mandato', () => {
    expect(erro(AutorDaPromessa.criar({ pessoa: umaPessoa() }))).toBe(
      'autor.sem_candidatura_nem_mandato',
    );
    expect(AutorDaPromessa.criar({ pessoa: umaPessoa(), candidatura: umaCandidatura() }).ok).toBe(
      true,
    );
    expect(AutorDaPromessa.criar({ pessoa: umaPessoa(), mandato: umMandato() }).ok).toBe(true);
  });
});

describe('Identificadores', () => {
  it('validam o formato e não se confundem entre tipos', () => {
    const texto = PromessaId.gerar().valor;
    expect(valor(PromessaId.de(texto)).valor).toBe(texto);
    expect(erro(PessoaId.de('123'))).toBe('identificador.invalido');
    // Mesmo texto, tipos diferentes: não são iguais.
    expect(valor(PessoaId.de(texto)).equals(valor(PromessaId.de(texto)))).toBe(false);
  });
});

describe('Máquina de estados do veredito', () => {
  it.each([
    ['nao_iniciada', 'em_andamento', true],
    ['nao_iniciada', 'cumprida', false],
    ['em_andamento', 'travada', true],
    ['travada', 'em_andamento', true],
    ['travada', 'cumprida', false],
    ['cumprida_parcialmente', 'cumprida', true],
    ['cumprida', 'em_andamento', false],
    ['nao_cumprida', 'em_andamento', false],
  ] as const)('%s → %s: %s', (de, para, permitido) => {
    expect(podeTransitar(de, para)).toBe(permitido);
  });
});
