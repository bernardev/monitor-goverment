import { violacoesDoContrato } from '@prometeu/contracts/esquemas';
import { Dinheiro, type DomainError, type Result } from '@prometeu/shared-kernel';
import { describe, expect, it } from 'vitest';

import { type ApuracaoDaEmenda, type Destinacao, Emenda, type Execucao } from './emenda.js';
import { CapturaId, PessoaId } from './identificadores.js';

const AGORA = new Date('2026-10-30T12:00:00.000Z');

function valor<T>(resultado: Result<T, DomainError>): T {
  if (!resultado.ok) throw new Error(`${resultado.error.code}: ${resultado.error.message}`);
  return resultado.value;
}

const captura = (n: number) =>
  valor(CapturaId.de(`0192d5e0-1111-7000-8000-${String(n).padStart(12, '0')}`));
const ANA = valor(PessoaId.de('0192d5e0-4444-7000-8000-00000000000a'));
const reais = (centavos: number) => valor(Dinheiro.deCentavos(centavos));

function execucao(mudancas: Partial<Record<keyof Execucao, number>> = {}): Execucao {
  return {
    empenhado: reais(mudancas.empenhado ?? 150_000_000),
    liquidado: reais(mudancas.liquidado ?? 100_000_000),
    pago: reais(mudancas.pago ?? 75_000_000),
    restosInscritos: reais(mudancas.restosInscritos ?? 0),
    restosCancelados: reais(mudancas.restosCancelados ?? 0),
    restosPagos: reais(mudancas.restosPagos ?? 0),
  };
}

const classificacao = (codigo: string, nome: string) => ({ codigo, nome });

function destinacao(acao = '2E90', mudancas: Partial<Destinacao> = {}): Destinacao {
  return {
    localidade: 'SÃO PAULO - SP',
    municipioIbge: '3550308',
    ufIbge: '3500000',
    funcao: classificacao('10', 'Saúde'),
    subfuncao: classificacao('302', 'Assistência hospitalar e ambulatorial'),
    programa: classificacao('5118', 'ATENÇÃO ESPECIALIZADA À SAÚDE'),
    acao: classificacao(acao, 'INCREMENTO TEMPORÁRIO'),
    planoOrcamentario: classificacao('0000', 'DIVERSAS'),
    execucao: execucao(),
    ...mudancas,
  };
}

function apuracao(mudancas: Partial<ApuracaoDaEmenda> = {}): ApuracaoDaEmenda {
  return {
    ano: 2026,
    tipo: 'individual',
    numero: '0001',
    autor: { pessoa: ANA, nomeNaFonte: 'ANA EXEMPLO', codigoNaFonte: '9001' },
    destinacoes: [destinacao('2E90'), destinacao('00SX')],
    ...mudancas,
  };
}

function registrar(a = apuracao(), codigoNaFonte = '202690010001') {
  return Emenda.registrar({ codigoNaFonte, apuracao: a, captura: captura(1), agora: AGORA });
}

function codigoDoErro(resultado: { ok: boolean; error?: { code: string } }): string | undefined {
  return resultado.ok ? undefined : resultado.error?.code;
}

