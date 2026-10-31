import { AggregateRoot, DomainError, Result, criarEvento } from '@prometeu/shared-kernel';

import type { AutorDaPromessa } from './autor-da-promessa.js';
import type { Competencia, Mensurabilidade } from './classificacao.js';
import { type EstagioNaCadeia, estagioMaisAvancado, posicaoNaCadeia } from './estagio.js';
import type { EventoDeCompromissos } from './eventos.js';
import { FonteDaPromessa, type NovaFonte } from './fonte-da-promessa.js';
import {
  type CapturaId,
  type CuradorId,
  type FonteId,
  PromessaId,
  type RegistroDeVereditoId,
  type VinculoId,
} from './identificadores.js';
import type { Meta } from './meta.js';
import type { ReferenciaExterna } from './referencia-externa.js';
import { type DadosDaProposta, PropostaDeVeredito } from './proposta-de-veredito.js';
import { RegistroDeVeredito } from './registro-de-veredito.js';
import type { Tema } from './tema.js';
import type { TextoCanonico } from './texto-canonico.js';
import { textoObrigatorio } from './validacao.js';
import { podeTransitar, type Veredito } from './veredito.js';
import { type NovoVinculo, Vinculo } from './vinculo.js';

export interface DadosDeRegistro {
  readonly autor: AutorDaPromessa;
  readonly texto: TextoCanonico;
  readonly tema: Tema;
  readonly mensurabilidade: Mensurabilidade;
  readonly competencia: Competencia;
  readonly meta?: Meta | undefined;
  readonly fonte: NovaFonte;
  readonly registradoPor: CuradorId;
  readonly agora: Date;
}

export interface EstadoDaPromessa {
  readonly autor: AutorDaPromessa;
  readonly texto: TextoCanonico;
  readonly tema: Tema;
  readonly mensurabilidade: Mensurabilidade;
  readonly competencia: Competencia;
  readonly meta: Meta | undefined;
  readonly fontes: FonteDaPromessa[];
  readonly vinculos: Vinculo[];
  readonly historico: RegistroDeVeredito[];
  proposta: PropostaDeVeredito | undefined;
  estagio: EstagioNaCadeia;
  /** Fatos ligados por vínculo confirmado que mudaram desde a última reavaliação. */
  reavaliacoes: PedidoDeReavaliacao[];
}

/** Um fato vinculado mudou (a obra parou, a emenda pagou, o PL tramitou): a curadoria olha de novo. */
export interface PedidoDeReavaliacao {
  readonly alvo: ReferenciaExterna;
  readonly motivo: string;
  readonly captura: CapturaId;
  readonly pedidoEm: Date;
}

/**
 * Raiz do agregado central do produto (docs/dominio/modelo-compromissos.md). Fontes, vínculos e
 * histórico de vereditos só mudam pelos métodos daqui, que garantem as invariantes numeradas no
 * documento.
 *
 * Estágio e veredito são dimensões separadas: o estágio é calculado a partir dos vínculos confirmados
 * (fato); o veredito é publicado por pessoas, com evidência e revisão (julgamento editorial).
 */
export class Promessa extends AggregateRoot<PromessaId> {
  private constructor(
    id: PromessaId,
    private readonly estado: EstadoDaPromessa,
  ) {
    super(id);
  }

