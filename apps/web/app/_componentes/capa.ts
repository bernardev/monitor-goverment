import type { ObraDetalhada, VotacaoNominalResumo } from '@prometeu/contracts';

import { dataCurta, dia, identificacao } from './formatacao';

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

/** Junta frases, pondo ponto final onde falta; o que está vazio fica de fora. */
export function juntarFrases(...partes: readonly (string | null | undefined)[]): string {
  return partes
    .map((p) => (p ?? '').trim())
    .filter((p) => p !== '')
    .map((p) => (/[.!?…]$/.test(p) ? p : `${p}.`))
    .join(' ');
}

type Interrupcao = ObraDetalhada['interrupcoes'][number];

const VERBO_DA_INTERRUPCAO: Readonly<Record<Interrupcao['tipo'], string>> = {
  paralisada: 'Parou em',
  cancelada: 'Cancelada em',
  inacabada: 'Declarada inacabada em',
};

/** Quando a obra parou e o motivo que a fonte dá; a paralisação mais recente vem antes de outro tipo. */
export function fraseDaInterrupcao(interrupcoes: readonly Interrupcao[]): string {
  const i = interrupcoes.find((x) => x.tipo === 'paralisada') ?? interrupcoes[0];
  if (i === undefined) return '';
  const motivo = i.justificativa
    ? `Motivo informado: ${resumirTexto(i.justificativa, 220)}`
    : 'A fonte não informa o motivo';
  return juntarFrases(`${VERBO_DA_INTERRUPCAO[i.tipo]} ${dia(i.em.slice(0, 10))}`, motivo);
}

const NUMERO = new Intl.NumberFormat('pt-BR');

export function rotuloDeEmendas(total: number): string {
  return total === 1 ? 'emenda ao orçamento acompanhada' : 'emendas ao orçamento acompanhadas';
}

export function rotuloDeObras(concluidas: number, total: number): string {
  return `${concluidas === 1 ? 'obra concluída' : 'obras concluídas'}, de ${NUMERO.format(total)} ${total === 1 ? 'paga' : 'pagas'} com emendas`;
}

/**
 * O período da chamada de presença: a Câmara é a única fonte de frequência diária, e vale a coleta
 * da tabela de frequência (a da fonte inteira pode ser de outra tabela).
 */
export function periodoDaPresenca(
  fontes:
    | readonly {
        readonly fonte: string;
        readonly ultimaColetaEm: string | null;
        readonly tabelas: readonly {
          readonly tabela: string;
          readonly ultimaColetaEm: string | null;
        }[];
      }[]
    | undefined,
): string {
  const camara = fontes?.find((f) => f.fonte === 'camara');
  const coleta =
    camara?.tabelas.find((t) => t.tabela === 'camara_frequencia_dia')?.ultimaColetaEm ??
    camara?.ultimaColetaEm;
  return coleta
    ? `dias de sessão coletados até ${dataCurta(coleta)}`
    : 'sem dias de sessão coletados';
}
