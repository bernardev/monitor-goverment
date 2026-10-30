import { violacoesDoContrato } from '@prometeu/contracts/esquemas';
import { describe, expect, it } from 'vitest';

import {
  AGORA,
  ausencia,
  ausenciaJustificada,
  presenca,
  umaCaptura,
  umMandato,
  umRegistro,
  valor,
} from '../testes/construtores.js';
import { DiaDeSessao } from './dia-de-sessao.js';
import { MotivoDaAusencia } from './motivo-da-ausencia.js';
import { type Apuracao, RegistroDeFrequencia } from './registro-de-frequencia.js';

function registrar(apuracao: Apuracao, dia = '2026-10-06') {
  return RegistroDeFrequencia.registrar({
    casa: 'camara_dos_deputados',
    dia: valor(DiaDeSessao.de(dia)),
    mandato: umMandato(),
    apuracao,
    captura: umaCaptura(),
    agora: AGORA,
  });
}

function codigoDoErro(resultado: { ok: boolean; error?: { code: string } }): string | undefined {
  return resultado.ok ? undefined : resultado.error?.code;
}

describe('RegistroDeFrequencia', () => {
  it('presença vira PresencaRegistrada', () => {
    const eventos = umRegistro(presenca()).pullDomainEvents();

    expect(eventos.map((e) => e.tipo)).toEqual(['PresencaRegistrada']);
    expect(eventos[0]?.dados).toMatchObject({
      casa: 'camara_dos_deputados',
      dia: '2026-10-06',
      situacao: 'presente',
      motivo: null,
    });
  });

  it('ausência justificada vira AusenciaRegistrada com o motivo e as palavras da fonte', () => {
    const [evento] = umRegistro(ausenciaJustificada()).pullDomainEvents();

    expect(evento?.tipo).toBe('AusenciaRegistrada');
    expect(evento?.dados).toMatchObject({
      situacao: 'ausencia_justificada',
      motivo: { categoria: 'missao_autorizada', descricaoNaFonte: 'Missão Autorizada' },
      registroNaFonte: 'Ausência justificada',
    });
  });

  it.each([
    [
      'justificada sem motivo',
      { ...ausenciaJustificada(), motivo: undefined },
      'frequencia.justificativa_sem_motivo',
    ],
    [
      'falta comum com motivo',
      { ...ausencia(), motivo: ausenciaJustificada().motivo },
      'frequencia.motivo_sem_justificativa',
    ],
    ['dia sem sessão', { ...presenca(), sessoes: [] }, 'frequencia.sem_sessao'],
    [
      'sem a grafia da fonte',
      { ...presenca(), registroNaFonte: ' ' },
      'frequencia.sem_registro_na_fonte',
    ],
  ])('recusa %s', (_, apuracao: Apuracao, codigo) => {
    expect(codigoDoErro(registrar(apuracao))).toBe(codigo);
  });

  it('recusa dia que ainda não começou em Brasília', () => {
    expect(codigoDoErro(registrar(presenca(), '2026-10-31'))).toBe('frequencia.dia_futuro');
  });

  it('recusa dia fora do mandato', () => {
    expect(codigoDoErro(registrar(presenca(), '2023-01-31'))).toBe('frequencia.fora_do_mandato');
  });

  it('aceita o dia da posse e o da saída, mesmo com o mandato cobrindo só parte do dia', () => {
    // Suplente empossado às 17h13 de 16/06 e afastado às 18h de 15/10 (Brasília).
    const mandato = {
      ...umMandato(),
      inicio: new Date('2026-06-16T20:13:00.000Z'),
      fim: new Date('2026-10-15T21:00:00.000Z'),
    };
    const registrarNoDia = (dia: string) =>
      RegistroDeFrequencia.registrar({
        casa: 'camara_dos_deputados',
        dia: valor(DiaDeSessao.de(dia)),
        mandato,
        apuracao: presenca(),
        captura: umaCaptura(),
        agora: AGORA,
      });

    expect(registrarNoDia('2026-06-16').ok).toBe(true);
    expect(registrarNoDia('2026-10-15').ok).toBe(true);
    expect(codigoDoErro(registrarNoDia('2026-06-15'))).toBe('frequencia.fora_do_mandato');
    expect(codigoDoErro(registrarNoDia('2026-10-16'))).toBe('frequencia.fora_do_mandato');
  });

  it('a justificativa que chega depois vira FrequenciaRetificada, com a nova captura', () => {
    const registro = umRegistro(ausencia());
    registro.pullDomainEvents();

    valor(registro.retificar(ausenciaJustificada(), umaCaptura(2), AGORA));

    const [evento] = registro.pullDomainEvents();
    expect(evento?.tipo).toBe('FrequenciaRetificada');
    expect(evento?.dados).toMatchObject({
      situacaoAnterior: 'ausente',
      situacao: 'ausencia_justificada',
      capturaId: umaCaptura(2).valor,
    });
    expect(registro.captura.equals(umaCaptura(2))).toBe(true);
  });

  it('a mesma apuração de novo não gera evento nem troca a captura', () => {
    const registro = umRegistro(ausenciaJustificada());
    registro.pullDomainEvents();

    valor(registro.retificar(ausenciaJustificada(), umaCaptura(2), AGORA));

    expect(registro.pullDomainEvents()).toEqual([]);
    expect(registro.captura.equals(umaCaptura())).toBe(true);
  });

  it('mudança só no texto do motivo também é retificação', () => {
    const registro = umRegistro(ausenciaJustificada());
    registro.pullDomainEvents();

    valor(
      registro.retificar(
        ausenciaJustificada('Missão autorizada no exterior'),
        umaCaptura(2),
        AGORA,
      ),
    );

    expect(registro.pullDomainEvents().map((e) => e.tipo)).toEqual(['FrequenciaRetificada']);
  });

  it('retificação inválida não muda o registro', () => {
    const registro = umRegistro(ausencia());

    const resultado = registro.retificar(
      { ...ausenciaJustificada(), motivo: undefined },
      umaCaptura(2),
      AGORA,
    );

    expect(resultado.ok).toBe(false);
    expect(registro.apuracao.situacao).toBe('ausente');
  });
});

