import { violacoesDoContrato } from '@prometeu/contracts/esquemas';
import { describe, expect, it } from 'vitest';

import {
  AGORA,
  umaApuracaoDeVotacao,
  umaCaptura,
  umaVotacao,
  umMandato,
  umVoto,
  valor,
} from '../testes/construtores.js';
import { DiaDeSessao } from './dia-de-sessao.js';
import { type ApuracaoDaVotacao, VotacaoNominal } from './votacao-nominal.js';

function registrar(apuracao: ApuracaoDaVotacao, codigoNaFonte = '900100-10') {
  return VotacaoNominal.registrar({
    casa: 'camara_dos_deputados',
    codigoNaFonte,
    apuracao,
    captura: umaCaptura(1),
    capturaDosVotos: umaCaptura(2),
    agora: AGORA,
  });
}

function codigoDoErro(resultado: { ok: boolean; error?: { code: string } }): string | undefined {
  return resultado.ok ? undefined : resultado.error?.code;
}

describe('VotacaoNominal', () => {
  it('registra a votação com cada voto ligado ao mandato e as duas capturas', () => {
    const votacao = umaVotacao();

    const [evento] = votacao.pullDomainEvents();
    expect(evento?.tipo).toBe('VotacaoNominalRegistrada');
    expect(evento?.dados).toMatchObject({
      casa: 'camara_dos_deputados',
      codigoNaFonte: '900100-10',
      dia: '2026-10-14',
      resultado: 'aprovada',
      secreta: false,
      capturaId: umaCaptura(1).valor,
      capturaDosVotosId: umaCaptura(2).valor,
    });
    expect(votacao.votos.map((v) => [v.pessoa.valor, v.mandato.valor, v.opcao])).toEqual([
      [umMandato(1).pessoa.valor, umMandato(1).mandato.valor, 'sim'],
      [umMandato(2).pessoa.valor, umMandato(2).mandato.valor, 'nao'],
      [umMandato(3).pessoa.valor, umMandato(3).mandato.valor, 'presidente_da_sessao'],
    ]);
  });

  it('conta o placar por opção', () => {
    const votacao = umaVotacao(
      umaApuracaoDeVotacao([umVoto(1, 'sim'), umVoto(2, 'sim'), umVoto(3, 'obstrucao')]),
    );

    expect(votacao.placar()).toEqual({
      sim: 2,
      nao: 0,
      abstencao: 0,
      obstrucao: 1,
      presidente_da_sessao: 0,
      secreto: 0,
    });
  });

  it('votação secreta: todos votaram, ninguém sabe como', () => {
    const votacao = umaVotacao(umaApuracaoDeVotacao([umVoto(1, 'secreto'), umVoto(2, 'secreto')]));

    expect(votacao.secreta).toBe(true);
    expect(votacao.pullDomainEvents()[0]?.dados).toMatchObject({ secreta: true });
  });

  it.each([
    ['votacao.sem_votos', () => umaApuracaoDeVotacao([])],
    ['votacao.voto_repetido', () => umaApuracaoDeVotacao([umVoto(1, 'sim'), umVoto(1, 'nao')])],
    [
      'votacao.sigilo_parcial',
      () => umaApuracaoDeVotacao([umVoto(1, 'secreto'), umVoto(2, 'sim')]),
    ],
    [
      'votacao.voto_sem_registro',
      () => umaApuracaoDeVotacao([{ ...umVoto(1, 'sim'), registroNaFonte: ' ' }]),
    ],
    [
      'votacao.voto_fora_do_mandato',
      () =>
        umaApuracaoDeVotacao([
          { ...umVoto(1), mandato: { ...umMandato(1), fim: new Date('2026-10-14T03:00:00Z') } },
        ]),
    ],
    ['votacao.sem_descricao', () => ({ ...umaApuracaoDeVotacao(), descricao: '  ' })],
    [
      'votacao.futura',
      () => ({ ...umaApuracaoDeVotacao(), dia: valor(DiaDeSessao.de('2026-10-31')) }),
    ],
  ])('recusa %s', (codigo, apuracao) => {
    expect(codigoDoErro(registrar(apuracao()))).toBe(codigo);
  });

  it('recusa votação sem o código da fonte', () => {
    expect(codigoDoErro(registrar(umaApuracaoDeVotacao(), ' '))).toBe('votacao.sem_codigo');
  });

  it('a mesma apuração de novo, com os votos em outra ordem, não vira evento', () => {
    const votacao = umaVotacao();
    votacao.pullDomainEvents();
    const embaralhada = umaApuracaoDeVotacao([
      umVoto(3, 'presidente_da_sessao'),
      umVoto(1, 'sim'),
      umVoto(2, 'nao'),
    ]);

    valor(votacao.retificar(embaralhada, umaCaptura(3), umaCaptura(4), AGORA));

    expect(votacao.pullDomainEvents()).toEqual([]);
    expect(votacao.captura).toEqual(umaCaptura(1));
  });

  it('a correção da casa vira VotacaoNominalRetificada, com as novas capturas', () => {
    const votacao = umaVotacao();
    votacao.pullDomainEvents();

    valor(
      votacao.retificar(
        umaApuracaoDeVotacao([umVoto(1, 'sim'), umVoto(2, 'abstencao')]),
        umaCaptura(3),
        umaCaptura(4),
        AGORA,
      ),
    );

    const [evento] = votacao.pullDomainEvents();
    expect(evento?.tipo).toBe('VotacaoNominalRetificada');
    expect(evento?.dados).toMatchObject({
      capturaId: umaCaptura(3).valor,
      capturaDosVotosId: umaCaptura(4).valor,
    });
    expect(votacao.placar()).toMatchObject({ sim: 1, abstencao: 1, nao: 0 });
  });

  it('não retifica com uma apuração inválida', () => {
    const votacao = umaVotacao();

    const resultado = votacao.retificar(
      umaApuracaoDeVotacao([]),
      umaCaptura(3),
      umaCaptura(4),
      AGORA,
    );

    expect(codigoDoErro(resultado)).toBe('votacao.sem_votos');
    expect(votacao.votos).toHaveLength(3);
  });
});

describe('eventos da votação nominal respeitam os contratos publicados', () => {
  it('registrada e retificada (packages/contracts/eventos)', () => {
    const votacao = umaVotacao();
    valor(
      votacao.retificar(
        umaApuracaoDeVotacao([umVoto(1, 'secreto'), umVoto(2, 'secreto')]),
        umaCaptura(3),
        umaCaptura(4),
        AGORA,
      ),
    );

    const eventos = votacao.pullDomainEvents();
    expect(eventos.map((e) => e.tipo)).toEqual([
      'VotacaoNominalRegistrada',
      'VotacaoNominalRetificada',
    ]);
    for (const evento of eventos) {
      expect(violacoesDoContrato(evento.tipo, evento.versao, evento.dados), evento.tipo).toEqual(
        [],
      );
    }
  });
});
