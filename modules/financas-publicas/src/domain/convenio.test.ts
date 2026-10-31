import { violacoesDoContrato } from '@prometeu/contracts/esquemas';
import { Dinheiro, type DomainError, type Result } from '@prometeu/shared-kernel';
import { describe, expect, it } from 'vitest';

import { type ApuracaoDoConvenio, Convenio, type EmendaDoConvenio } from './convenio.js';
import { CapturaId } from './identificadores.js';

const AGORA = new Date('2026-10-30T12:00:00.000Z');

function valor<T>(resultado: Result<T, DomainError>): T {
  if (!resultado.ok) throw new Error(`${resultado.error.code}: ${resultado.error.message}`);
  return resultado.value;
}

const captura = (n: number) =>
  valor(CapturaId.de(`0192d5e0-1111-7000-8000-${String(n).padStart(12, '0')}`));

function emenda(codigoDaEmenda = '202690010001', localidade = 'SÃO PAULO (UF)'): EmendaDoConvenio {
  return {
    codigoDaEmenda,
    funcao: { codigo: '10', nome: 'Saúde' },
    subfuncao: { codigo: '302', nome: 'Assistência hospitalar e ambulatorial' },
    localidade,
  };
}

function apuracao(mudancas: Partial<ApuracaoDoConvenio> = {}): ApuracaoDoConvenio {
  return {
    convenente: 'HOSPITAL EXEMPLO',
    objeto: 'AQUISICAO DE EQUIPAMENTO',
    publicadoEm: '2026-01-06',
    valor: valor(Dinheiro.deCentavos(145_000_000)),
    emendas: [emenda()],
    ...mudancas,
  };
}

function registrar(a = apuracao(), numero = '825378') {
  return Convenio.registrar({ numero, apuracao: a, captura: captura(1), agora: AGORA });
}

function codigoDoErro(resultado: { ok: boolean; error?: { code: string } }): string | undefined {
  return resultado.ok ? undefined : resultado.error?.code;
}

describe('Convenio', () => {
  it('registra o convênio com as emendas que o pagam', () => {
    const convenio = valor(
      registrar(apuracao({ emendas: [emenda('202690020002'), emenda('202690010001')] })),
    );

    const [evento] = convenio.pullDomainEvents();
    expect(evento?.tipo).toBe('ConvenioRegistrado');
    expect(evento?.dados).toMatchObject({
      numero: '825378',
      convenente: 'HOSPITAL EXEMPLO',
      publicadoEm: '2026-01-06',
      valorCentavos: '145000000',
      emendas: [{ codigoDaEmenda: '202690010001' }, { codigoDaEmenda: '202690020002' }],
    });
  });

  it('o mesmo convênio repetido pela fonte em outra ordem não vira evento', () => {
    const convenio = valor(
      registrar(apuracao({ emendas: [emenda('202690010001'), emenda('202690020002')] })),
    );
    convenio.pullDomainEvents();

    valor(
      convenio.atualizar(
        apuracao({ emendas: [emenda('202690020002'), emenda('202690010001')] }),
        captura(2),
        AGORA,
      ),
    );

    expect(convenio.pullDomainEvents()).toEqual([]);
  });

  it('um aditivo que muda o valor atualiza o convênio', () => {
    const convenio = valor(registrar());
    convenio.pullDomainEvents();

    valor(
      convenio.atualizar(
        apuracao({ valor: valor(Dinheiro.deCentavos(160_000_000)) }),
        captura(2),
        AGORA,
      ),
    );

    const [evento] = convenio.pullDomainEvents();
    expect(evento?.tipo).toBe('ConvenioAtualizado');
    expect(convenio.apuracao.valor.centavos).toBe(160_000_000n);
    expect(convenio.captura.equals(captura(2))).toBe(true);
  });

  it.each([
    ['número fora do formato', registrar(apuracao(), '825.378'), 'convenio.numero_invalido'],
    ['sem convenente', registrar(apuracao({ convenente: ' ' })), 'convenio.sem_convenente'],
    [
      'data inexistente',
      registrar(apuracao({ publicadoEm: '2026-02-31' })),
      'convenio.publicacao_invalida',
    ],
    [
      'publicação futura',
      registrar(apuracao({ publicadoEm: '2026-11-01' })),
      'convenio.publicacao_invalida',
    ],
    [
      'valor negativo',
      registrar(apuracao({ valor: valor(Dinheiro.deCentavos(-1)) })),
      'convenio.valor_negativo',
    ],
    ['sem emenda', registrar(apuracao({ emendas: [] })), 'convenio.sem_emenda'],
    [
      'a mesma emenda duas vezes',
      registrar(apuracao({ emendas: [emenda(), emenda()] })),
      'convenio.emenda_repetida',
    ],
  ])('recusa %s', (_, resultado, erro) => {
    expect(codigoDoErro(resultado)).toBe(erro);
  });

  it('os eventos respeitam o contrato publicado', () => {
    const convenio = valor(registrar(apuracao({ objeto: null })));
    valor(
      convenio.atualizar(
        apuracao({ emendas: [emenda(), emenda('202690020002', 'Nacional')] }),
        captura(2),
        AGORA,
      ),
    );

    const eventos = convenio.pullDomainEvents();
    expect(eventos.map((e) => e.tipo)).toEqual(['ConvenioRegistrado', 'ConvenioAtualizado']);
    for (const evento of eventos) {
      expect(violacoesDoContrato(evento.tipo, evento.versao, evento.dados), evento.tipo).toEqual(
        [],
      );
    }
  });
});
