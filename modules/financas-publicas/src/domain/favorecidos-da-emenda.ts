import {
  AggregateRoot,
  CodigoIbge,
  type Dinheiro,
  DomainError,
  Result,
  criarEvento,
} from '@prometeu/shared-kernel';

import type { EventoDeFinancasPublicas, FavorecidosPublicados } from './eventos.js';
import { type CapturaId, FavorecidosDaEmendaId } from './identificadores.js';
import { formatoDoDocumento, type TipoDeFavorecido } from './tipo-de-favorecido.js';

export interface Favorecido {
  readonly tipo: TipoDeFavorecido;
  /** CNPJ ou código da unidade gestora; `null` no somado. */
  readonly documento: string | null;
  readonly nome: string | null;
  readonly naturezaJuridica: string | null;
  /** Sigla da UF. */
  readonly uf: string | null;
  /** Como a fonte escreve o município (`SÃO PAULO`): ela não dá o código IBGE. */
  readonly municipio: string | null;
}

/** O que a emenda pagou a um favorecido num mês. */
export interface Recebimento {
  /** `aaaa-mm`. */
  readonly mes: string;
  readonly favorecido: Favorecido;
  /** Quantos favorecidos a fonte somou: 1 no identificado. */
  readonly quantidade: number;
  /** Recebido no mês; negativo é estorno. */
  readonly valor: Dinheiro;
}

export interface EstadoDosFavorecidos {
  readonly codigoDaEmenda: string;
  recebimentos: readonly Recebimento[];
  captura: CapturaId;
}

export interface DadosDosFavorecidos {
  readonly codigoDaEmenda: string;
  readonly recebimentos: readonly Recebimento[];
  readonly captura: CapturaId;
  readonly agora: Date;
}

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Para quem foi o dinheiro de uma emenda, mês a mês, com a captura que prova. Ligado à emenda pelo
 * código da fonte: a lista de favorecidos chega num lote à parte, e pode chegar antes da emenda.
 */
export class FavorecidosDaEmenda extends AggregateRoot<FavorecidosDaEmendaId> {
  private constructor(
    id: FavorecidosDaEmendaId,
    private readonly estado: EstadoDosFavorecidos,
  ) {
    super(id);
  }

  static registrar(dados: DadosDosFavorecidos): Result<FavorecidosDaEmenda, DomainError> {
    if (!/^\d+$/.test(dados.codigoDaEmenda)) {
      return falha(
        'favorecidos.codigo_invalido',
        `Código de emenda inválido: "${dados.codigoDaEmenda}".`,
      );
    }
    const valida = validar(dados.recebimentos, dados.agora);
    if (!valida.ok) return valida;
    const favorecidos = new FavorecidosDaEmenda(FavorecidosDaEmendaId.gerar(), {
      codigoDaEmenda: dados.codigoDaEmenda,
      recebimentos: ordenados(dados.recebimentos),
      captura: dados.captura,
    });
    favorecidos.emitir('FavorecidosDaEmendaRegistrados', dados.agora);
    return Result.ok(favorecidos);
  }

  static reconstituir(
    id: FavorecidosDaEmendaId,
    estado: EstadoDosFavorecidos,
  ): FavorecidosDaEmenda {
    return new FavorecidosDaEmenda(id, { ...estado, recebimentos: ordenados(estado.recebimentos) });
  }

  get codigoDaEmenda(): string {
    return this.estado.codigoDaEmenda;
  }

  /** Em ordem de mês e favorecido. */
  get recebimentos(): readonly Recebimento[] {
    return this.estado.recebimentos;
  }

  get captura(): CapturaId {
    return this.estado.captura;
  }

  /**
   * Aplica o que a fonte informa agora. Idempotente: o arquivo é coletado de novo todo dia, e só uma
   * mudança de fato (mês novo, valor corrigido, favorecido que sai) vira evento.
   */
  atualizar(
    recebimentos: readonly Recebimento[],
    captura: CapturaId,
    agora: Date,
  ): Result<void, DomainError> {
    const valida = validar(recebimentos, agora);
    if (!valida.ok) return valida;
    const novos = ordenados(recebimentos);
    if (mesmosRecebimentos(this.estado.recebimentos, novos)) return Result.ok(undefined);
    this.estado.recebimentos = novos;
    this.estado.captura = captura;
    this.emitir('FavorecidosDaEmendaAtualizados', agora);
    return Result.ok(undefined);
  }

