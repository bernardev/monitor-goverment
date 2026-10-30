import { CodigoIbge, type DomainError, Periodo, Result } from '@prometeu/shared-kernel';

import { CARGOS } from '../domain/cargo.js';
import { IdentificadorExterno } from '../domain/identificador-externo.js';
import type { NovoMandato } from '../domain/mandato.js';
import { NomePublico } from '../domain/nome-publico.js';
import { Pessoa } from '../domain/pessoa.js';
import { SiglaPartidaria } from '../domain/sigla-partidaria.js';
import { UrlPublica } from '../domain/url-publica.js';
import { lerOpcao, lerOpcional } from './entrada.js';
import type { OrigemDoDado, PessoaRepository, RegistroDeCapturas, Relogio } from './portas.js';

export interface SincronizarAgentePublicoInput {
  readonly identificador: { readonly fonte: string; readonly codigo: string };
  readonly nome: string;
  /** `null`: sem partido. */
  readonly siglaPartido: string | null;
  readonly urlDaFoto: string | null;
  readonly mandato: {
    readonly cargo: string;
    /** Código IBGE do ente que elege o cargo. */
    readonly circunscricao: string;
    readonly inicio: Date;
    readonly fim: Date | null;
  };
  readonly origem: OrigemDoDado;
}

export interface SincronizarAgentePublicoOutput {
  readonly pessoaId: string;
  readonly mandatoId: string;
  readonly pessoaNova: boolean;
}

/**
 * Aplica o retrato que uma fonte oficial dá de uma pessoa em exercício: cria a pessoa na primeira vez
 * e, nas seguintes, registra só o que mudou. Repetir com os mesmos dados não gera eventos.
 */
export class SincronizarAgentePublico {
  constructor(
    private readonly pessoas: PessoaRepository,
    private readonly capturas: RegistroDeCapturas,
    private readonly relogio: Relogio,
  ) {}

  async execute(
    input: SincronizarAgentePublicoInput,
  ): Promise<Result<SincronizarAgentePublicoOutput, DomainError>> {
    const identificador = IdentificadorExterno.criar(
      input.identificador.fonte,
      input.identificador.codigo,
    );
    if (!identificador.ok) return identificador;
    const nome = NomePublico.criar(input.nome);
    if (!nome.ok) return nome;
    const filiacao = lerOpcional(SiglaPartidaria.criar, input.siglaPartido);
    if (!filiacao.ok) return filiacao;
    const foto = lerOpcional(UrlPublica.criar, input.urlDaFoto);
    if (!foto.ok) return foto;
    const cargo = lerOpcao(CARGOS, input.mandato.cargo, 'mandato.cargo');
    if (!cargo.ok) return cargo;
    const circunscricao = CodigoIbge.criar(input.mandato.circunscricao);
    if (!circunscricao.ok) return circunscricao;
    const periodo = Periodo.criar(input.mandato.inicio, input.mandato.fim ?? undefined);
    if (!periodo.ok) return periodo;

    const captura = await this.capturas.registrar(input.origem);
    if (!captura.ok) return captura;

    const agora = this.relogio.agora();
    const existente = await this.pessoas.buscarPorIdentificador(identificador.value);
    const pessoa =
      existente ??
      Pessoa.registrar({
        nome: nome.value,
        identificador: identificador.value,
        filiacao: filiacao.value,
        foto: foto.value,
        captura: captura.value,
        agora,
      });
    if (existente) {
      existente.atualizarNome(nome.value, captura.value, agora);
      existente.atualizarFiliacao(filiacao.value, captura.value, agora);
      existente.atualizarFoto(foto.value, captura.value, agora);
    }

    const mandato: NovoMandato = {
      cargo: cargo.value,
      circunscricao: circunscricao.value,
      periodo: periodo.value,
      captura: captura.value,
    };
    const mandatoId = pessoa.registrarMandato(mandato, agora);
    if (!mandatoId.ok) return mandatoId;

    await this.pessoas.salvar(pessoa);
    return Result.ok({
      pessoaId: pessoa.id.valor,
      mandatoId: mandatoId.value.valor,
      pessoaNova: existente === undefined,
    });
  }
}
