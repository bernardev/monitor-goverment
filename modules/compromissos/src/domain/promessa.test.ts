import { describe, expect, it } from 'vitest';

import {
  HOJE,
  ONTEM,
  erro,
  umAlvo,
  umCurador,
  umaCaptura,
  umaFonte,
  umaPromessa,
  valor,
} from '../testes/construtores.js';
import { Trecho } from './trecho.js';

const AMANHA = new Date('2027-06-02T12:00:00Z');

describe('Promessa: registro e fontes', () => {
  it('nasce prometida, não iniciada, com a fonte e o evento de registro', () => {
    const fonte = umaFonte();
    const promessa = umaPromessa().comFonte(fonte).build();

    expect(promessa.estagio).toBe('prometida');
    expect(promessa.vereditoVigente).toBe('nao_iniciada');
    expect(promessa.fontes).toHaveLength(1);
    expect(promessa.fontes[0]?.captura.equals(fonte.captura)).toBe(true);
  });

  it('não aceita fonte com declaração no futuro', () => {
    const promessa = umaPromessa().build();
    const resultado = promessa.adicionarFonte(
      umaFonte({ dataDaDeclaracao: AMANHA }),
      umCurador(),
      HOJE,
    );
    expect(erro(resultado)).toBe('fonte.data_no_futuro');
  });

  it('acumula fontes novas e recusa o mesmo ponto da mesma captura', () => {
    const fonte = umaFonte();
    const promessa = umaPromessa().comFonte(fonte).build();

    const debate = umaFonte({
      tipo: 'debate',
      trecho: valor(
        Trecho.criar('Vou fazer as creches.', {
          tipo: 'intervalo_de_tempo',
          inicioEmSegundos: 2472,
          fimEmSegundos: 2507,
        }),
      ),
    });
    valor(promessa.adicionarFonte(debate, umCurador(), HOJE));
    expect(promessa.pullDomainEvents().map((e) => e.tipo)).toEqual(['FonteAdicionada']);

    const mesmaPagina = umaFonte({
      captura: fonte.captura,
      trecho: valor(Trecho.criar('Outra redação da citação.', { tipo: 'pagina', pagina: 12 })),
    });
    expect(erro(promessa.adicionarFonte(mesmaPagina, umCurador(), HOJE))).toBe('fonte.duplicada');
    expect(promessa.fontes).toHaveLength(2);
  });
});

