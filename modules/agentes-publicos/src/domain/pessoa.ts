import { AggregateRoot, DomainError, Result, criarEvento } from '@prometeu/shared-kernel';

import type { EventoDeAgentesPublicos } from './eventos.js';
import type { IdentificadorExterno } from './identificador-externo.js';
import { type CapturaId, type MandatoId, PessoaId } from './identificadores.js';
import { Mandato, type NovoMandato, sobrepostos } from './mandato.js';
import type { NomePublico } from './nome-publico.js';
import type { SiglaPartidaria } from './sigla-partidaria.js';
import type { UrlPublica } from './url-publica.js';

export interface DadosDeRegistro {
  readonly nome: NomePublico;
  readonly identificador: IdentificadorExterno;
  readonly filiacao: SiglaPartidaria | undefined;
  readonly foto: UrlPublica | undefined;
  readonly captura: CapturaId;
  readonly agora: Date;
}

export interface EstadoDaPessoa {
  nome: NomePublico;
  filiacao: SiglaPartidaria | undefined;
  foto: UrlPublica | undefined;
  readonly identificadores: IdentificadorExterno[];
  readonly mandatos: Mandato[];
}

/**
 * Quem é quem no poder público: a referência de identidade para todos os outros contextos
 * (docs/dominio/mapa-de-contextos.md). Os dados vêm de fontes oficiais; cada mudança registra a
 * captura que a prova.
 *
 * Métodos de atualização são idempotentes: a fonte repete o mesmo retrato a cada coleta, e só o que
 * mudou vira evento.
 */
export class Pessoa extends AggregateRoot<PessoaId> {
  private constructor(
    id: PessoaId,
    private readonly estado: EstadoDaPessoa,
  ) {
    super(id);
  }

  static registrar(dados: DadosDeRegistro): Pessoa {
    const pessoa = new Pessoa(PessoaId.gerar(), {
      nome: dados.nome,
      filiacao: dados.filiacao,
      foto: dados.foto,
      identificadores: [dados.identificador],
      mandatos: [],
    });
    pessoa.emitir(
      'PessoaRegistrada',
      {
        nome: dados.nome.valor,
        siglaPartido: dados.filiacao?.valor ?? null,
        urlDaFoto: dados.foto?.valor ?? null,
        identificadores: [{ fonte: dados.identificador.fonte, codigo: dados.identificador.codigo }],
        capturaId: dados.captura.valor,
      },
      dados.agora,
    );
    return pessoa;
  }

  static reconstituir(id: PessoaId, estado: EstadoDaPessoa): Pessoa {
    return new Pessoa(id, estado);
  }

  get nome(): NomePublico {
    return this.estado.nome;
  }

  get filiacao(): SiglaPartidaria | undefined {
    return this.estado.filiacao;
  }

  get foto(): UrlPublica | undefined {
    return this.estado.foto;
  }

  get identificadores(): readonly IdentificadorExterno[] {
    return [...this.estado.identificadores];
  }

  get mandatos(): readonly Mandato[] {
    return [...this.estado.mandatos];
  }

  atualizarNome(nome: NomePublico, captura: CapturaId, agora: Date): void {
    if (this.estado.nome.equals(nome)) return;
    const anterior = this.estado.nome;
    this.estado.nome = nome;
    this.emitir(
      'NomePublicoAlterado',
      { de: anterior.valor, para: nome.valor, capturaId: captura.valor },
      agora,
    );
  }

  /** `undefined` é "sem partido", um estado legítimo, não falta de dado. */
  atualizarFiliacao(filiacao: SiglaPartidaria | undefined, captura: CapturaId, agora: Date): void {
    if (mesmoValor(this.estado.filiacao, filiacao)) return;
    const anterior = this.estado.filiacao;
    this.estado.filiacao = filiacao;
    this.emitir(
      'FiliacaoPartidariaAlterada',
      { de: anterior?.valor ?? null, para: filiacao?.valor ?? null, capturaId: captura.valor },
      agora,
    );
  }

  atualizarFoto(foto: UrlPublica | undefined, captura: CapturaId, agora: Date): void {
    if (mesmoValor(this.estado.foto, foto)) return;
    this.estado.foto = foto;
    this.emitir(
      'FotoOficialAlterada',
      { urlDaFoto: foto?.valor ?? null, capturaId: captura.valor },
      agora,
    );
  }

