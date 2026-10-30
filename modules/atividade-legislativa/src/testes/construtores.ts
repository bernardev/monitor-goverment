import type { DomainError, Result } from '@prometeu/shared-kernel';

import { DiaDeSessao } from '../domain/dia-de-sessao.js';
import { CapturaId, MandatoId, PessoaId } from '../domain/identificadores.js';
import { MotivoDaAusencia } from '../domain/motivo-da-ausencia.js';
import {
  type Apuracao,
  type MandatoVigente,
  RegistroDeFrequencia,
} from '../domain/registro-de-frequencia.js';

export const AGORA = new Date('2026-10-30T09:00:00.000Z');

export function valor<T>(resultado: Result<T, DomainError>): T {
  if (!resultado.ok) throw new Error(`${resultado.error.code}: ${resultado.error.message}`);
  return resultado.value;
}

export const umaCaptura = (n = 1): CapturaId =>
  valor(CapturaId.de(`0192d5e0-1111-7000-8000-${String(n).padStart(12, '0')}`));

export const umMandato = (): MandatoVigente => ({
  mandato: valor(MandatoId.de('0192d5e0-2222-7000-8000-000000000001')),
  pessoa: valor(PessoaId.de('0192d5e0-2222-7000-8000-000000000002')),
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