describe('Promessa: vínculos e estágio', () => {
  it('sugestão não muda o estágio (invariante 2)', () => {
    const promessa = umaPromessa().build();
    valor(
      promessa.sugerirVinculo(
        {
          alvo: umAlvo('proposicao'),
          estagioQueComprova: 'ato',
          origem: 'sugestao_ia',
          evidencias: [umaCaptura()],
        },
        HOJE,
      ),
    );

    expect(promessa.estagio).toBe('prometida');
    expect(promessa.pullDomainEvents().map((e) => e.tipo)).toEqual(['VinculoSugerido']);
  });

  it('confirmação avança o estágio até o vínculo mais avançado', () => {
    const promessa = umaPromessa().build();
    const ato = valor(
      promessa.sugerirVinculo(
        {
          alvo: umAlvo('proposicao'),
          estagioQueComprova: 'ato',
          origem: 'curador',
          evidencias: [umaCaptura()],
        },
        HOJE,
      ),
    );
    const execucao = valor(
      promessa.sugerirVinculo(
        {
          alvo: umAlvo('obra'),
          estagioQueComprova: 'execucao',
          origem: 'curador',
          evidencias: [umaCaptura()],
        },
        HOJE,
      ),
    );
    promessa.pullDomainEvents();

    valor(promessa.confirmarVinculo(execucao, umCurador(), HOJE));
    valor(promessa.confirmarVinculo(ato, umCurador(), HOJE));

    expect(promessa.estagio).toBe('execucao');
    const eventos = promessa.pullDomainEvents();
    expect(eventos.map((e) => e.tipo)).toEqual([
      'VinculoConfirmado',
      'EstagioDaPromessaAvancou',
      'VinculoConfirmado',
    ]);
    expect(eventos[1]?.dados).toEqual({ de: 'prometida', para: 'execucao' });
  });

  it('desfazer uma confirmação faz o estágio recuar e exige motivo', () => {
    const promessa = umaPromessa().build();
    const pl = valor(
      promessa.sugerirVinculo(
        {
          alvo: umAlvo('proposicao'),
          estagioQueComprova: 'ato',
          origem: 'curador',
          evidencias: [umaCaptura()],
        },
        HOJE,
      ),
    );
    valor(promessa.confirmarVinculo(pl, umCurador(), HOJE));
    promessa.pullDomainEvents();

    expect(erro(promessa.rejeitarVinculo(pl, umCurador(), '  ', HOJE))).toBe(
      'vinculo.rejeicao_sem_motivo',
    );

    valor(promessa.rejeitarVinculo(pl, umCurador(), 'PL arquivado ao fim da legislatura.', HOJE));
    expect(promessa.estagio).toBe('prometida');
    const eventos = promessa.pullDomainEvents();
    expect(eventos.map((e) => e.tipo)).toEqual(['VinculoRejeitado', 'EstagioDaPromessaRecuou']);
    expect(eventos[0]?.dados).toMatchObject({ estavaConfirmado: true });
  });

  it('não confirma vínculo já decidido nem inexistente', () => {
    const promessa = umaPromessa().build();
    const id = valor(
      promessa.sugerirVinculo(
        {
          alvo: umAlvo('emenda'),
          estagioQueComprova: 'orcamento',
          origem: 'sugestao_ia',
          evidencias: [umaCaptura()],
        },
        HOJE,
      ),
    );
    valor(promessa.rejeitarVinculo(id, umCurador(), 'Emenda de outro município.', HOJE));

    expect(erro(promessa.confirmarVinculo(id, umCurador(), HOJE))).toBe(
      'vinculo.nao_esta_sugerido',
    );
    const outra = umaPromessa().build();
    expect(erro(outra.confirmarVinculo(id, umCurador(), HOJE))).toBe('vinculo.nao_encontrado');
  });

  it('recusa vínculo duplicado, sem evidência ou com estágio que o fato não comprova', () => {
    const promessa = umaPromessa().build();
    const alvo = umAlvo('obra');
    valor(
      promessa.sugerirVinculo(
        { alvo, estagioQueComprova: 'execucao', origem: 'curador', evidencias: [umaCaptura()] },
        HOJE,
      ),
    );

    const duplicado = promessa.sugerirVinculo(
      { alvo, estagioQueComprova: 'entrega', origem: 'curador', evidencias: [umaCaptura()] },
      HOJE,
    );
    const semEvidencia = promessa.sugerirVinculo(
      { alvo: umAlvo('obra'), estagioQueComprova: 'entrega', origem: 'curador', evidencias: [] },
      HOJE,
    );
    const plComoEntrega = promessa.sugerirVinculo(
      {
        alvo: umAlvo('proposicao'),
        estagioQueComprova: 'entrega',
        origem: 'curador',
        evidencias: [umaCaptura()],
      },
      HOJE,
    );

    expect(erro(duplicado)).toBe('vinculo.duplicado');
    expect(erro(semEvidencia)).toBe('vinculo.sem_evidencia');
    expect(erro(plComoEntrega)).toBe('vinculo.estagio_incompativel');
  });

  it('um fato rejeitado pode ser sugerido de novo', () => {
    const promessa = umaPromessa().build();
    const alvo = umAlvo('proposicao');
    const novo = {
      alvo,
      estagioQueComprova: 'ato',
      origem: 'sugestao_ia',
      evidencias: [umaCaptura()],
    } as const;
    const primeiro = valor(promessa.sugerirVinculo(novo, HOJE));
    valor(promessa.rejeitarVinculo(primeiro, umCurador(), 'Sugestão sem relação.', HOJE));

    expect(promessa.sugerirVinculo(novo, HOJE).ok).toBe(true);
  });
});

