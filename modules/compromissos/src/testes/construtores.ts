// Construtores de teste (docs/engenharia/convencoes.md): deixam cada teste dizer só o que importa
// para a regra que ele especifica. Não fazem parte do build do módulo.

import { type DomainError, type Result, gerarUuidV7 } from '@prometeu/shared-kernel';

import { AutorDaPromessa } from '../domain/autor-da-promessa.js';
import type { Mensurabilidade } from '../domain/classificacao.js';
import type { NovaFonte } from '../domain/fonte-da-promessa.js';
import {
  CandidaturaId,
  CapturaId,
  CuradorId,
  IdDoAlvo,
  MandatoId,
  PessoaId,
} from '../domain/identificadores.js';
import { Promessa } from '../domain/promessa.js';
import { ReferenciaExterna, type TipoDeAlvo } from '../domain/referencia-externa.js';
import { Tema } from '../domain/tema.js';
import { TextoCanonico } from '../domain/texto-canonico.js';
import { Trecho } from '../domain/trecho.js';
import type { Veredito } from '../domain/veredito.js';

export const ONTEM = new Date('2027-05-31T12:00:00Z');
export const HOJE = new Date('2027-06-01T12:00:00Z');

/** Desembrulha um resultado que o teste espera ser sucesso; se não for, a mensagem diz o porquê. */
export function valor<T>(resultado: Result<T, DomainError>): T {
  if (!resultado.ok) {
    throw new Error(`Esperava sucesso, veio ${resultado.error.code}: ${resultado.error.message}`);
  }
  return resultado.value;
}

/** Código do erro de um resultado que o teste espera ser falha. */
export function erro(resultado: Result<unknown, DomainError>): string {
  if (resultado.ok) throw new Error('Esperava falha, veio sucesso.');
  return resultado.error.code;
}

export const umaPessoa = (): PessoaId => valor(PessoaId.de(gerarUuidV7()));
export const umaCandidatura = (): CandidaturaId => valor(CandidaturaId.de(gerarUuidV7()));
export const umMandato = (): MandatoId => valor(MandatoId.de(gerarUuidV7()));
export const umaCaptura = (): CapturaId => valor(CapturaId.de(gerarUuidV7()));
export const umCurador = (): CuradorId => valor(CuradorId.de(gerarUuidV7()));

export function umAlvo(tipo: TipoDeAlvo = 'proposicao'): ReferenciaExterna {
  return ReferenciaExterna.criar(tipo, valor(IdDoAlvo.de(gerarUuidV7())));
}

export function umaFonte(sobrescrever: Partial<NovaFonte> = {}): NovaFonte {
  return {
    tipo: 'plano_de_governo',
    captura: umaCaptura(),
    trecho: valor(
      Trecho.criar('Vamos construir 500 creches até 2028.', { tipo: 'pagina', pagina: 12 }),
    ),
    dataDaDeclaracao: ONTEM,
    ...sobrescrever,
  };
}

class ConstrutorDePromessa {
  private mensurabilidade: Mensurabilidade = 'mensuravel';
  private fonte: NovaFonte = umaFonte();
  private readonly vereditos: Veredito[] = [];

  generica(): this {
    this.mensurabilidade = 'generica';
    return this;
  }

  comFonte(fonte: NovaFonte): this {
    this.fonte = fonte;
    return this;
  }

  /** Publica os vereditos em sequência, cada um proposto e revisado por pessoas diferentes. */
  comVereditosPublicados(...vereditos: Veredito[]): this {
    this.vereditos.push(...vereditos);
    return this;
  }

  build(): Promessa {
    const promessa = valor(
      Promessa.registrar({
        autor: valor(AutorDaPromessa.criar({ pessoa: umaPessoa(), mandato: umMandato() })),
        texto: valor(TextoCanonico.criar('Construir 500 creches até 2028')),
        tema: valor(Tema.criar('educacao')),
        mensurabilidade: this.mensurabilidade,
        competencia: 'propria',
        fonte: this.fonte,
        registradoPor: umCurador(),
        agora: HOJE,
      }),
    );
    for (const veredito of this.vereditos) publicar(promessa, veredito);
    promessa.pullDomainEvents();
    return promessa;
  }
}

export function umaPromessa(): ConstrutorDePromessa {
  return new ConstrutorDePromessa();
}

function publicar(promessa: Promessa, veredito: Veredito): void {
  valor(
    promessa.proporVeredito({
      veredito,
      justificativa: `Evidência indica ${veredito}.`,
      evidencias: [umaCaptura()],
      fundamento:
        veredito === 'nao_cumprida' ? { tipo: 'mandato_encerrado', encerradoEm: ONTEM } : undefined,
      propostoPor: umCurador(),
      propostoEm: HOJE,
    }),
  );
  valor(promessa.publicarVeredito(umCurador(), HOJE));
}
