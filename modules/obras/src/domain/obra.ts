import {
  AggregateRoot,
  CodigoIbge,
  type Dinheiro,
  DomainError,
  Result,
  criarEvento,
} from '@prometeu/shared-kernel';

import type { EventoDeObras, ObraPublicada } from './eventos.js';
import { type CapturaId, ObraId } from './identificadores.js';
import type { Interrupcao, SituacaoDaObra } from './situacao-da-obra.js';

export interface Organizacao {
  readonly nome: string | null;
  readonly cnpj: string | null;
}

/** Percentual executado informado numa data. */
export interface Medicao {
  /** Centésimos de ponto: 2335 é 23,35%. A fonte tem medição acima de 100%. */
  readonly percentualCentesimos: number;
  readonly em: string | null;
}

export interface InterrupcaoDaObra {
  readonly tipo: Interrupcao;
  readonly em: string;
  readonly justificativa: string | null;
}

/** Uma emenda que paga a obra, pelo empenho que traz o código dela. */
export interface EmendaDaObra {
  readonly codigoDaEmenda: string;
  readonly ugEmitente: string;
  readonly numeroDoEmpenho: string;
  readonly acaoOrcamentaria: string | null;
  readonly empenhado: Dinheiro;
  readonly emitidoEm: string | null;
}

/** O que a fonte informa sobre a obra. Pode mudar a cada coleta. */
export interface ApuracaoDaObra {
  readonly nome: string;
  readonly descricao: string | null;
  readonly natureza: string | null;
  readonly especie: string | null;
  readonly situacao: SituacaoDaObra;
  readonly situacaoNaFonte: string;
  readonly uf: string | null;
  readonly municipios: readonly { readonly codigoIbge: string; readonly nome: string | null }[];
  readonly pontos: readonly { readonly latitude: string; readonly longitude: string }[];
  readonly endereco: string | null;
  readonly inicioPrevisto: string | null;
  readonly fimPrevisto: string | null;
  readonly inicioEfetivo: string | null;
  readonly fimEfetivo: string | null;
  readonly investimentoPrevisto: Dinheiro;
  readonly executores: readonly Organizacao[];
  readonly medicao: Medicao | null;
  readonly interrupcoes: readonly InterrupcaoDaObra[];
  readonly emendas: readonly EmendaDaObra[];
}

export interface EstadoDaObra {
  readonly idNaFonte: string;
  apuracao: ApuracaoDaObra;
  captura: CapturaId;
}

export interface DadosDaObra {
  readonly idNaFonte: string;
  readonly apuracao: ApuracaoDaObra;
  readonly captura: CapturaId;
  readonly agora: Date;
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Obra paga com emenda parlamentar: o que é, onde fica, em que situação está, quanto já foi executado
 * e as emendas que a pagam, com a captura que prova. Identificada pelo projeto de investimento no
 * Obrasgov.br. A mudança vira `ObraAtualizada`; a passagem para paralisada vira também
 * `ObraParalisada`, o fato que Compromissos acompanha.
 */
export class Obra extends AggregateRoot<ObraId> {
  private constructor(
    id: ObraId,
    private readonly estado: EstadoDaObra,
  ) {
    super(id);
  }

  static registrar(dados: DadosDaObra): Result<Obra, DomainError> {
    if (!/^\d+\.\d{2}-\d{2}$/.test(dados.idNaFonte)) {
      return falha('obra.id_invalido', `Identificador de obra inválido: "${dados.idNaFonte}".`);
    }
    const valida = validar(dados.apuracao, dados.agora);
    if (!valida.ok) return valida;
    const obra = new Obra(ObraId.gerar(), {
      idNaFonte: dados.idNaFonte,
      apuracao: ordenada(dados.apuracao),
      captura: dados.captura,
    });
    obra.emitir('ObraRegistrada', obra.publicada(), dados.agora);
    return Result.ok(obra);
  }

  static reconstituir(id: ObraId, estado: EstadoDaObra): Obra {
    return new Obra(id, estado);
  }

  get idNaFonte(): string {
    return this.estado.idNaFonte;
  }

  get apuracao(): ApuracaoDaObra {
    return this.estado.apuracao;
  }

