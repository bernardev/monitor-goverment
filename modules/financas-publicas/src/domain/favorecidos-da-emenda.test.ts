import { violacoesDoContrato } from '@prometeu/contracts/esquemas';
import { Dinheiro, type DomainError, type Result } from '@prometeu/shared-kernel';
import { describe, expect, it } from 'vitest';

import { type Favorecido, FavorecidosDaEmenda, type Recebimento } from './favorecidos-da-emenda.js';
import { CapturaId } from './identificadores.js';

const AGORA = new Date('2026-10-30T12:00:00.000Z');

function valor<T>(resultado: Result<T, DomainError>): T {
  if (!resultado.ok) throw new Error(`${resultado.error.code}: ${resultado.error.message}`);
  return resultado.value;
}

const captura = (n: number) =>
  valor(CapturaId.de(`0192d5e0-1111-7000-8000-${String(n).padStart(12, '0')}`));
const reais = (centavos: number) => valor(Dinheiro.deCentavos(centavos));

const HOSPITAL: Favorecido = {
  tipo: 'pessoa_juridica',
  documento: '12345678000190',
  nome: 'HOSPITAL EXEMPLO',
  naturezaJuridica: 'Associação Privada',
  uf: 'SP',
  municipio: 'SÃO PAULO',
};
const BOLSISTAS: Favorecido = {
  tipo: 'pessoas_fisicas',
  documento: null,
  nome: null,
  naturezaJuridica: null,
  uf: 'SP',
  municipio: 'SÃO PAULO',
};

function recebimento(
  favorecido: Favorecido = HOSPITAL,
  mes = '2026-05',
  centavos = 50_000_000,
  quantidade = 1,
): Recebimento {
  return { mes, favorecido, quantidade, valor: reais(centavos) };
}

function registrar(recebimentos: readonly Recebimento[]) {
  return FavorecidosDaEmenda.registrar({
    codigoDaEmenda: '202690010001',
    recebimentos,
    captura: captura(1),
    agora: AGORA,
  });
}

function codigoDoErro(resultado: { ok: boolean; error?: { code: string } }): string | undefined {
  return resultado.ok ? undefined : resultado.error?.code;
}

