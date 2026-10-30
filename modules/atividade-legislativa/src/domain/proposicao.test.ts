import { violacoesDoContrato } from '@prometeu/contracts/esquemas';
import { describe, expect, it } from 'vitest';

import { AGORA, umaCaptura, umMandato, valor } from '../testes/construtores.js';
import { type ApuracaoDaProposicao, Proposicao, type Tramitacao } from './proposicao.js';

const ato = (dia: string, descricao: string, situacao: string | null = null): Tramitacao => ({
  em: new Date(`${dia}T13:00:00.000Z`),
  orgao: 'CCJC',
  descricao,
  situacao,
  despacho: null,
});

const APRESENTACAO = ato('2026-03-02', 'Apresentação de Proposição');
const PARECER = ato('2026-10-20', 'Parecer do Relator', 'Aguardando Parecer');
const PAUTA = ato('2026-10-28', 'Inclusão na Ordem do Dia', 'Pronta para Pauta');

function umaApuracao(mudancas: Partial<ApuracaoDaProposicao> = {}): ApuracaoDaProposicao {
  return {
    sigla: 'PL',
    numero: 901,
    ano: 2026,
    ementa: 'Dispõe sobre um tema fictício.',
    apresentadaEm: new Date('2026-03-02T13:00:00.000Z'),
    autores: [
      {
        pessoa: umMandato(1).pessoa,
        nomeNaFonte: 'Ana Exemplo',
        tipoNaFonte: 'Deputado(a)',
        proponente: true,
      },
      {
        pessoa: undefined,
        nomeNaFonte: 'Poder Executivo',
        tipoNaFonte: 'Órgão do Poder Executivo',
        proponente: true,
      },
    ],
    situacao: { descricao: 'Aguardando Parecer', desde: PARECER.em, orgao: 'CCJC' },
    tramitacoes: [APRESENTACAO, PARECER],
    normaGerada: null,
    urlDoTexto: 'https://www.camara.leg.br/proposicoesWeb/prop_mostrarintegra?codteor=1',
    ...mudancas,
  };
}

function registrar(apuracao = umaApuracao(), codigoNaFonte = '900301') {
  return Proposicao.registrar({
    casa: 'camara_dos_deputados',
    codigoNaFonte,
    apuracao,
    captura: umaCaptura(1),
    agora: AGORA,
  });
}

function codigoDoErro(resultado: { ok: boolean; error?: { code: string } }): string | undefined {
  return resultado.ok ? undefined : resultado.error?.code;
}

describe('Proposicao', () => {
  it('registra a proposição com autoria, situação e tramitação', () => {
    const proposicao = valor(registrar());

    const [evento] = proposicao.pullDomainEvents();
    expect(evento?.tipo).toBe('ProposicaoRegistrada');
    expect(evento?.dados).toMatchObject({
      casa: 'camara_dos_deputados',
      codigoNaFonte: '900301',
      sigla: 'PL',
      numero: 901,
      autores: [
        { pessoaId: umMandato(1).pessoa.valor, nomeNaFonte: 'Ana Exemplo' },
        { pessoaId: null, nomeNaFonte: 'Poder Executivo' },
      ],
      situacao: { descricao: 'Aguardando Parecer', orgao: 'CCJC' },
      capturaId: umaCaptura(1).valor,
    });
  });

  it('atos novos depois dos já conhecidos: a tramitação avançou', () => {
    const proposicao = valor(registrar());
    proposicao.pullDomainEvents();

    valor(
      proposicao.atualizar(
        umaApuracao({
          tramitacoes: [APRESENTACAO, PARECER, PAUTA],
          situacao: { descricao: 'Pronta para Pauta', desde: PAUTA.em, orgao: 'CCJC' },
        }),
        umaCaptura(2),
        AGORA,
      ),
    );

    const [evento] = proposicao.pullDomainEvents();
    expect(evento?.tipo).toBe('TramitacaoAvancou');
    expect(evento?.dados).toMatchObject({ novasTramitacoes: 1, capturaId: umaCaptura(2).valor });
  });

  it('a casa corrige o que já tinha publicado: retificação', () => {
    const proposicao = valor(registrar());
    proposicao.pullDomainEvents();

    valor(
      proposicao.atualizar(
        umaApuracao({ tramitacoes: [APRESENTACAO, { ...PARECER, despacho: 'Corrigido.' }] }),
        umaCaptura(2),
        AGORA,
      ),
    );

    expect(proposicao.pullDomainEvents().map((e) => e.tipo)).toEqual(['ProposicaoRetificada']);
  });

  it('a mesma apuração de novo não vira evento', () => {
    const proposicao = valor(registrar());
    proposicao.pullDomainEvents();

    valor(proposicao.atualizar(umaApuracao(), umaCaptura(2), AGORA));

    expect(proposicao.pullDomainEvents()).toEqual([]);
    expect(proposicao.captura).toEqual(umaCaptura(1));
  });

  it.each([
    ['proposicao.numero_invalido', umaApuracao({ numero: 0 })],
    ['proposicao.ano_invalido', umaApuracao({ ano: 2027 })],
    ['proposicao.futura', umaApuracao({ apresentadaEm: new Date('2026-11-01T00:00:00Z') })],
    ['proposicao.tramitacao_fora_de_ordem', umaApuracao({ tramitacoes: [PARECER, APRESENTACAO] })],
    [
      'proposicao.tramitacao_fora_de_ordem',
      umaApuracao({ tramitacoes: [APRESENTACAO, ato('2026-11-15', 'Futuro')] }),
    ],
    [
      'proposicao.tramitacao_sem_descricao',
      umaApuracao({ tramitacoes: [{ ...APRESENTACAO, descricao: ' ' }] }),
    ],
    [
      'proposicao.autor_repetido',
      umaApuracao({
        autores: [
          { pessoa: umMandato(1).pessoa, nomeNaFonte: 'Ana', tipoNaFonte: 'x', proponente: true },
          { pessoa: umMandato(1).pessoa, nomeNaFonte: 'Ana', tipoNaFonte: 'x', proponente: false },
        ],
      }),
    ],
  ])('recusa %s', (codigo, apuracao) => {
    expect(codigoDoErro(registrar(apuracao))).toBe(codigo);
  });

  it('recusa proposição sem o código da fonte', () => {
    expect(codigoDoErro(registrar(umaApuracao(), ' '))).toBe('proposicao.sem_codigo');
  });
});

describe('eventos da proposição respeitam os contratos publicados', () => {
  it('registrada, avançou e retificada (packages/contracts/eventos)', () => {
    const proposicao = valor(registrar(umaApuracao({ situacao: null, ementa: null })));
    valor(
      proposicao.atualizar(
        umaApuracao({ tramitacoes: [APRESENTACAO, PARECER, PAUTA] }),
        umaCaptura(2),
        AGORA,
      ),
    );
    valor(
      proposicao.atualizar(
        umaApuracao({ tramitacoes: [APRESENTACAO, PARECER, PAUTA], normaGerada: 'Lei nº 1' }),
        umaCaptura(3),
        AGORA,
      ),
    );

    const eventos = proposicao.pullDomainEvents();
    expect(eventos.map((e) => e.tipo)).toEqual([
      'ProposicaoRegistrada',
      'TramitacaoAvancou',
      'ProposicaoRetificada',
    ]);
    for (const evento of eventos) {
      expect(violacoesDoContrato(evento.tipo, evento.versao, evento.dados), evento.tipo).toEqual(
        [],
      );
    }
  });
});