  get captura(): CapturaId {
    return this.estado.captura;
  }

  /** Aplica o que a fonte informa agora. Idempotente: só uma mudança de fato vira evento. */
  atualizar(apuracao: ApuracaoDaObra, captura: CapturaId, agora: Date): Result<void, DomainError> {
    const valida = validar(apuracao, agora);
    if (!valida.ok) return valida;
    const nova = ordenada(apuracao);
    const anterior = this.estado.apuracao;
    if (comparavel(anterior) === comparavel(nova)) {
      return Result.ok(undefined);
    }
    this.estado.apuracao = nova;
    this.estado.captura = captura;
    this.emitir('ObraAtualizada', this.publicada(), agora);
    if (nova.situacao === 'paralisada' && anterior.situacao !== 'paralisada') {
      const ultima = [...nova.interrupcoes].reverse().find((i) => i.tipo === 'paralisada');
      this.emitir(
        'ObraParalisada',
        {
          idNaFonte: this.estado.idNaFonte,
          em: ultima?.em ?? null,
          justificativa: ultima?.justificativa ?? null,
          emendas: [...new Set(nova.emendas.map((e) => e.codigoDaEmenda))],
          capturaId: captura.valor,
        },
        agora,
      );
    }
    return Result.ok(undefined);
  }

  private publicada(): ObraPublicada {
    const a = this.estado.apuracao;
    return {
      idNaFonte: this.estado.idNaFonte,
      nome: a.nome,
      descricao: a.descricao,
      natureza: a.natureza,
      especie: a.especie,
      situacao: a.situacao,
      situacaoNaFonte: a.situacaoNaFonte,
      uf: a.uf,
      municipios: a.municipios.map((m) => ({ ...m })),
      pontos: a.pontos.map((p) => ({ ...p })),
      endereco: a.endereco,
      inicioPrevisto: a.inicioPrevisto,
      fimPrevisto: a.fimPrevisto,
      inicioEfetivo: a.inicioEfetivo,
      fimEfetivo: a.fimEfetivo,
      investimentoPrevistoCentavos: a.investimentoPrevisto.centavos.toString(),
      executores: a.executores.map((e) => ({ ...e })),
      medicao: a.medicao === null ? null : { ...a.medicao },
      interrupcoes: a.interrupcoes.map((i) => ({ ...i })),
      emendas: a.emendas.map((e) => ({
        codigoDaEmenda: e.codigoDaEmenda,
        ugEmitente: e.ugEmitente,
        numeroDoEmpenho: e.numeroDoEmpenho,
        acaoOrcamentaria: e.acaoOrcamentaria,
        empenhadoCentavos: e.empenhado.centavos.toString(),
        emitidoEm: e.emitidoEm,
      })),
      capturaId: this.estado.captura.valor,
    };
  }

