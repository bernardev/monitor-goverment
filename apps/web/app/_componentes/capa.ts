import type { VotacaoNominalResumo } from '@prometeu/contracts';

import { identificacao } from './formatacao';

const DATA_POR_EXTENSO = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'full',
  timeZone: 'America/Sao_Paulo',
});

/** `segunda-feira, 2 de novembro de 2026`: o dia em Brasília (ADR-0006). */
export function dataPorExtenso(agora: Date): string {
  return DATA_POR_EXTENSO.format(agora);
}

/**
 * O título da manchete: onde foi a votação e sobre qual proposição. Não diz o resultado nem o placar
 * no título: a Câmara também vota subemendas, e "rejeitou o projeto" estaria errado. O resultado fica
 * na linha fina, com as palavras da casa.
 */
export function tituloDaManchete(
  votacao: Pick<VotacaoNominalResumo, 'casa' | 'proposicoes'>,
): string {
  const onde = votacao.casa === 'camara_dos_deputados' ? 'da Câmara' : 'do Senado';
  const [primeira, ...outras] = votacao.proposicoes;
  const base = `Votação no plenário ${onde}`;
  if (primeira === undefined) return base;
  const resto =
    outras.length === 0
      ? ''
      : outras.length === 1
        ? ' e outra'
        : ` e outras ${String(outras.length)}`;
  return `${base}: ${identificacao(primeira)}${resto}`;
}

/** Corta o texto de uma fonte no último espaço antes do limite e põe reticências; texto curto passa igual. */
export function resumirTexto(texto: string, limite: number): string {
  const limpo = texto.replace(/\s+/g, ' ').trim();
  if (limpo.length <= limite) return limpo;
  const corte = limpo.lastIndexOf(' ', limite);
  return `${limpo.slice(0, corte > 0 ? corte : limite).replace(/[.,;:\s]+$/, '')}…`;
}