describe('FavorecidosDaEmenda', () => {
  it('registra os recebimentos em ordem de mês, com os somados sem nome', () => {
    const favorecidos = valor(
      registrar([
        recebimento(HOSPITAL, '2026-06', 25_000_000),
        recebimento(BOLSISTAS, '2026-05', 180_050, 3),
        recebimento(HOSPITAL, '2026-05'),
      ]),
    );

    expect(favorecidos.recebimentos.map((r) => [r.mes, r.favorecido.tipo])).toEqual([
      ['2026-05', 'pessoa_juridica'],
      ['2026-05', 'pessoas_fisicas'],
      ['2026-06', 'pessoa_juridica'],
    ]);
    const [evento] = favorecidos.pullDomainEvents();
    expect(evento?.tipo).toBe('FavorecidosDaEmendaRegistrados');
    expect(evento?.dados).toMatchObject({
      codigoDaEmenda: '202690010001',
      recebimentos: [
        { mes: '2026-05', favorecido: HOSPITAL, quantidade: 1, valorCentavos: '50000000' },
        { mes: '2026-05', favorecido: BOLSISTAS, quantidade: 3, valorCentavos: '180050' },
        { mes: '2026-06', valorCentavos: '25000000' },
      ],
    });
  });

  it('aceita estorno: o recebido no mês pode ser negativo', () => {
    expect(registrar([recebimento(HOSPITAL, '2026-05', -204_872)]).ok).toBe(true);
  });

  it('não muda nada quando a fonte repete os mesmos recebimentos em outra ordem', () => {
    const favorecidos = valor(
      registrar([recebimento(HOSPITAL, '2026-05'), recebimento(BOLSISTAS, '2026-05', 100, 2)]),
    );
    favorecidos.pullDomainEvents();

    valor(
      favorecidos.atualizar(
        [recebimento(BOLSISTAS, '2026-05', 100, 2), recebimento(HOSPITAL, '2026-05')],
        captura(2),
        AGORA,
      ),
    );

    expect(favorecidos.pullDomainEvents()).toEqual([]);
    expect(favorecidos.captura.equals(captura(1))).toBe(true);
  });

  it('mês novo atualiza a lista com a nova captura', () => {
    const favorecidos = valor(registrar([recebimento(HOSPITAL, '2026-05')]));
    favorecidos.pullDomainEvents();

    valor(
      favorecidos.atualizar(
        [recebimento(HOSPITAL, '2026-05'), recebimento(HOSPITAL, '2026-06', 1_000)],
        captura(2),
        AGORA,
      ),
    );

    const [evento] = favorecidos.pullDomainEvents();
    expect(evento?.tipo).toBe('FavorecidosDaEmendaAtualizados');
    expect(favorecidos.recebimentos).toHaveLength(2);
    expect(favorecidos.captura.equals(captura(2))).toBe(true);
  });

  it.each([
    ['sem recebimento', [], 'favorecidos.sem_recebimento'],
    ['mês fora do formato', [recebimento(HOSPITAL, '2026-13')], 'favorecidos.mes_invalido'],
    ['mês futuro', [recebimento(HOSPITAL, '2026-11')], 'favorecidos.mes_invalido'],
    [
      'pessoa física com nome',
      [recebimento({ ...BOLSISTAS, nome: 'MARIA FICTICIA' }, '2026-05', 100, 1)],
      'favorecidos.somado_identificado',
    ],
    [
      'pessoa física com documento',
      [recebimento({ ...BOLSISTAS, documento: '***.111.222-**' }, '2026-05', 100, 1)],
      'favorecidos.somado_identificado',
    ],
    [
      'somado sem ninguém',
      [recebimento(BOLSISTAS, '2026-05', 100, 0)],
      'favorecidos.quantidade_invalida',
    ],
    [
      'pessoa jurídica sem CNPJ válido',
      [recebimento({ ...HOSPITAL, documento: '12.345.678/0001-90' })],
      'favorecidos.sem_identificacao',
    ],
    [
      'unidade gestora com CNPJ',
      [recebimento({ ...HOSPITAL, tipo: 'unidade_gestora' })],
      'favorecidos.sem_identificacao',
    ],
    [
      'identificado somado',
      [recebimento(HOSPITAL, '2026-05', 100, 2)],
      'favorecidos.quantidade_invalida',
    ],
    ['UF desconhecida', [recebimento({ ...HOSPITAL, uf: 'XX' })], 'favorecidos.uf_desconhecida'],
    [
      'o mesmo favorecido duas vezes no mês',
      [recebimento(HOSPITAL), recebimento(HOSPITAL, '2026-05', 1)],
      'favorecidos.recebimento_repetido',
    ],
  ] as const)('recusa %s', (_, recebimentos, erro) => {
    expect(codigoDoErro(registrar(recebimentos))).toBe(erro);
  });

  it('os eventos respeitam o contrato publicado', () => {
    const favorecidos = valor(
      registrar([
        recebimento(HOSPITAL),
        recebimento({ ...BOLSISTAS, uf: null, municipio: null }, '2026-05', -200, 1),
      ]),
    );
    valor(favorecidos.atualizar([recebimento(HOSPITAL, '2026-06')], captura(2), AGORA));

    const eventos = favorecidos.pullDomainEvents();
    expect(eventos.map((e) => e.tipo)).toEqual([
      'FavorecidosDaEmendaRegistrados',
      'FavorecidosDaEmendaAtualizados',
    ]);
    for (const evento of eventos) {
      expect(violacoesDoContrato(evento.tipo, evento.versao, evento.dados), evento.tipo).toEqual(
        [],
      );
    }
  });
});
