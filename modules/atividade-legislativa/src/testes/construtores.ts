import type { DomainError, Result } from '@prometeu/shared-kernel';

import { DiaDeSessao } from '../domain/dia-de-sessao.js';
import { CapturaId, MandatoId, PessoaId } from '../domain/identificadores.js';
import { MotivoDaAusencia } from '../domain/motivo-da-ausencia.js';
import type { MandatoVigente } from '../domain/mandato-vigente.js';
import { type Apuracao, RegistroDeFrequencia } from '../domain/registro-de-frequencia.js';
import {
  type ApuracaoDaVotacao,
  VotacaoNominal,
  type VotoApurado,
} from '../domain/votacao-nominal.js';
import type { OpcaoDeVoto } from '../domain/voto.js';

export const AGORA = new Date('2026-10-30T09:00:00.000Z');

export function valor<T>(resultado: Result<T, DomainError>): T {
  if (!resultado.ok) throw new Error(`${resultado.error.code}: ${resultado.error.message}`);
  return resultado.value;
}

export const umaCaptura = (n = 1): CapturaId =>
  valor(CapturaId.de(`0192d5e0-1111-7000-8000-${String(n).padStart(12, '0')}`));

export const umMandato = (n = 1): MandatoVigente => ({
  mandato: valor(MandatoId.de(`0192d5e0-2222-7000-8000-${String(n).padStart(12, '0')}`)),
  pessoa: valor(PessoaId.de(`0192d5e0-3333-7000-8000-${String(n).padStart(12, '0')}`)),
  inicio: new Date('2023-02-01T03:00:00.000Z'),
  fim: new Date('2027-02-01T02:59:59.999Z'),
});

const sessao = (presente: boolean) => [{ descricao: 'EXTRAORDINÁRIA Nº 206', presente }];

export const presenca = (): Apuracao => ({
  situacao: 'presente',
  motivo: undefined,
  registroNaFonte: 'Presença',
  sessoes: sessao(true),
});

export const ausencia = (): Apuracao => ({
  situacao: 'ausente',
  motivo: undefined,
  registroNaFonte: 'Ausência',
  sessoes: sessao(false),
});

export const ausenciaJustificada = (descricao = 'Missão Autorizada'): Apuracao => ({
  situacao: 'ausencia_justificada',
  motivo: valor(MotivoDaAusencia.criar('missao_autorizada', descricao)),
  registroNaFonte: 'Ausência justificada',
  sessoes: sessao(false),
});

export function umRegistro(
  apuracao: Apuracao = ausencia(),
  dia = '2026-10-06',
): RegistroDeFrequencia {
  return valor(
    RegistroDeFrequencia.registrar({
      casa: 'camara_dos_deputados',
      dia: valor(DiaDeSessao.de(dia)),
      mandato: umMandato(),
      apuracao,
      captura: umaCaptura(),
      agora: AGORA,
    }),
  );
}

const GRAFIA: Readonly<Record<OpcaoDeVoto, string | null>> = {
  sim: 'Sim',
  nao: 'Não',
  abstencao: 'Abstenção',
  obstrucao: 'Obstrução',
  presidente_da_sessao: 'Artigo 17',
  secreto: null,
};

/** Voto do parlamentar `n` às 19h40 de 14/10/2026 (Brasília). */
export const umVoto = (n: number, opcao: OpcaoDeVoto = 'sim'): VotoApurado => ({
  mandato: umMandato(n),
  opcao,
  registroNaFonte: GRAFIA[opcao],
  registradoEm: new Date('2026-10-14T22:40:00.000Z'),
  siglaPartidoNaFonte: 'PEX',
});

export const umaApuracaoDeVotacao = (
  votos: readonly VotoApurado[] = [
    umVoto(1, 'sim'),
    umVoto(2, 'nao'),
    umVoto(3, 'presidente_da_sessao'),
  ],
): ApuracaoDaVotacao => ({
  dia: valor(DiaDeSessao.de('2026-10-14')),
  registradaEm: new Date('2026-10-14T22:42:50.000Z'),
  descricao: 'Aprovado o Projeto de Lei nº 900, de 2026.',
  resultado: 'aprovada',
  proposicoes: [
    { codigoNaFonte: '9009001', sigla: 'PL', numero: 900, ano: 2026, ementa: 'Tema fictício.' },
  ],
  votos,
});

export function umaVotacao(apuracao = umaApuracaoDeVotacao()): VotacaoNominal {
  return valor(
    VotacaoNominal.registrar({
      casa: 'camara_dos_deputados',
      codigoNaFonte: '900100-10',
      apuracao,
      captura: umaCaptura(1),
      capturaDosVotos: umaCaptura(2),
      agora: AGORA,
    }),
  );
}