  /** Invariante 1: a promessa já nasce com uma fonte, e a fonte aponta para uma captura. */
  static registrar(dados: DadosDeRegistro): Result<Promessa, DomainError> {
    const fonte = FonteDaPromessa.criar(dados.fonte, dados.agora);
    if (!fonte.ok) return fonte;

    const promessa = new Promessa(PromessaId.gerar(), {
      autor: dados.autor,
      texto: dados.texto,
      tema: dados.tema,
      mensurabilidade: dados.mensurabilidade,
      competencia: dados.competencia,
      meta: dados.meta,
      fontes: [fonte.value],
      vinculos: [],
      historico: [],
      proposta: undefined,
      estagio: 'prometida',
      reavaliacoes: [],
    });

    promessa.emitir(
      'PromessaRegistrada',
      {
        pessoaId: dados.autor.pessoa.valor,
        candidaturaId: dados.autor.candidatura?.valor ?? null,
        mandatoId: dados.autor.mandato?.valor ?? null,
        texto: dados.texto.valor,
        tema: dados.tema.codigo,
        mensurabilidade: dados.mensurabilidade,
        competencia: dados.competencia,
        fonteId: fonte.value.id.valor,
        capturaId: fonte.value.captura.valor,
        registradoPor: dados.registradoPor.valor,
      },
      dados.agora,
    );
    return Result.ok(promessa);
  }

  /** Recria a promessa a partir do que o repositório guardou, sem regras nem eventos. */
  static reconstituir(id: PromessaId, estado: EstadoDaPromessa): Promessa {
    return new Promessa(id, estado);
  }

  get autor(): AutorDaPromessa {
    return this.estado.autor;
  }

  get texto(): TextoCanonico {
    return this.estado.texto;
  }

  get tema(): Tema {
    return this.estado.tema;
  }

  get mensurabilidade(): Mensurabilidade {
    return this.estado.mensurabilidade;
  }

  get competencia(): Competencia {
    return this.estado.competencia;
  }

  get meta(): Meta | undefined {
    return this.estado.meta;
  }

  get estagio(): EstagioNaCadeia {
    return this.estado.estagio;
  }

  get fontes(): readonly FonteDaPromessa[] {
    return [...this.estado.fontes];
  }

  get vinculos(): readonly Vinculo[] {
    return [...this.estado.vinculos];
  }

  get historicoDeVereditos(): readonly RegistroDeVeredito[] {
    return [...this.estado.historico];
  }

  get propostaPendente(): PropostaDeVeredito | undefined {
    return this.estado.proposta;
  }

  get reavaliacoesPendentes(): readonly PedidoDeReavaliacao[] {
    return [...this.estado.reavaliacoes];
  }

  /** Antes do primeiro veredito publicado, a promessa está `nao_iniciada` (estado inicial). */
  get vereditoVigente(): Veredito {
    return this.estado.historico.at(-1)?.veredito ?? 'nao_iniciada';
  }

  /* Fontes */

  adicionarFonte(
    nova: NovaFonte,
    adicionadaPor: CuradorId,
    agora: Date,
  ): Result<FonteId, DomainError> {
    if (this.estado.fontes.some((fonte) => fonte.apontaParaOMesmoLugarQue(nova))) {
      return Result.fail(
        new DomainError(
          'fonte.duplicada',
          'Esta promessa já tem uma fonte nesse ponto da mesma captura.',
        ),
      );
    }
    const fonte = FonteDaPromessa.criar(nova, agora);
    if (!fonte.ok) return fonte;

    this.estado.fontes.push(fonte.value);
    this.emitir(
      'FonteAdicionada',
      {
        fonteId: fonte.value.id.valor,
        tipo: fonte.value.tipo,
        capturaId: fonte.value.captura.valor,
        adicionadaPor: adicionadaPor.valor,
      },
      agora,
    );
    return Result.ok(fonte.value.id);
  }

  /* Vínculos e estágio */

  /** Invariante 2: a sugestão fica registrada, mas não mexe no estágio nem no veredito. */
  sugerirVinculo(novo: NovoVinculo, agora: Date): Result<VinculoId, DomainError> {
    if (this.estado.vinculos.some((vinculo) => vinculo.ocupaOAlvo(novo.alvo))) {
      return Result.fail(
        new DomainError(
          'vinculo.duplicado',
          'Esta promessa já tem um vínculo ativo com esse fato.',
          { tipo: novo.alvo.tipo, id: novo.alvo.id.valor },
        ),
      );
    }
    const vinculo = Vinculo.sugerir(novo, agora);
    if (!vinculo.ok) return vinculo;

    this.estado.vinculos.push(vinculo.value);
    this.emitir(
      'VinculoSugerido',
      {
        vinculoId: vinculo.value.id.valor,
        tipoDoAlvo: novo.alvo.tipo,
        idDoAlvo: novo.alvo.id.valor,
        estagioQueComprova: vinculo.value.estagioQueComprova,
        origem: vinculo.value.origem,
        evidencias: vinculo.value.evidencias.map((captura) => captura.valor),
      },
      agora,
    );
    return Result.ok(vinculo.value.id);
  }