describe('Promessa: veredito', () => {
  it('veredito não sensível pode ser publicado pelo próprio curador', () => {
    const promessa = umaPromessa().build();
    const curador = umCurador();
    valor(
      promessa.proporVeredito({
        veredito: 'em_andamento',
        justificativa: 'Edital das creches publicado.',
        evidencias: [umaCaptura()],
        propostoPor: curador,
        propostoEm: HOJE,
      }),
    );
    expect(promessa.vereditoVigente).toBe('nao_iniciada');

    valor(promessa.publicarVeredito(curador, HOJE));
    expect(promessa.vereditoVigente).toBe('em_andamento');
    expect(promessa.propostaPendente).toBeUndefined();
    expect(promessa.pullDomainEvents().map((e) => e.tipo)).toEqual([
      'VereditoProposto',
      'VereditoPublicado',
    ]);
  });

  it('veredito sensível exige revisor diferente do curador (invariante 3)', () => {
    const promessa = umaPromessa().comVereditosPublicados('em_andamento').build();
    const curador = umCurador();
    valor(
      promessa.proporVeredito({
        veredito: 'cumprida',
        justificativa: 'As 500 creches foram inauguradas.',
        evidencias: [umaCaptura()],
        propostoPor: curador,
        propostoEm: HOJE,
      }),
    );

    expect(erro(promessa.publicarVeredito(curador, HOJE))).toBe(
      'veredito.revisor_igual_ao_curador',
    );
    const revisor = umCurador();
    valor(promessa.publicarVeredito(revisor, HOJE));

    const [registro] = promessa.historicoDeVereditos.slice(-1);
    expect(registro?.veredito).toBe('cumprida');
    expect(registro?.propostoPor.equals(curador)).toBe(true);
    expect(registro?.revisadoPor.equals(revisor)).toBe(true);
  });

  it('todo veredito precisa de justificativa e evidência', () => {
    const promessa = umaPromessa().build();
    const base = { veredito: 'em_andamento', propostoPor: umCurador(), propostoEm: HOJE } as const;

    expect(
      erro(promessa.proporVeredito({ ...base, justificativa: ' ', evidencias: [umaCaptura()] })),
    ).toBe('veredito.sem_justificativa');
    expect(erro(promessa.proporVeredito({ ...base, justificativa: 'Ok.', evidencias: [] }))).toBe(
      'veredito.sem_evidencia',
    );
  });

  it('segue a máquina de estados: não pula de não iniciada para cumprida', () => {
    const promessa = umaPromessa().build();
    const resultado = promessa.proporVeredito({
      veredito: 'cumprida',
      justificativa: 'Entregue.',
      evidencias: [umaCaptura()],
      propostoPor: umCurador(),
      propostoEm: HOJE,
    });
    expect(erro(resultado)).toBe('veredito.transicao_invalida');
  });

  it('só uma proposta pendente por vez; recusar libera uma nova', () => {
    const promessa = umaPromessa().build();
    const proposta = {
      veredito: 'em_andamento',
      justificativa: 'Licitação aberta.',
      evidencias: [umaCaptura()],
      propostoPor: umCurador(),
      propostoEm: HOJE,
    } as const;
    valor(promessa.proporVeredito(proposta));

    expect(erro(promessa.proporVeredito(proposta))).toBe('veredito.proposta_pendente');
    expect(erro(promessa.recusarVeredito(umCurador(), '', HOJE))).toBe(
      'veredito.recusa_sem_motivo',
    );
    valor(promessa.recusarVeredito(umCurador(), 'A licitação foi anulada.', HOJE));
    expect(promessa.propostaPendente).toBeUndefined();
    expect(promessa.proporVeredito(proposta).ok).toBe(true);
  });

  it('publicar ou recusar sem proposta pendente falha', () => {
    const promessa = umaPromessa().build();
    expect(erro(promessa.publicarVeredito(umCurador(), HOJE))).toBe('veredito.sem_proposta');
    expect(erro(promessa.recusarVeredito(umCurador(), 'Motivo.', HOJE))).toBe(
      'veredito.sem_proposta',
    );
  });

  it('promessa genérica não recebe cumprida (invariante 6)', () => {
    const promessa = umaPromessa().generica().comVereditosPublicados('em_andamento').build();
    const resultado = promessa.proporVeredito({
      veredito: 'cumprida',
      justificativa: 'Melhorou a saúde.',
      evidencias: [umaCaptura()],
      propostoPor: umCurador(),
      propostoEm: HOJE,
    });
    expect(erro(resultado)).toBe('veredito.promessa_generica');
  });
});

