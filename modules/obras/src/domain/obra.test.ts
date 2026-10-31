import { violacoesDoContrato } from '@prometeu/contracts/esquemas';
import { Dinheiro, type DomainError, type Result } from '@prometeu/shared-kernel';
import { describe, expect, it } from 'vitest';

import { CapturaId } from './identificadores.js';
import { type ApuracaoDaObra, type EmendaDaObra, Obra } from './obra.js';

const AGORA = new Date('2026-10-31T12:00:00.000Z');

function valor<T>(resultado: Result<T, DomainError>): T {
  if (!resultado.ok) throw new Error(`${resultado.error.code}: ${resultado.error.message}`);
  return resultado.value;
}

const captura = (n: number) =>
  valor(CapturaId.de(`0192d5e0-1111-7000-8000-${String(n).padStart(12, '0')}`));
const reais = (centavos: number) => valor(Dinheiro.deCentavos(centavos));

function emenda(codigoDaEmenda = '202690010001', numero = '2026NE000123'): EmendaDaObra {
  return {
    codigoDaEmenda,
    ugEmitente: '257001',
    numeroDoEmpenho: numero,
    acaoOrcamentaria: '2172',
    empenhado: reais(48_110_437),
    emitidoEm: '2026-03-02',
  };
}

function apuracao(mudancas: Partial<ApuracaoDaObra> = {}): ApuracaoDaObra {
  return {
    nome: 'IMPLANTACAO UBS',
    descricao: null,
    natureza: 'Obra',
    especie: 'Construção',
    situacao: 'em_execucao',
    situacaoNaFonte: 'Em execução',
    uf: 'RS',
    municipios: [{ codigoIbge: '4320008', nome: 'Sapucaia do Sul' }],
    pontos: [{ latitude: '-29.84', longitude: '-51.13' }],
    endereco: 'AVENIDA EXEMPLO, 100',
    inicioPrevisto: '2026-01-10',
    fimPrevisto: '2027-06-30',
    inicioEfetivo: '2026-03-01',
    fimEfetivo: null,
    investimentoPrevisto: reais(20_000_010),
    executores: [{ nome: 'FUNDO MUNICIPAL DE SAUDE', cnpj: '11413810000196' }],
    medicao: { percentualCentesimos: 2335, em: '2026-10-21' },
    interrupcoes: [],
    emendas: [emenda()],
    ...mudancas,
  };
}

function registrar(a = apuracao(), idNaFonte = '151020.43-16') {
  return Obra.registrar({ idNaFonte, apuracao: a, captura: captura(1), agora: AGORA });
}

function codigoDoErro(resultado: { ok: boolean; error?: { code: string } }): string | undefined {
  return resultado.ok ? undefined : resultado.error?.code;
}