describe('Emenda', () => {
  it('registra a emenda com autor, destinações e execução em centavos', () => {
    const emenda = valor(registrar());

    const [evento] = emenda.pullDomainEvents();
    expect(evento?.tipo).toBe('EmendaRegistrada');
    expect(evento?.dados).toMatchObject({
      codigoNaFonte: '202690010001',
      ano: 2026,
      tipo: 'individual',
      autor: { pessoaId: ANA.valor, nomeNaFonte: 'ANA EXEMPLO' },
      destinacoes: [
        { acao: { codigo: '2E90' }, empenhadoCentavos: '150000000', pagoCentavos: '75000000' },
        { acao: { codigo: '00SX' } },
      ],
    });
  });

  it('soma a execução das destinações', () => {
    const total = valor(registrar()).total();

    expect(total.empenhado.centavos).toBe(300_000_000n);
    expect(total.pago.centavos).toBe(150_000_000n);
  });

  it('valores novos da fonte: a execução foi atualizada', () => {
    const emenda = valor(registrar());
    emenda.pullDomainEvents();

    valor(
      emenda.atualizar(
        apuracao({
          destinacoes: [
            destinacao('2E90', { execucao: execucao({ pago: 150_000_000 }) }),
            destinacao('00SX'),
          ],
        }),
        captura(2),
        AGORA,
      ),
    );

    expect(emenda.pullDomainEvents().map((e) => e.tipo)).toEqual(['ExecucaoDaEmendaAtualizada']);
    expect(emenda.total().pago.centavos).toBe(225_000_000n);
  });

  it('destino corrigido pela fonte: retificação', () => {
    const emenda = valor(registrar());
    emenda.pullDomainEvents();

    valor(emenda.atualizar(apuracao({ destinacoes: [destinacao('2E90')] }), captura(2), AGORA));

    expect(emenda.pullDomainEvents().map((e) => e.tipo)).toEqual(['EmendaRetificada']);
  });

  it('a mesma apuração de novo, com as destinações em outra ordem, não vira evento', () => {
    const emenda = valor(registrar());
    emenda.pullDomainEvents();

    valor(
      emenda.atualizar(
        apuracao({ destinacoes: [destinacao('00SX'), destinacao('2E90')] }),
        captura(2),
        AGORA,
      ),
    );

    expect(emenda.pullDomainEvents()).toEqual([]);
    expect(emenda.captura).toEqual(captura(1));
  });

  it('restos a pagar cancelados podem ser estorno (negativo)', () => {
    const estorno = destinacao('2E90', { execucao: execucao({ restosCancelados: -500_000 }) });

    expect(registrar(apuracao({ destinacoes: [estorno] })).ok).toBe(true);
  });

  it.each([
    ['emenda.ano_invalido', apuracao({ ano: 2028 })],
    ['emenda.ano_invalido', apuracao({ ano: 1999 })],
    ['emenda.sem_destinacao', apuracao({ destinacoes: [] })],
    ['emenda.destinacao_repetida', apuracao({ destinacoes: [destinacao(), destinacao()] })],
    [
      'emenda.valor_negativo',
      apuracao({ destinacoes: [destinacao('2E90', { execucao: execucao({ pago: -1 }) })] }),
    ],
    [
      'emenda.autor_coletivo_com_pessoa',
      apuracao({
        tipo: 'bancada',
        autor: { pessoa: ANA, nomeNaFonte: 'BANCADA DA BAHIA', codigoNaFonte: '7106' },
      }),
    ],
    [
      'emenda.autor_sem_nome',
      apuracao({ autor: { pessoa: undefined, nomeNaFonte: ' ', codigoNaFonte: '9001' } }),
    ],
  ])('recusa %s', (codigo, a) => {
    expect(codigoDoErro(registrar(a))).toBe(codigo);
  });

  it('recusa código que não é o do Portal', () => {
    expect(codigoDoErro(registrar(apuracao(), 'Sem informação'))).toBe('emenda.codigo_invalido');
  });
});

describe('eventos da emenda respeitam os contratos publicados', () => {
  it('registrada, execução atualizada e retificada (packages/contracts/eventos)', () => {
    const emenda = valor(
      registrar(
        apuracao({
          tipo: 'bancada',
          autor: { pessoa: undefined, nomeNaFonte: 'BANCADA DA BAHIA', codigoNaFonte: '7106' },
          destinacoes: [destinacao('2E90', { municipioIbge: null, ufIbge: null })],
        }),
      ),
    );
    valor(
      emenda.atualizar(
        apuracao({
          tipo: 'bancada',
          autor: { pessoa: undefined, nomeNaFonte: 'BANCADA DA BAHIA', codigoNaFonte: '7106' },
          destinacoes: [
            destinacao('2E90', {
              municipioIbge: null,
              ufIbge: null,
              execucao: execucao({ restosCancelados: -10 }),
            }),
          ],
        }),
        captura(2),
        AGORA,
      ),
    );
    valor(emenda.atualizar(apuracao(), captura(3), AGORA));

    const eventos = emenda.pullDomainEvents();
    expect(eventos.map((e) => e.tipo)).toEqual([
      'EmendaRegistrada',
      'ExecucaoDaEmendaAtualizada',
      'EmendaRetificada',
    ]);
    for (const evento of eventos) {
      expect(violacoesDoContrato(evento.tipo, evento.versao, evento.dados), evento.tipo).toEqual(
        [],
      );
    }
  });
});
