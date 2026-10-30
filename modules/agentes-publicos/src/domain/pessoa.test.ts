import { CodigoIbge, type DomainError, type Result } from '@prometeu/shared-kernel';
import { describe, expect, it } from 'vitest';

import {
  AGORA,
  erro,
  LEGISLATURA_57,
  umaCaptura,
  umaPessoa,
  umMandato,
  valor,
} from '../testes/construtores.js';
import { type Cargo, cargoPertenceA } from './cargo.js';
import { IdentificadorExterno } from './identificador-externo.js';
import { NomePublico } from './nome-publico.js';
import { Pessoa } from './pessoa.js';
import { SiglaPartidaria } from './sigla-partidaria.js';
import { UrlPublica } from './url-publica.js';

const tipos = (pessoa: Pessoa) => pessoa.pullDomainEvents().map((e) => e.tipo);

describe('Pessoa', () => {
  it('nasce com identificador externo, filiação e a captura que prova os dados', () => {
    const pessoa = Pessoa.registrar({
      nome: valor(NomePublico.criar('  Ana   Exemplo ')),
      identificador: valor(IdentificadorExterno.criar('camara', '900001')),
      filiacao: undefined,
      foto: valor(UrlPublica.criar('https://camara.leg.br/foto.jpg')),
      captura: umaCaptura(),
      agora: AGORA,
    });

    const [evento] = pessoa.pullDomainEvents();
    expect(evento?.tipo).toBe('PessoaRegistrada');
    expect(evento?.dados).toEqual({
      nome: 'Ana Exemplo',
      siglaPartido: null,
      urlDaFoto: 'https://camara.leg.br/foto.jpg',
      identificadores: [{ fonte: 'camara', codigo: '900001' }],
      capturaId: umaCaptura().valor,
    });
  });

  it('só registra evento para o que realmente mudou', () => {
    const pessoa = umaPessoa();

    pessoa.atualizarNome(valor(NomePublico.criar('Ana Exemplo')), umaCaptura(), AGORA);
    pessoa.atualizarFiliacao(valor(SiglaPartidaria.criar('PEX')), umaCaptura(), AGORA);
    pessoa.atualizarFoto(undefined, umaCaptura(), AGORA);
    expect(tipos(pessoa)).toEqual([]);

    pessoa.atualizarNome(valor(NomePublico.criar('Ana Exemplo Silva')), umaCaptura(), AGORA);
    pessoa.atualizarFoto(
      valor(UrlPublica.criar('https://camara.leg.br/nova.jpg')),
      umaCaptura(),
      AGORA,
    );
    expect(tipos(pessoa)).toEqual(['NomePublicoAlterado', 'FotoOficialAlterada']);
  });

  it('troca de partido e desfiliação viram FiliacaoPartidariaAlterada', () => {
    const pessoa = umaPessoa();

    pessoa.atualizarFiliacao(valor(SiglaPartidaria.criar('PMO')), umaCaptura(), AGORA);
    pessoa.atualizarFiliacao(undefined, umaCaptura(), AGORA);

    expect(pessoa.pullDomainEvents().map((e) => e.dados)).toEqual([
      { de: 'PEX', para: 'PMO', capturaId: umaCaptura().valor },
      { de: 'PMO', para: null, capturaId: umaCaptura().valor },
    ]);
    expect(pessoa.filiacao).toBeUndefined();
  });

  describe('mandatos', () => {
    it('registra o mandato com cargo, ente e período', () => {
      const pessoa = umaPessoa();

      const id = valor(pessoa.registrarMandato(umMandato(), AGORA));

      const [evento] = pessoa.pullDomainEvents();
      expect(evento?.dados).toEqual({
        mandatoId: id.valor,
        cargo: 'deputado_federal',
        circunscricao: '35',
        inicio: '2023-02-01T03:00:00.000Z',
        fim: '2027-02-01T02:59:59.999Z',
        capturaId: umaCaptura().valor,
      });
    });

    it('o mesmo mandato informado de novo devolve o mesmo id, sem evento', () => {
      const pessoa = umaPessoa();
      const primeiro = valor(pessoa.registrarMandato(umMandato(), AGORA));
      pessoa.pullDomainEvents();

      const repetido = valor(pessoa.registrarMandato(umMandato(), AGORA));

      expect(repetido.equals(primeiro)).toBe(true);
      expect(tipos(pessoa)).toEqual([]);
      expect(pessoa.mandatos).toHaveLength(1);
    });

    it('recusa dois mandatos do mesmo cargo ao mesmo tempo', () => {
      const pessoa = umaPessoa();
      valor(pessoa.registrarMandato(umMandato(), AGORA));

      const outraUf = pessoa.registrarMandato(umMandato({ circunscricao: '33' }), AGORA);

      expect(erro(outraUf)).toBe('mandato.sobreposto');
    });

    it('aceita mandatos consecutivos e cargos diferentes no mesmo período', () => {
      const pessoa = umaPessoa();
      valor(pessoa.registrarMandato(umMandato(), AGORA));

      const seguinte = pessoa.registrarMandato(
        umMandato({
          inicio: new Date(LEGISLATURA_57.fim.getTime() + 1),
          fim: new Date('2031-02-01T02:59:59.999Z'),
        }),
        AGORA,
      );
      const outroCargo = pessoa.registrarMandato(
        umMandato({ cargo: 'vereador', circunscricao: '3550308' }),
        AGORA,
      );

      expect(seguinte.ok && outroCargo.ok).toBe(true);
    });

    it('recusa cargo eleito em outro tipo de ente', () => {
      const resultado = umaPessoa().registrarMandato(
        umMandato({ cargo: 'vereador', circunscricao: '35' }),
        AGORA,
      );
      expect(erro(resultado)).toBe('mandato.circunscricao_incompativel');
    });
  });

  describe('períodos de exercício informados pela fonte', () => {
    const POSSE = new Date('2023-02-01T15:05:00.000Z');
    const LICENCA = new Date('2026-03-31T21:00:00.000Z');
    const REASSUNCAO = new Date('2026-07-31T13:30:00.000Z');
    const exercicios = () => [
      umMandato({ inicio: REASSUNCAO }),
      umMandato({ inicio: POSSE, fim: LICENCA }),
    ];

    it('cada período vira um mandato, em ordem de posse', () => {
      const pessoa = umaPessoa();

      const ids = valor(pessoa.sincronizarMandatos(exercicios(), AGORA));

      expect(ids).toHaveLength(2);
      expect(pessoa.mandatos.map((m) => m.periodo.inicio)).toEqual([POSSE, REASSUNCAO]);
      expect(tipos(pessoa)).toEqual(['MandatoRegistrado', 'MandatoRegistrado']);
    });

    it('os mesmos períodos de novo não geram evento e devolvem os mesmos ids', () => {
      const pessoa = umaPessoa();
      const primeiros = valor(pessoa.sincronizarMandatos(exercicios(), AGORA));
      pessoa.pullDomainEvents();

      expect(valor(pessoa.sincronizarMandatos(exercicios(), AGORA))).toEqual(primeiros);
      expect(tipos(pessoa)).toEqual([]);
    });

    it('o mandato que cobria a legislatura inteira é retificado para o primeiro exercício', () => {
      const pessoa = umaPessoa();
      const antigo = valor(pessoa.registrarMandato(umMandato(), AGORA));
      pessoa.pullDomainEvents();

      const [primeiro, segundo] = valor(pessoa.sincronizarMandatos(exercicios(), AGORA));

      expect(primeiro).toEqual(antigo);
      expect(segundo?.equals(antigo)).toBe(false);
      const [retificado, registrado] = pessoa.pullDomainEvents();
      expect(retificado?.tipo).toBe('PeriodoDoMandatoRetificado');
      expect(retificado?.dados).toEqual({
        mandatoId: antigo.valor,
        inicio: POSSE.toISOString(),
        fim: LICENCA.toISOString(),
        inicioAnterior: LEGISLATURA_57.inicio.toISOString(),
        fimAnterior: LEGISLATURA_57.fim.toISOString(),
        capturaId: umaCaptura().valor,
      });
      expect(registrado?.tipo).toBe('MandatoRegistrado');
    });

    it('o suplente que sai tem o fim do exercício retificado', () => {
      const pessoa = umaPessoa();
      valor(pessoa.sincronizarMandatos([umMandato({ inicio: POSSE })], AGORA));
      pessoa.pullDomainEvents();

      valor(pessoa.sincronizarMandatos([umMandato({ inicio: POSSE, fim: LICENCA })], AGORA));

      expect(pessoa.mandatos.map((m) => m.periodo.fim)).toEqual([LICENCA]);
      expect(tipos(pessoa)).toEqual(['PeriodoDoMandatoRetificado']);
    });

    it.each([
      [
        'períodos sobrepostos entre si',
        () => [umMandato({ inicio: POSSE, fim: REASSUNCAO }), umMandato({ inicio: LICENCA })],
        [],
      ],
      [
        'período que toca dois mandatos registrados',
        () => [umMandato({ inicio: POSSE })],
        [umMandato({ inicio: POSSE, fim: LICENCA }), umMandato({ inicio: REASSUNCAO })],
      ],
      [
        'período em outro ente que toca um mandato registrado',
        () => [umMandato({ inicio: POSSE, circunscricao: '33' })],
        [umMandato()],
      ],
    ])('recusa %s', (_caso, periodos, registrados) => {
      const pessoa = umaPessoa();
      for (const mandato of registrados) valor(pessoa.registrarMandato(mandato, AGORA));

      expect(erro(pessoa.sincronizarMandatos(periodos(), AGORA))).toBe('mandato.sobreposto');
    });
  });
});

