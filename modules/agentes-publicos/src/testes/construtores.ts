import { CodigoIbge, type DomainError, Periodo, type Result } from '@prometeu/shared-kernel';

import type { OrigemDoDado } from '../application/portas.js';
import type { SincronizarAgentePublicoInput } from '../application/sincronizar-agente-publico.js';
import type { Cargo } from '../domain/cargo.js';
import { IdentificadorExterno } from '../domain/identificador-externo.js';
import { CapturaId } from '../domain/identificadores.js';
import type { NovoMandato } from '../domain/mandato.js';
import { NomePublico } from '../domain/nome-publico.js';
import { Pessoa } from '../domain/pessoa.js';
import { SiglaPartidaria } from '../domain/sigla-partidaria.js';

export const AGORA = new Date('2026-10-30T12:00:00Z');

export function valor<T>(resultado: Result<T, DomainError>): T {
  if (!resultado.ok) throw new Error(`Esperava sucesso: ${resultado.error.code}`);
  return resultado.value;
}

export function erro<T>(resultado: Result<T, DomainError>): string {
  if (resultado.ok) throw new Error('Esperava falha.');
  return resultado.error.code;
}

export const umaCaptura = (): CapturaId =>
  valor(CapturaId.de('0192d5e0-1111-7000-8000-000000000001'));

export const LEGISLATURA_57 = {
  inicio: new Date('2023-02-01T03:00:00.000Z'),
  fim: new Date('2027-02-01T02:59:59.999Z'),
};

export function umMandato(
  sobrescrever: Partial<{ cargo: Cargo; circunscricao: string; inicio: Date; fim: Date }> = {},
): NovoMandato {
  return {
    cargo: sobrescrever.cargo ?? 'deputado_federal',
    circunscricao: valor(CodigoIbge.criar(sobrescrever.circunscricao ?? '35')),
    periodo: valor(
      Periodo.criar(
        sobrescrever.inicio ?? LEGISLATURA_57.inicio,
        sobrescrever.fim ?? LEGISLATURA_57.fim,
      ),
    ),
    captura: umaCaptura(),
  };
}

export function umaPessoa(): Pessoa {
  const pessoa = Pessoa.registrar({
    nome: valor(NomePublico.criar('Ana Exemplo')),
    identificador: valor(IdentificadorExterno.criar('camara', '900001')),
    filiacao: valor(SiglaPartidaria.criar('PEX')),
    foto: undefined,
    captura: umaCaptura(),
    agora: AGORA,
  });
  pessoa.pullDomainEvents();
  return pessoa;
}

export const umaOrigem = (sha256 = 'a'.repeat(64)): OrigemDoDado => ({
  fonte: 'camara',
  url: 'https://dadosabertos.camara.leg.br/api/v2/deputados?pagina=1',
  coletadaEm: new Date('2026-10-30T09:00:00Z'),
  sha256,
  caminho: `bronze/camara/2026/10/30/${sha256}`,
  tipoDeConteudo: 'application/json',
});

export function umaEntrada(
  sobrescrever: Partial<SincronizarAgentePublicoInput> = {},
): SincronizarAgentePublicoInput {
  return {
    identificador: { fonte: 'camara', codigo: '900001' },
    nome: 'Ana Exemplo',
    siglaPartido: 'PEX',
    urlDaFoto: 'https://www.camara.leg.br/internet/deputado/bandep/900001.jpg',
    mandatos: [{ cargo: 'deputado_federal', circunscricao: '35', ...LEGISLATURA_57 }],
    origem: umaOrigem(),
    ...sobrescrever,
  };
}