  private emitir(
    tipo: Extract<EventoDeFinancasPublicas['tipo'], `FavorecidosDaEmenda${string}`>,
    ocorridoEm: Date,
  ): void {
    const dados: FavorecidosPublicados = {
      codigoDaEmenda: this.estado.codigoDaEmenda,
      recebimentos: this.estado.recebimentos.map((r) => ({
        mes: r.mes,
        favorecido: { ...r.favorecido },
        quantidade: r.quantidade,
        valorCentavos: r.valor.centavos.toString(),
      })),
      capturaId: this.estado.captura.valor,
    };
    this.addDomainEvent(criarEvento({ tipo, idDoAgregado: this.id.valor, dados, ocorridoEm }));
  }
}

/**
 * Invariantes: ao menos um recebimento; mês bem formado e não futuro; o identificado tem documento no
 * formato do tipo e nome, e é um só; o somado não tem documento, nome nem natureza jurídica (dado de
 * cidadão não entra); UF conhecida; e o mesmo favorecido não aparece duas vezes no mês.
 */
function validar(recebimentos: readonly Recebimento[], agora: Date): Result<void, DomainError> {
  if (recebimentos.length === 0) {
    return falha(
      'favorecidos.sem_recebimento',
      'A lista de favorecidos precisa de um recebimento.',
    );
  }
  const mesAtual = agora.toISOString().slice(0, 7);
  for (const r of recebimentos) {
    if (!MES.test(r.mes) || r.mes > mesAtual) {
      return falha('favorecidos.mes_invalido', `Mês de recebimento inválido: "${r.mes}".`);
    }
    const f = r.favorecido;
    const documento = formatoDoDocumento(f.tipo);
    if (documento === undefined) {
      if (f.documento !== null || f.nome !== null || f.naturezaJuridica !== null) {
        return falha(
          'favorecidos.somado_identificado',
          'Pessoas físicas e favorecidos sem documento entram somados, sem nome nem documento.',
        );
      }
      if (!Number.isInteger(r.quantidade) || r.quantidade < 1) {
        return falha('favorecidos.quantidade_invalida', 'O somado junta ao menos um favorecido.');
      }
    } else {
      if (f.documento === null || !documento.test(f.documento) || !f.nome?.trim()) {
        return falha(
          'favorecidos.sem_identificacao',
          'Pessoa jurídica e unidade gestora têm documento e nome.',
        );
      }
      if (r.quantidade !== 1) {
        return falha('favorecidos.quantidade_invalida', 'O favorecido identificado é um só.');
      }
    }
    if (f.uf !== null && (!/^[A-Z]{2}$/.test(f.uf) || !CodigoIbge.daUf(f.uf).ok)) {
      return falha('favorecidos.uf_desconhecida', `UF desconhecida: "${f.uf}".`);
    }
  }
  const chaves = recebimentos.map(chaveDoRecebimento);
  if (new Set(chaves).size !== chaves.length) {
    return falha(
      'favorecidos.recebimento_repetido',
      'O mesmo favorecido aparece duas vezes no mês.',
    );
  }
  return Result.ok(undefined);
}

function chaveDoRecebimento(r: Recebimento): string {
  const f = r.favorecido;
  return [r.mes, f.tipo, f.documento ?? '', f.uf ?? '', f.municipio ?? ''].join('|');
}

/** A ordem não depende da fonte: mês, depois favorecido. */
function ordenados(recebimentos: readonly Recebimento[]): readonly Recebimento[] {
  return [...recebimentos].sort((a, b) => {
    const x = chaveDoRecebimento(a);
    const y = chaveDoRecebimento(b);
    return x < y ? -1 : x > y ? 1 : 0;
  });
}

/** Compara listas já ordenadas. */
function mesmosRecebimentos(a: readonly Recebimento[], b: readonly Recebimento[]): boolean {
  return (
    a.length === b.length &&
    a.every((x, i) => {
      const y = b[i];
      return (
        y !== undefined &&
        chaveDoRecebimento(x) === chaveDoRecebimento(y) &&
        x.quantidade === y.quantidade &&
        x.valor.equals(y.valor) &&
        x.favorecido.nome === y.favorecido.nome &&
        x.favorecido.naturezaJuridica === y.favorecido.naturezaJuridica
      );
    })
  );
}

function falha(codigo: string, mensagem: string): Result<never, DomainError> {
  return Result.fail(new DomainError(codigo, mensagem));
}