describe('Promessa: não cumprida (invariante 4)', () => {
  const proposta = {
    veredito: 'nao_cumprida',
    justificativa: 'Mandato terminou sem nenhuma creche entregue.',
    propostoPor: umCurador(),
    propostoEm: HOJE,
  } as const;

  it('exige fundamento', () => {
    const promessa = umaPromessa().comVereditosPublicados('em_andamento').build();
    expect(erro(promessa.proporVeredito({ ...proposta, evidencias: [umaCaptura()] }))).toBe(
      'veredito.nao_cumprida_sem_fundamento',
    );
  });

  it('com mandato encerrado é aceita; com mandato em curso, não', () => {
    const promessa = umaPromessa().comVereditosPublicados('em_andamento').build();
    expect(
      erro(
        promessa.proporVeredito({
          ...proposta,
          evidencias: [umaCaptura()],
          fundamento: { tipo: 'mandato_encerrado', encerradoEm: AMANHA },
        }),
      ),
    ).toBe('veredito.mandato_em_curso');

    valor(
      promessa.proporVeredito({
        ...proposta,
        evidencias: [umaCaptura()],
        fundamento: { tipo: 'mandato_encerrado', encerradoEm: ONTEM },
      }),
    );
    valor(promessa.publicarVeredito(umCurador(), HOJE));
    expect(promessa.vereditoVigente).toBe('nao_cumprida');
  });

  it('com ato em sentido contrário, a captura do ato precisa estar nas evidências', () => {
    const promessa = umaPromessa().build();
    const decretoContrario = umaCaptura();

    expect(
      erro(
        promessa.proporVeredito({
          ...proposta,
          evidencias: [umaCaptura()],
          fundamento: { tipo: 'ato_em_sentido_contrario', evidencia: decretoContrario },
        }),
      ),
    ).toBe('veredito.ato_contrario_fora_das_evidencias');

    expect(
      promessa.proporVeredito({
        ...proposta,
        evidencias: [decretoContrario],
        fundamento: { tipo: 'ato_em_sentido_contrario', evidencia: decretoContrario },
      }).ok,
    ).toBe(true);
  });

  it('cumprida parcialmente só vira não cumprida no fim do mandato', () => {
    const promessa = umaPromessa()
      .comVereditosPublicados('em_andamento', 'cumprida_parcialmente')
      .build();
    const atoContrario = umaCaptura();
    const resultado = promessa.proporVeredito({
      ...proposta,
      evidencias: [atoContrario],
      fundamento: { tipo: 'ato_em_sentido_contrario', evidencia: atoContrario },
    });
    expect(erro(resultado)).toBe('veredito.parcial_so_no_fim_do_mandato');
  });

  it('fundamento só vale para não cumprida', () => {
    const promessa = umaPromessa().build();
    const resultado = promessa.proporVeredito({
      ...proposta,
      veredito: 'em_andamento',
      evidencias: [umaCaptura()],
      fundamento: { tipo: 'mandato_encerrado', encerradoEm: ONTEM },
    });
    expect(erro(resultado)).toBe('veredito.fundamento_inesperado');
  });
});

