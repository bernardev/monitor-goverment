import { type DomainError, Result } from '@prometeu/shared-kernel';

import type { CasaLegislativa } from '../domain/casa-legislativa.js';
import { type ApuracaoDaProposicao, type Autor, Proposicao } from '../domain/proposicao.js';
import type {
  OrigemDoDado,
  ParlamentarNaFonte,
  PessoasDosParlamentares,
  ProposicaoRepository,
  RegistroDeCapturas,
  Relogio,
} from './portas.js';

export interface RegistrarProposicaoInput extends Omit<ApuracaoDaProposicao, 'autores'> {
  readonly casa: CasaLegislativa;
  readonly codigoNaFonte: string;
  readonly autores: readonly {
    /** `null`: o autor não é parlamentar identificado pela fonte. */
    readonly parlamentar: ParlamentarNaFonte | null;
    readonly nomeNaFonte: string;
    readonly tipoNaFonte: string;
    readonly proponente: boolean;
  }[];
  readonly origem: OrigemDoDado;
}

export interface RegistrarProposicaoOutput {
  readonly proposicaoId: string;
  readonly nova: boolean;
}

/**
 * Registra ou atualiza uma proposição, com a captura que a prova. O autor parlamentar é ligado à
 * pessoa quando Agentes Públicos o conhece; quem ele não conhece (um ex-parlamentar, por exemplo)
 * fica com o nome da fonte, sem ser recusado: a autoria não pode sumir por falta do cadastro.
 */
export class RegistrarProposicao {
  constructor(
    private readonly proposicoes: ProposicaoRepository,
    private readonly pessoas: PessoasDosParlamentares,
    private readonly capturas: RegistroDeCapturas,
    private readonly relogio: Relogio,
  ) {}

  async execute(
    entrada: RegistrarProposicaoInput,
  ): Promise<Result<RegistrarProposicaoOutput, DomainError>> {
    const autores: Autor[] = [];
    for (const autor of entrada.autores) {
      autores.push({
        pessoa: autor.parlamentar ? await this.pessoas.pessoaDe(autor.parlamentar) : undefined,
        nomeNaFonte: autor.nomeNaFonte,
        tipoNaFonte: autor.tipoNaFonte,
        proponente: autor.proponente,
      });
    }
    const apuracao: ApuracaoDaProposicao = {
      sigla: entrada.sigla,
      numero: entrada.numero,
      ano: entrada.ano,
      ementa: entrada.ementa,
      apresentadaEm: entrada.apresentadaEm,
      autores,
      situacao: entrada.situacao,
      tramitacoes: entrada.tramitacoes,
      normaGerada: entrada.normaGerada,
      urlDoTexto: entrada.urlDoTexto,
    };

    const captura = await this.capturas.registrar(entrada.origem);
    if (!captura.ok) return captura;
    const agora = this.relogio.agora();
    const existente = await this.proposicoes.buscar(entrada.casa, entrada.codigoNaFonte);
    if (existente) {
      const atualizada = existente.atualizar(apuracao, captura.value, agora);
      if (!atualizada.ok) return atualizada;
      await this.proposicoes.salvar(existente);
      return Result.ok({ proposicaoId: existente.id.valor, nova: false });
    }

    const proposicao = Proposicao.registrar({
      casa: entrada.casa,
      codigoNaFonte: entrada.codigoNaFonte,
      apuracao,
      captura: captura.value,
      agora,
    });
    if (!proposicao.ok) return proposicao;
    await this.proposicoes.salvar(proposicao.value);
    return Result.ok({ proposicaoId: proposicao.value.id.valor, nova: true });
  }
}