describe('Obra', () => {
  it('registra a obra com a medição e as emendas que a pagam', () => {
    const obra = valor(registrar(apuracao({ emendas: [emenda('202690020002'), emenda()] })));

    const [evento] = obra.pullDomainEvents();
    expect(evento?.tipo).toBe('ObraRegistrada');
    expect(evento?.dados).toMatchObject({
      idNaFonte: '151020.43-16',
      situacao: 'em_execucao',
      investimentoPrevistoCentavos: '20000010',
      medicao: { percentualCentesimos: 2335, em: '2026-10-21' },
      emendas: [
        { codigoDaEmenda: '202690010001', empenhadoCentavos: '48110437' },
        { codigoDaEmenda: '202690020002' },
      ],
    });
  });

  it('a mesma obra informada de novo, com listas em outra ordem, não vira evento', () => {
    const duas = [emenda('202690010001'), emenda('202690020002')];
    const obra = valor(registrar(apuracao({ emendas: duas })));
    obra.pullDomainEvents();

    valor(obra.atualizar(apuracao({ emendas: [...duas].reverse() }), captura(2), AGORA));

    expect(obra.pullDomainEvents()).toEqual([]);
    expect(obra.captura.equals(captura(1))).toBe(true);
  });

  it('medição nova atualiza a obra', () => {
    const obra = valor(registrar());
    obra.pullDomainEvents();

    valor(
      obra.atualizar(
        apuracao({ medicao: { percentualCentesimos: 4000, em: '2026-10-30' } }),
        captura(2),
        AGORA,
      ),
    );

    expect(obra.pullDomainEvents().map((e) => e.tipo)).toEqual(['ObraAtualizada']);
    expect(obra.apuracao.medicao?.percentualCentesimos).toBe(4000);
  });

  it('a passagem para paralisada vira também ObraParalisada, com a paralisação mais recente', () => {
    const obra = valor(registrar());
    obra.pullDomainEvents();
    const paralisada = apuracao({
      situacao: 'paralisada',
      situacaoNaFonte: 'Paralisada',
      interrupcoes: [
        { tipo: 'paralisada', em: '2026-09-21', justificativa: 'Solicitado pela empresa.' },
        { tipo: 'paralisada', em: '2025-01-10', justificativa: 'Chuvas.' },
      ],
    });

    valor(obra.atualizar(paralisada, captura(2), AGORA));
    const eventos = obra.pullDomainEvents();
    valor(obra.atualizar({ ...paralisada, endereco: 'OUTRO' }, captura(3), AGORA));

    expect(eventos.map((e) => e.tipo)).toEqual(['ObraAtualizada', 'ObraParalisada']);
    expect(eventos[1]?.dados).toEqual({
      idNaFonte: '151020.43-16',
      em: '2026-09-21',
      justificativa: 'Solicitado pela empresa.',
      emendas: ['202690010001'],
      capturaId: captura(2).valor,
    });
    // Já estava paralisada: outra mudança não repete a paralisação.
    expect(obra.pullDomainEvents().map((e) => e.tipo)).toEqual(['ObraAtualizada']);
  });

  it('aceita medição acima de 100%, como a fonte informa', () => {
    expect(registrar(apuracao({ medicao: { percentualCentesimos: 10_194, em: null } })).ok).toBe(
      true,
    );
  });

  it.each([
    ['identificador fora do formato', registrar(apuracao(), '151020'), 'obra.id_invalido'],
    ['sem nome', registrar(apuracao({ nome: ' ' })), 'obra.sem_nome'],
    ['sem emenda', registrar(apuracao({ emendas: [] })), 'obra.sem_emenda'],
    [
      'o mesmo empenho duas vezes',
      registrar(apuracao({ emendas: [emenda(), emenda()] })),
      'obra.empenho_repetido',
    ],
    [
      'código de emenda inválido',
      registrar(apuracao({ emendas: [emenda('2026')] })),
      'obra.emenda_invalida',
    ],
    ['data inexistente', registrar(apuracao({ fimPrevisto: '2027-02-30' })), 'obra.data_invalida'],
    [
      'início efetivo no futuro',
      registrar(apuracao({ inicioEfetivo: '2026-11-01' })),
      'obra.data_invalida',
    ],
    [
      'medição negativa',
      registrar(apuracao({ medicao: { percentualCentesimos: -1, em: null } })),
      'obra.valor_negativo',
    ],
    [
      'município desconhecido',
      registrar(apuracao({ municipios: [{ codigoIbge: '9900000', nome: null }] })),
      'obra.local_desconhecido',
    ],
    ['UF desconhecida', registrar(apuracao({ uf: 'XX' })), 'obra.local_desconhecido'],
  ])('recusa %s', (_, resultado, erro) => {
    expect(codigoDoErro(resultado)).toBe(erro);
  });

  it('os eventos respeitam o contrato publicado', () => {
    const obra = valor(registrar(apuracao({ medicao: null, uf: null, pontos: [] })));
    valor(
      obra.atualizar(
        apuracao({
          situacao: 'paralisada',
          situacaoNaFonte: 'Paralisada',
          interrupcoes: [{ tipo: 'paralisada', em: '2026-09-21', justificativa: null }],
        }),
        captura(2),
        AGORA,
      ),
    );

    const eventos = obra.pullDomainEvents();
    expect(eventos.map((e) => e.tipo)).toEqual([
      'ObraRegistrada',
      'ObraAtualizada',
      'ObraParalisada',
    ]);
    for (const evento of eventos) {
      expect(violacoesDoContrato(evento.tipo, evento.versao, evento.dados), evento.tipo).toEqual(
        [],
      );
    }
  });
});