describe('Promessa: errata (invariante 5)', () => {
  it('corrige um veredito final com novo registro, sem apagar o anterior', () => {
    const promessa = umaPromessa().comVereditosPublicados('em_andamento', 'cumprida').build();
    const [, cumprida] = promessa.historicoDeVereditos;
    const curador = umCurador();

    valor(
      promessa.proporVeredito({
        veredito: 'em_andamento',
        justificativa: 'Só 120 das 500 creches foram entregues; a contagem anterior estava errada.',
        evidencias: [umaCaptura()],
        errata: true,
        propostoPor: curador,
        propostoEm: HOJE,
      }),
    );
    expect(erro(promessa.publicarVeredito(curador, HOJE))).toBe(
      'veredito.revisor_igual_ao_curador',
    );
    valor(promessa.publicarVeredito(umCurador(), HOJE));

    const historico = promessa.historicoDeVereditos;
    expect(historico.map((r) => r.veredito)).toEqual(['em_andamento', 'cumprida', 'em_andamento']);
    expect(historico[2]?.corrige?.equals(cumprida?.id)).toBe(true);
    expect(promessa.vereditoVigente).toBe('em_andamento');
  });

  it('sem veredito publicado não há o que corrigir; errata precisa mudar o veredito', () => {
    const base = {
      justificativa: 'Correção.',
      evidencias: [umaCaptura()],
      errata: true,
      propostoPor: umCurador(),
      propostoEm: HOJE,
    } as const;

    const nova = umaPromessa().build();
    expect(erro(nova.proporVeredito({ ...base, veredito: 'em_andamento' }))).toBe(
      'veredito.nada_a_corrigir',
    );

    const andando = umaPromessa().comVereditosPublicados('em_andamento').build();
    expect(erro(andando.proporVeredito({ ...base, veredito: 'em_andamento' }))).toBe(
      'veredito.errata_sem_mudanca',
    );
  });

  it('o histórico exposto é uma cópia: não dá para apagar registros por fora', () => {
    const promessa = umaPromessa().comVereditosPublicados('em_andamento').build();
    (promessa.historicoDeVereditos as unknown[]).pop();
    expect(promessa.historicoDeVereditos).toHaveLength(1);
  });
});

describe('Promessa: reavaliação quando o fato vinculado muda', () => {
  function comObraConfirmada() {
    const promessa = umaPromessa().build();
    const obra = umAlvo('obra');
    const vinculo = valor(
      promessa.sugerirVinculo(
        {
          alvo: obra,
          estagioQueComprova: 'execucao',
          origem: 'curador',
          evidencias: [umaCaptura()],
        },
        HOJE,
      ),
    );
    valor(promessa.confirmarVinculo(vinculo, umCurador(), HOJE));
    promessa.pullDomainEvents();
    return { promessa, obra, vinculo };
  }

  it('só fato com vínculo confirmado pede reavaliação', () => {
    const promessa = umaPromessa().build();
    const obra = umAlvo('obra');
    valor(
      promessa.sugerirVinculo(
        {
          alvo: obra,
          estagioQueComprova: 'execucao',
          origem: 'curador',
          evidencias: [umaCaptura()],
        },
        HOJE,
      ),
    );

    expect(erro(promessa.solicitarReavaliacao(obra, 'Parou.', umaCaptura(), HOJE))).toBe(
      'reavaliacao.sem_vinculo_confirmado',
    );
  });

  it('o pedido fica pendente sem mexer no estágio, e o mesmo motivo não se repete', () => {
    const { promessa, obra } = comObraConfirmada();

    expect(valor(promessa.solicitarReavaliacao(obra, ' A obra parou. ', umaCaptura(), HOJE))).toBe(
      true,
    );
    expect(valor(promessa.solicitarReavaliacao(obra, 'A obra parou.', umaCaptura(), HOJE))).toBe(
      false,
    );

    expect(promessa.estagio).toBe('execucao');
    expect(promessa.reavaliacoesPendentes.map((p) => p.motivo)).toEqual(['A obra parou.']);
    expect(promessa.pullDomainEvents().map((e) => e.tipo)).toEqual(['ReavaliacaoSolicitada']);
    expect(erro(promessa.solicitarReavaliacao(obra, '  ', umaCaptura(), HOJE))).toBe(
      'reavaliacao.sem_motivo',
    );
  });

  it('a curadoria conclui a reavaliação de todos os pedidos de uma vez', () => {
    const { promessa, obra } = comObraConfirmada();
    expect(erro(promessa.concluirReavaliacao(umCurador(), HOJE))).toBe('reavaliacao.sem_pedido');
    valor(promessa.solicitarReavaliacao(obra, 'A obra parou.', umaCaptura(), ONTEM));
    valor(promessa.solicitarReavaliacao(obra, 'A obra voltou.', umaCaptura(), HOJE));
    promessa.pullDomainEvents();

    valor(promessa.concluirReavaliacao(umCurador(), HOJE));

    expect(promessa.reavaliacoesPendentes).toEqual([]);
    expect(promessa.pullDomainEvents().map((e) => [e.tipo, e.dados])).toEqual([
      ['ReavaliacaoConcluida', expect.objectContaining({ pedidos: 2 })],
    ]);
  });
});
