import { type DomainError, Result } from '@prometeu/shared-kernel';

import { AutorDaPromessa } from '../../domain/autor-da-promessa.js';
import { COMPETENCIAS, MENSURABILIDADES } from '../../domain/classificacao.js';
import { CandidaturaId, CuradorId, MandatoId, PessoaId } from '../../domain/identificadores.js';
import { Meta } from '../../domain/meta.js';
import { Promessa } from '../../domain/promessa.js';
import { Tema } from '../../domain/tema.js';
import { TextoCanonico } from '../../domain/texto-canonico.js';
import { type FonteInput, lerFonte, lerId, lerIdOpcional, lerOpcao } from '../entrada.js';
import type { PromessaRepository, Relogio } from '../portas.js';

export interface RegistrarPromessaInput {
  readonly pessoaId: string;
  readonly candidaturaId?: string | undefined;
  readonly mandatoId?: string | undefined;
  readonly texto: string;
  readonly tema: string;
  readonly mensurabilidade: string;
  readonly competencia: string;
  readonly meta?: { readonly descricao: string; readonly prazo?: Date | undefined } | undefined;
  readonly fonte: FonteInput;
  readonly registradoPor: string;
}

export interface RegistrarPromessaOutput {
  readonly promessaId: string;
}

export class RegistrarPromessa {
  constructor(
    private readonly promessas: PromessaRepository,
    private readonly relogio: Relogio,
  ) {}

  async execute(
    input: RegistrarPromessaInput,
  ): Promise<Result<RegistrarPromessaOutput, DomainError>> {
    const pessoa = lerId(PessoaId.de, input.pessoaId, 'pessoaId');
    if (!pessoa.ok) return pessoa;
    const candidatura = lerIdOpcional(CandidaturaId.de, input.candidaturaId, 'candidaturaId');
    if (!candidatura.ok) return candidatura;
    const mandato = lerIdOpcional(MandatoId.de, input.mandatoId, 'mandatoId');
    if (!mandato.ok) return mandato;
    const autor = AutorDaPromessa.criar({
      pessoa: pessoa.value,
      candidatura: candidatura.value,
      mandato: mandato.value,
    });
    if (!autor.ok) return autor;

    const texto = TextoCanonico.criar(input.texto);
    if (!texto.ok) return texto;
    const tema = Tema.criar(input.tema);
    if (!tema.ok) return tema;
    const mensurabilidade = lerOpcao(MENSURABILIDADES, input.mensurabilidade, 'mensurabilidade');
    if (!mensurabilidade.ok) return mensurabilidade;
    const competencia = lerOpcao(COMPETENCIAS, input.competencia, 'competencia');
    if (!competencia.ok) return competencia;
    const meta = input.meta
      ? Meta.criar(input.meta.descricao, input.meta.prazo)
      : Result.ok(undefined);
    if (!meta.ok) return meta;
    const fonte = lerFonte(input.fonte);
    if (!fonte.ok) return fonte;
    const registradoPor = lerId(CuradorId.de, input.registradoPor, 'registradoPor');
    if (!registradoPor.ok) return registradoPor;

    const promessa = Promessa.registrar({
      autor: autor.value,
      texto: texto.value,
      tema: tema.value,
      mensurabilidade: mensurabilidade.value,
      competencia: competencia.value,
      meta: meta.value,
      fonte: fonte.value,
      registradoPor: registradoPor.value,
      agora: this.relogio.agora(),
    });
    if (!promessa.ok) return promessa;

    await this.promessas.salvar(promessa.value);
    return Result.ok({ promessaId: promessa.value.id.valor });
  }
}
