import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Put,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import type { AcompanhamentoDoCidadao, ErroDeNegocio } from '@prometeu/contracts';
import { type ModuloEngajamento, TIPOS_DE_ALVO, type TipoDeAlvo } from '@prometeu/engajamento';
import type { DomainError, Result } from '@prometeu/shared-kernel';

import { GuardaDeAutenticacao, Papeis, UsuarioAtual } from '../autenticacao/guarda.js';
import type { Usuario } from '../autenticacao/verificador-de-token.js';

export const MODULO_ENGAJAMENTO = Symbol('ModuloEngajamento');
export const ALVOS = Symbol('AlvosAcompanhaveis');

export interface Descricao {
  readonly titulo: string;
  readonly detalhe: string | null;
}

/** O que a Consulta sabe dos alvos: se existem e como se chamam. */
export interface AlvosAcompanhaveis {
  existe(tipo: TipoDeAlvo, id: string): Promise<boolean>;
  /** Pela chave `tipo:id`; alvo que não existe mais fica de fora. */
  descrever(alvos: readonly { tipo: TipoDeAlvo; id: string }[]): Promise<Map<string, Descricao>>;
}

/** Resposta de uma pessoa só: nem o navegador nem um proxy podem guardar e servir a outra. */
const PRIVADO = 'private, no-store';

/**
 * A conta do cidadão (ADR-0014): o que ele acompanha. Toda rota exige login com o papel `cidadao`;
 * a pessoa é sempre a do token, nunca um parâmetro.
 */
@Controller('v1/eu')
@UseGuards(GuardaDeAutenticacao)
@Papeis('cidadao')
export class EngajamentoController {
  constructor(
    @Inject(MODULO_ENGAJAMENTO) private readonly engajamento: ModuloEngajamento,
    @Inject(ALVOS) private readonly alvos: AlvosAcompanhaveis,
  ) {}

  @Get('acompanhamentos')
  @Header('Cache-Control', PRIVADO)
  async listar(@UsuarioAtual() usuario: Usuario): Promise<AcompanhamentoDoCidadao[]> {
    const itens = resultado(await this.engajamento.listarAcompanhamentos.execute(usuario.id));
    const descricoes = await this.alvos.descrever(itens);
    return itens.map((a) => {
      const descricao = descricoes.get(`${a.tipo}:${a.id}`);
      return {
        tipo: a.tipo,
        id: a.id,
        desde: a.desde.toISOString(),
        titulo: descricao?.titulo ?? null,
        detalhe: descricao?.detalhe ?? null,
      };
    });
  }

  /** Idempotente: acompanhar de novo não é erro. 404 se o político ou a cidade não existem. */
  @Put('acompanhamentos/:tipo/:id')
  @HttpCode(204)
  @Header('Cache-Control', PRIVADO)
  async acompanhar(
    @Param('tipo') tipo: string,
    @Param('id') id: string,
    @UsuarioAtual() usuario: Usuario,
  ): Promise<void> {
    const alvo = lerAlvo(tipo, id);
    if (!(await this.alvos.existe(alvo.tipo, alvo.id))) {
      throw new NotFoundException({ mensagem: 'Não há o que acompanhar com esse identificador.' });
    }
    resultado(await this.engajamento.acompanhar.execute({ cidadaoId: usuario.id, ...alvo }));
  }

  @Delete('acompanhamentos/:tipo/:id')
  @HttpCode(204)
  @Header('Cache-Control', PRIVADO)
  async deixarDeAcompanhar(
    @Param('tipo') tipo: string,
    @Param('id') id: string,
    @UsuarioAtual() usuario: Usuario,
  ): Promise<void> {
    resultado(
      await this.engajamento.deixarDeAcompanhar.execute({
        cidadaoId: usuario.id,
        ...lerAlvo(tipo, id),
      }),
    );
  }

  /** Apaga tudo o que a plataforma guarda sobre a pessoa (LGPD). A conta de login é à parte. */
  @Delete()
  @HttpCode(204)
  @Header('Cache-Control', PRIVADO)
  async esquecer(@UsuarioAtual() usuario: Usuario): Promise<void> {
    resultado(await this.engajamento.esquecerCidadao.execute(usuario.id));
  }
}

function lerAlvo(tipo: string, id: string): { tipo: TipoDeAlvo; id: string } {
  const valido = TIPOS_DE_ALVO.find((t) => t === tipo);
  if (!valido) {
    throw new BadRequestException({
      mensagem: `Dá para acompanhar ${TIPOS_DE_ALVO.join(' ou ')}, não "${tipo}".`,
    });
  }
  return { tipo: valido, id: id.trim().toLowerCase() };
}

/** Identificador malformado vira 400; regra do domínio (limite), 422 com o código estável. */
function resultado<T>(r: Result<T, DomainError>): T {
  if (r.ok) return r.value;
  const corpo: ErroDeNegocio = {
    codigo: r.error.code,
    mensagem: r.error.message,
    detalhes: r.error.details,
  };
  if (r.error.code.startsWith('alvo.') || r.error.code === 'identificador.invalido') {
    throw new BadRequestException(corpo);
  }
  throw new UnprocessableEntityException(corpo);
}