  confirmarVinculo(
    id: VinculoId,
    confirmadoPor: CuradorId,
    agora: Date,
  ): Result<void, DomainError> {
    const encontrado = this.localizarVinculo(id);
    if (!encontrado.ok) return encontrado;

    const confirmado = encontrado.value.vinculo.confirmar(confirmadoPor, agora);
    if (!confirmado.ok) return confirmado;

    this.estado.vinculos[encontrado.value.posicao] = confirmado.value;
    this.emitir(
      'VinculoConfirmado',
      { vinculoId: id.valor, confirmadoPor: confirmadoPor.valor },
      agora,
    );
    this.recalcularEstagio(agora);
    return Result.ok(undefined);
  }

  rejeitarVinculo(
    id: VinculoId,
    rejeitadoPor: CuradorId,
    motivo: string,
    agora: Date,
  ): Result<void, DomainError> {
    const encontrado = this.localizarVinculo(id);
    if (!encontrado.ok) return encontrado;

    const anterior = encontrado.value.vinculo;
    const rejeitado = anterior.rejeitar(rejeitadoPor, motivo, agora);
    if (!rejeitado.ok) return rejeitado;

    this.estado.vinculos[encontrado.value.posicao] = rejeitado.value;
    this.emitir(
      'VinculoRejeitado',
      {
        vinculoId: id.valor,
        estavaConfirmado: anterior.contaParaOEstagio,
        rejeitadoPor: rejeitadoPor.valor,
        motivo: rejeitado.value.motivoDaRejeicao ?? '',
      },
      agora,
    );
    this.recalcularEstagio(agora);
    return Result.ok(undefined);
  }

  /* Reavaliação */

  /**
   * Pedido das políticas que acompanham os fatos de outros contextos. Só vale para fato ligado por
   * vínculo confirmado, o único que conta para o estágio. O mesmo motivo para o mesmo fato, ainda
   * pendente, não se repete (`false`). Não mexe no estágio nem no veredito: quem decide é uma pessoa.
   */
  solicitarReavaliacao(
    alvo: ReferenciaExterna,
    motivo: string,
    captura: CapturaId,
    agora: Date,
  ): Result<boolean, DomainError> {
    const texto = textoObrigatorio(
      motivo,
      'reavaliacao.sem_motivo',
      'O pedido de reavaliação diz o que mudou no fato.',
    );
    if (!texto.ok) return texto;
    if (!this.estado.vinculos.some((v) => v.contaParaOEstagio && v.alvo.equals(alvo))) {
      return Result.fail(
        new DomainError(
          'reavaliacao.sem_vinculo_confirmado',
          'Só um fato com vínculo confirmado pede reavaliação da promessa.',
          { tipo: alvo.tipo, id: alvo.id.valor },
        ),
      );
    }
    if (this.estado.reavaliacoes.some((p) => p.alvo.equals(alvo) && p.motivo === texto.value)) {
      return Result.ok(false);
    }
    this.estado.reavaliacoes.push({ alvo, motivo: texto.value, captura, pedidoEm: agora });
    this.emitir(
      'ReavaliacaoSolicitada',
      {
        tipoDoAlvo: alvo.tipo,
        idDoAlvo: alvo.id.valor,
        motivo: texto.value,
        capturaId: captura.valor,
      },
      agora,
    );
    return Result.ok(true);
  }