describe('cargoPertenceA', () => {
  it.each<[Cargo, string, boolean]>([
    ['presidente', '0', true],
    ['presidente', '35', false],
    ['deputado_federal', '35', true],
    ['deputado_federal', '53', true],
    ['deputado_federal', '5300108', false],
    ['deputado_federal', '0', false],
    ['deputado_estadual', '35', true],
    ['deputado_estadual', '53', false],
    ['deputado_distrital', '53', true],
    ['deputado_distrital', '35', false],
    ['vereador', '3550308', true],
    ['vereador', '5300108', false],
    ['prefeito', '35', false],
  ])('%s em %s: %s', (cargo, ente, esperado) => {
    expect(cargoPertenceA(cargo, valor(CodigoIbge.criar(ente)))).toBe(esperado);
  });
});

describe('objetos de valor', () => {
  it.each<[() => Result<unknown, DomainError>, string]>([
    [() => NomePublico.criar(' '), 'pessoa.nome_vazio'],
    [() => NomePublico.criar('x'.repeat(121)), 'pessoa.nome_longo'],
    [() => SiglaPartidaria.criar(''), 'pessoa.sigla_partidaria_invalida'],
    [() => SiglaPartidaria.criar('<script>'), 'pessoa.sigla_partidaria_invalida'],
    [() => UrlPublica.criar('javascript:alert(1)'), 'url.invalida'],
    [() => IdentificadorExterno.criar('wikipedia', '1'), 'identificador.fonte_desconhecida'],
    [() => IdentificadorExterno.criar('camara', ' '), 'identificador.codigo_vazio'],
  ])('recusa entrada inválida (%#)', (criar, codigo) => {
    expect(erro(criar())).toBe(codigo);
  });

  it.each(['PCdoB', 'PC do B', 'S.PART.', 'PT'])('aceita a sigla %s', (sigla) => {
    expect(valor(SiglaPartidaria.criar(sigla)).valor).toBe(sigla);
  });
});
