import { violacoesDoContrato } from '@prometeu/contracts/esquemas';
import type { DomainEvent } from '@prometeu/shared-kernel';
import { describe, expect, it } from 'vitest';

import {
  HOJE,
  umaCaptura,
  umaFonte,
  umAlvo,
  umaPessoa,
  umCurador,
  umMandato,
  valor,
} from '../testes/construtores.js';
import { AutorDaPromessa } from './autor-da-promessa.js';
import { Promessa } from './promessa.js';
import { Tema } from './tema.js';
import { TextoCanonico } from './texto-canonico.js';

describe('eventos do Compromissos respeitam os contratos publicados (packages/contracts/eventos)', () => {
  it('todos os tipos emitidos', () => {
    const promessa = valor(
      Promessa.registrar({
        autor: valor(AutorDaPromessa.criar({ pessoa: umaPessoa(), mandato: umMandato() })),
        texto: valor(TextoCanonico.criar('Construir 500 creches até 2028')),
        tema: valor(Tema.criar('educacao')),
        mensurabilidade: 'mensuravel',
        competencia: 'propria',
        fonte: umaFonte(),
        registradoPor: umCurador(),
        agora: HOJE,
      }),
    );
    valor(promessa.adicionarFonte(umaFonte(), umCurador(), HOJE));
    const novoVinculo = {
      alvo: umAlvo('obra'),
      estagioQueComprova: 'execucao',
      origem: 'sugestao_ia',
      evidencias: [umaCaptura()],
    } as const;
    const vinculo = valor(promessa.sugerirVinculo(novoVinculo, HOJE));
    valor(promessa.confirmarVinculo(vinculo, umCurador(), HOJE));
    valor(
      promessa.solicitarReavaliacao(novoVinculo.alvo, 'A obra foi paralisada.', umaCaptura(), HOJE),
    );
    valor(promessa.concluirReavaliacao(umCurador(), HOJE));
    valor(promessa.rejeitarVinculo(vinculo, umCurador(), 'Obra é de outro município.', HOJE));
    const proposta = {
      veredito: 'em_andamento',
      justificativa: 'Licitação aberta.',
      evidencias: [umaCaptura()],
      propostoPor: umCurador(),
      propostoEm: HOJE,
    } as const;
    valor(promessa.proporVeredito(proposta));
    valor(promessa.recusarVeredito(umCurador(), 'Falta a captura do edital.', HOJE));
    valor(promessa.proporVeredito(proposta));
    valor(promessa.publicarVeredito(umCurador(), HOJE));

    const eventos: DomainEvent[] = promessa.pullDomainEvents();
    expect(new Set(eventos.map((e) => e.tipo)).size).toBe(12);
    for (const evento of eventos) {
      expect(violacoesDoContrato(evento.tipo, evento.versao, evento.dados), evento.tipo).toEqual(
        [],
      );
    }
  });
});