describe('objetos de valor', () => {
  it.each(['2026-02-30', '06/10/2026', '2026-10-6', ''])('dia inválido: "%s"', (dia) => {
    expect(DiaDeSessao.de(dia).ok).toBe(false);
  });

  it('o dia começa à meia-noite de Brasília, 3h em UTC', () => {
    const dia = valor(DiaDeSessao.de('2026-10-30'));
    expect(dia.jaComecou(new Date('2026-10-30T02:59:59.999Z'))).toBe(false);
    expect(dia.jaComecou(new Date('2026-10-30T03:00:00.000Z'))).toBe(true);
  });

  it('motivo exige categoria conhecida e as palavras da fonte', () => {
    expect(MotivoDaAusencia.criar('ferias', 'Férias').ok).toBe(false);
    expect(MotivoDaAusencia.criar('outro', '   ').ok).toBe(false);
    expect(valor(MotivoDaAusencia.criar('outro', ' Motivo   novo ')).descricaoNaFonte).toBe(
      'Motivo novo',
    );
  });
});

describe('eventos de Atividade Legislativa respeitam os contratos publicados', () => {
  it('todos os tipos emitidos (packages/contracts/eventos)', () => {
    const presente = umRegistro(presenca());
    const retificado = umRegistro(ausencia());
    valor(retificado.retificar(ausenciaJustificada(), umaCaptura(2), AGORA));

    const eventos = [...presente.pullDomainEvents(), ...retificado.pullDomainEvents()];
    expect(new Set(eventos.map((e) => e.tipo))).toEqual(
      new Set(['PresencaRegistrada', 'AusenciaRegistrada', 'FrequenciaRetificada']),
    );
    for (const evento of eventos) {
      expect(violacoesDoContrato(evento.tipo, evento.versao, evento.dados), evento.tipo).toEqual(
        [],
      );
    }
  });
});