  /**
   * Registra um mandato. Se a fonte informar de novo um mandato já registrado, devolve o mesmo id sem
   * gerar evento. Dois mandatos do mesmo cargo com períodos sobrepostos são recusados.
   */
  registrarMandato(novo: NovoMandato, agora: Date): Result<MandatoId, DomainError> {
    const existente = this.estado.mandatos.find((m) => m.correspondeA(novo));
    if (existente) return Result.ok(existente.id);

    if (this.estado.mandatos.some((m) => m.sobrepoe(novo))) return this.sobreposto(novo.cargo);
    const mandato = Mandato.criar(novo);
    if (!mandato.ok) return mandato;

    this.estado.mandatos.push(mandato.value);
    this.emitir(
      'MandatoRegistrado',
      {
        mandatoId: mandato.value.id.valor,
        cargo: novo.cargo,
        circunscricao: novo.circunscricao.valor,
        inicio: novo.periodo.inicio.toISOString(),
        fim: novo.periodo.fim?.toISOString() ?? null,
        capturaId: novo.captura.valor,
      },
      agora,
    );
    return Result.ok(mandato.value.id);
  }

  /**
   * Aplica, de uma vez, os períodos de exercício que a fonte informa: ela é a autoridade sobre eles,
   * e cada período vira um mandato. Um mandato já registrado que se sobrepõe a um único período é
   * retificado para ele em vez de duplicado; o id fica, porque outros contextos já o referenciam.
   * Períodos que se sobrepõem entre si, ou que tocam mais de um mandato registrado, são recusados.
   */
  sincronizarMandatos(
    periodos: readonly NovoMandato[],
    agora: Date,
  ): Result<MandatoId[], DomainError> {
    const ordenados = [...periodos].sort(
      (a, b) => a.periodo.inicio.getTime() - b.periodo.inicio.getTime(),
    );
    const sobrepostoAoAnterior = ordenados.find((novo, i) => {
      const anterior = ordenados[i - 1];
      return anterior !== undefined && sobrepostos(anterior, novo);
    });
    if (sobrepostoAoAnterior) return this.sobreposto(sobrepostoAoAnterior.cargo);

    const aplicados = new Set<Mandato>();
    const ids: MandatoId[] = [];
    for (const novo of ordenados) {
      const tocados = this.estado.mandatos.filter((m) => !aplicados.has(m) && m.sobrepoe(novo));
      const [existente, ...outros] = tocados;
      if (existente === undefined) {
        const registrado = this.registrarMandato(novo, agora);
        if (!registrado.ok) return registrado;
        const mandato = this.estado.mandatos.find((m) => m.id.equals(registrado.value));
        if (mandato) aplicados.add(mandato);
        ids.push(registrado.value);
        continue;
      }
      if (outros.length > 0 || !existente.circunscricao.equals(novo.circunscricao)) {
        return this.sobreposto(novo.cargo);
      }
      if (!existente.periodo.equals(novo.periodo)) {
        const anterior = existente.periodo;
        existente.retificarPeriodo(novo.periodo, novo.captura);
        this.emitir(
          'PeriodoDoMandatoRetificado',
          {
            mandatoId: existente.id.valor,
            inicio: novo.periodo.inicio.toISOString(),
            fim: novo.periodo.fim?.toISOString() ?? null,
            inicioAnterior: anterior.inicio.toISOString(),
            fimAnterior: anterior.fim?.toISOString() ?? null,
            capturaId: novo.captura.valor,
          },
          agora,
        );
      }
      aplicados.add(existente);
      ids.push(existente.id);
    }
    return Result.ok(ids);
  }

  private sobreposto(cargo: string): Result<never, DomainError> {
    return Result.fail(
      new DomainError(
        'mandato.sobreposto',
        `Já existe um mandato de ${cargo} que se sobrepõe a este período.`,
        { pessoaId: this.id.valor, cargo },
      ),
    );
  }

  private emitir<T extends EventoDeAgentesPublicos['tipo']>(
    tipo: T,
    dados: Extract<EventoDeAgentesPublicos, { tipo: T }>['dados'],
    ocorridoEm: Date,
  ): void {
    this.addDomainEvent(criarEvento({ tipo, idDoAgregado: this.id.valor, dados, ocorridoEm }));
  }
}

function mesmoValor<T extends { equals(outro: T): boolean }>(
  atual: T | undefined,
  novo: T | undefined,
): boolean {
  if (atual === undefined || novo === undefined) return atual === novo;
  return atual.equals(novo);
}