  private emitir<T extends EventoDeObras['tipo']>(
    tipo: T,
    dados: Extract<EventoDeObras, { tipo: T }>['dados'],
    ocorridoEm: Date,
  ): void {
    this.addDomainEvent(criarEvento({ tipo, idDoAgregado: this.id.valor, dados, ocorridoEm }));
  }
}

/**
 * Invariantes: nome informado; ao menos uma emenda, sem repetir o empenho; dias reais e não futuros
 * no que já aconteceu (início e fim efetivos, interrupções, emissão do empenho); medição e valores não
 * negativos; UF e municípios conhecidos.
 */
function validar(apuracao: ApuracaoDaObra, agora: Date): Result<void, DomainError> {
  if (apuracao.nome.trim().length === 0) {
    return falha('obra.sem_nome', 'Toda obra tem nome.');
  }
  if (apuracao.emendas.length === 0) {
    return falha('obra.sem_emenda', 'A obra entra pelo empenho de uma emenda que a paga.');
  }
  const empenhos = apuracao.emendas.map(chaveDaEmenda);
  if (new Set(empenhos).size !== empenhos.length) {
    return falha('obra.empenho_repetido', 'O mesmo empenho de emenda aparece duas vezes.');
  }
  if (
    apuracao.emendas.some((e) => !/^\d{12}$/.test(e.codigoDaEmenda) || e.empenhado.ehNegativo())
  ) {
    return falha('obra.emenda_invalida', 'Código de emenda ou valor empenhado inválido.');
  }
  const hoje = agora.toISOString().slice(0, 10);
  const previstos = [apuracao.inicioPrevisto, apuracao.fimPrevisto];
  const ocorridos = [
    apuracao.inicioEfetivo,
    apuracao.fimEfetivo,
    apuracao.medicao?.em ?? null,
    ...apuracao.interrupcoes.map((i) => i.em),
    ...apuracao.emendas.map((e) => e.emitidoEm),
  ];
  if (
    [...previstos, ...ocorridos].some((d) => d !== null && !diaReal(d)) ||
    ocorridos.some((d) => d !== null && d > hoje)
  ) {
    return falha('obra.data_invalida', 'Data inexistente, ou futura no que já aconteceu.');
  }
  if (
    apuracao.investimentoPrevisto.ehNegativo() ||
    (apuracao.medicao !== null &&
      (!Number.isInteger(apuracao.medicao.percentualCentesimos) ||
        apuracao.medicao.percentualCentesimos < 0))
  ) {
    return falha('obra.valor_negativo', 'Investimento e medição não são negativos.');
  }
  const ufConhecida =
    apuracao.uf === null || (/^[A-Z]{2}$/.test(apuracao.uf) && CodigoIbge.daUf(apuracao.uf).ok);
  if (!ufConhecida || apuracao.municipios.some((m) => uf(m.codigoIbge) === undefined)) {
    return falha('obra.local_desconhecido', 'UF ou município desconhecido.');
  }
  return Result.ok(undefined);
}

function uf(codigoIbge: string): string | null | undefined {
  if (!/^\d{7}$/.test(codigoIbge)) return undefined;
  const ente = CodigoIbge.criar(codigoIbge.slice(0, 2));
  return ente.ok ? (ente.value.uf() ?? undefined) : undefined;
}

function diaReal(dia: string): boolean {
  if (!DIA.test(dia)) return false;
  const data = new Date(`${dia}T00:00:00.000Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === dia;
}

function chaveDaEmenda(e: EmendaDaObra): string {
  return [e.codigoDaEmenda, e.ugEmitente, e.numeroDoEmpenho].join('|');
}

const emOrdem = <T>(itens: readonly T[], chave: (item: T) => string): T[] =>
  [...itens].sort((a, b) => (chave(a) < chave(b) ? -1 : chave(a) > chave(b) ? 1 : 0));

/** A ordem das listas não depende da fonte. */
function ordenada(a: ApuracaoDaObra): ApuracaoDaObra {
  return {
    ...a,
    municipios: emOrdem(a.municipios, (m) => m.codigoIbge),
    pontos: emOrdem(a.pontos, (p) => `${p.latitude}|${p.longitude}`),
    executores: emOrdem(a.executores, (e) => `${e.cnpj ?? ''}|${e.nome ?? ''}`),
    interrupcoes: emOrdem(a.interrupcoes, (i) => `${i.em}|${i.tipo}|${i.justificativa ?? ''}`),
    emendas: emOrdem(a.emendas, chaveDaEmenda),
  };
}

/**
 * Texto comparável da apuração ordenada: `Dinheiro` vira centavos, e as chaves de cada objeto vão em
 * ordem alfabética (a apuração vinda da fonte e a lida do banco montam os objetos em ordens
 * diferentes).
 */
function comparavel(a: ApuracaoDaObra): string {
  return canonico({
    ...a,
    investimentoPrevisto: a.investimentoPrevisto.centavos.toString(),
    emendas: a.emendas.map((e) => ({ ...e, empenhado: e.empenhado.centavos.toString() })),
  });
}

function canonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(',')}]`;
  if (valor !== null && typeof valor === 'object') {
    const campos = Object.entries(valor).sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${campos.map(([k, v]) => `${JSON.stringify(k)}:${canonico(v)}`).join(',')}}`;
  }
  return JSON.stringify(valor);
}

function falha(codigo: string, mensagem: string): Result<never, DomainError> {
  return Result.fail(new DomainError(codigo, mensagem));
}