  /** A curadoria olhou os fatos que mudaram (e decidiu o que fazer com vínculo e veredito). */
  concluirReavaliacao(por: CuradorId, agora: Date): Result<void, DomainError> {
    const pedidos = this.estado.reavaliacoes.length;
    if (pedidos === 0) {
      return Result.fail(
        new DomainError('reavaliacao.sem_pedido', 'A promessa não tem reavaliação pendente.'),
      );
    }
    this.estado.reavaliacoes = [];
    this.emitir('ReavaliacaoConcluida', { concluidaPor: por.valor, pedidos }, agora);
    return Result.ok(undefined);
  }

  /* Veredito */

  /**
   * O curador propõe; a publicação é um passo separado, feito por quem revisa. Só existe uma proposta
   * pendente por vez, para que a revisão sempre saiba exatamente o que está aprovando.
   */
  proporVeredito(dados: DadosDaProposta): Result<void, DomainError> {
    if (this.estado.proposta) {
      return Result.fail(
        new DomainError(
          'veredito.proposta_pendente',
          'Já existe um veredito aguardando revisão para esta promessa.',
        ),
      );
    }
    const proposta = PropostaDeVeredito.criar(dados);
    if (!proposta.ok) return proposta;

    const cabeNaHistoria = this.validarContraAHistoria(proposta.value);
    if (!cabeNaHistoria.ok) return cabeNaHistoria;

    this.estado.proposta = proposta.value;
    this.emitir(
      'VereditoProposto',
      {
        veredito: proposta.value.veredito,
        vigente: this.vereditoVigente,
        errata: proposta.value.ehErrata,
        exigeRevisao: proposta.value.exigeRevisao,
        propostoPor: proposta.value.propostoPor.valor,
      },
      dados.propostoEm,
    );
    return Result.ok(undefined);
  }

  /** Invariantes 3 a 6, conferidas de novo no momento da publicação. */
  publicarVeredito(revisadoPor: CuradorId, agora: Date): Result<RegistroDeVereditoId, DomainError> {
    const proposta = this.propostaPendenteOuFalha();
    if (!proposta.ok) return proposta;

    if (proposta.value.exigeRevisao && proposta.value.propostoPor.equals(revisadoPor)) {
      return Result.fail(
        new DomainError(
          'veredito.revisor_igual_ao_curador',
          'Este veredito precisa ser revisado por outra pessoa (regra dos quatro olhos).',
        ),
      );
    }
    const cabeNaHistoria = this.validarContraAHistoria(proposta.value);
    if (!cabeNaHistoria.ok) return cabeNaHistoria;

    const anterior = this.vereditoVigente;
    const corrige = proposta.value.ehErrata ? this.estado.historico.at(-1)?.id : undefined;
    const registro = RegistroDeVeredito.publicar(proposta.value, revisadoPor, agora, corrige);

    this.estado.historico.push(registro);
    this.estado.proposta = undefined;
    this.emitir(
      'VereditoPublicado',
      {
        registroId: registro.id.valor,
        veredito: registro.veredito,
        anterior,
        justificativa: registro.justificativa,
        evidencias: registro.evidencias.map((captura) => captura.valor),
        fundamento: registro.fundamento?.tipo ?? null,
        propostoPor: registro.propostoPor.valor,
        revisadoPor: revisadoPor.valor,
        corrige: corrige?.valor ?? null,
      },
      agora,
    );
    return Result.ok(registro.id);
  }

  /** Devolve a proposta ao curador. Também serve para o próprio curador retirar o que propôs. */
  recusarVeredito(recusadoPor: CuradorId, motivo: string, agora: Date): Result<void, DomainError> {
    const proposta = this.propostaPendenteOuFalha();
    if (!proposta.ok) return proposta;

    const texto = textoObrigatorio(
      motivo,
      'veredito.recusa_sem_motivo',
      'Recusar um veredito exige um motivo.',
    );
    if (!texto.ok) return texto;

    this.estado.proposta = undefined;
    this.emitir(
      'VereditoRecusado',
      {
        veredito: proposta.value.veredito,
        propostoPor: proposta.value.propostoPor.valor,
        recusadoPor: recusadoPor.valor,
        motivo: texto.value,
      },
      agora,
    );
    return Result.ok(undefined);
  }

  /* Regras internas */

  private validarContraAHistoria(proposta: PropostaDeVeredito): Result<void, DomainError> {
    const vigente = this.vereditoVigente;
    const alvo = proposta.veredito;

    if (proposta.ehErrata) {
      if (this.estado.historico.length === 0) {
        return Result.fail(
          new DomainError('veredito.nada_a_corrigir', 'Não há veredito publicado para corrigir.'),
        );
      }
      if (alvo === vigente) {
        return Result.fail(
          new DomainError(
            'veredito.errata_sem_mudanca',
            'A errata precisa mudar o veredito vigente.',
          ),
        );
      }
    } else if (!podeTransitar(vigente, alvo)) {
      return Result.fail(
        new DomainError(
          'veredito.transicao_invalida',
          `Não é possível passar de ${vigente} para ${alvo}.`,
          { vigente, alvo },
        ),
      );
    }

    // Invariante 6: sem meta verificável, não há como afirmar que foi cumprida.
    if (alvo === 'cumprida' && this.estado.mensurabilidade === 'generica') {
      return Result.fail(
        new DomainError(
          'veredito.promessa_generica',
          'Promessa genérica não pode ser marcada como cumprida: não há como verificar.',
        ),
      );
    }

    // Parte da promessa foi entregue; o resto ainda pode vir até o último dia do mandato.
    if (
      vigente === 'cumprida_parcialmente' &&
      alvo === 'nao_cumprida' &&
      proposta.fundamento?.tipo !== 'mandato_encerrado'
    ) {
      return Result.fail(
        new DomainError(
          'veredito.parcial_so_no_fim_do_mandato',
          'Promessa cumprida parcialmente só vira não cumprida com o mandato encerrado.',
        ),
      );
    }

    return Result.ok(undefined);
  }

  private propostaPendenteOuFalha(): Result<PropostaDeVeredito, DomainError> {
    const { proposta } = this.estado;
    if (!proposta) {
      return Result.fail(
        new DomainError('veredito.sem_proposta', 'Não há veredito aguardando revisão.'),
      );
    }
    return Result.ok(proposta);
  }

  private localizarVinculo(
    id: VinculoId,
  ): Result<{ posicao: number; vinculo: Vinculo }, DomainError> {
    const posicao = this.estado.vinculos.findIndex((vinculo) => vinculo.id.equals(id));
    const vinculo = this.estado.vinculos[posicao];
    if (!vinculo) {
      return Result.fail(
        new DomainError('vinculo.nao_encontrado', 'Vínculo não encontrado nesta promessa.', {
          vinculoId: id.valor,
        }),
      );
    }
    return Result.ok({ posicao, vinculo });
  }

  /** O estágio é o mais avançado entre os vínculos confirmados; sugestões não contam (invariante 2). */
  private recalcularEstagio(agora: Date): void {
    const anterior = this.estado.estagio;
    const atual = estagioMaisAvancado(
      this.estado.vinculos
        .filter((vinculo) => vinculo.contaParaOEstagio)
        .map((vinculo) => vinculo.estagioQueComprova),
    );
    if (atual === anterior) return;

    this.estado.estagio = atual;
    const tipo =
      posicaoNaCadeia(atual) > posicaoNaCadeia(anterior)
        ? 'EstagioDaPromessaAvancou'
        : 'EstagioDaPromessaRecuou';
    this.emitir(tipo, { de: anterior, para: atual }, agora);
  }

  private emitir<T extends EventoDeCompromissos['tipo']>(
    tipo: T,
    dados: Extract<EventoDeCompromissos, { tipo: T }>['dados'],
    ocorridoEm: Date,
  ): void {
    this.addDomainEvent(criarEvento({ tipo, idDoAgregado: this.id.valor, dados, ocorridoEm }));
  }
}
