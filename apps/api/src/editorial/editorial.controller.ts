import {
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import type { CapturarDocumento, CapturarDocumentoOutput } from '@prometeu/acervo';
import {
  ConflitoDeConcorrencia,
  type ModuloCompromissos,
  type PublicarVereditoOutput,
  type RegistrarPromessaOutput,
} from '@prometeu/compromissos';
import type {
  ErroDeNegocio,
  PromessaNaCuradoria,
  ResumoDePromessaNaCuradoria,
} from '@prometeu/contracts';
import type { DomainError, Result } from '@prometeu/shared-kernel';

import { GuardaDeAutenticacao, Papeis, UsuarioAtual } from '../autenticacao/guarda.js';
import type { Usuario } from '../autenticacao/verificador-de-token.js';
import * as entradas from './entradas.js';

export const MODULO_COMPROMISSOS = Symbol('ModuloCompromissos');
export const CAPTURAR_DOCUMENTO = Symbol('CapturarDocumento');

/**
 * API do painel de curadoria (ADR-0014). Toda rota exige login; cada uma declara os papéis aceitos.
 * Quem fez cada ação é sempre a pessoa do token, nunca um campo do corpo da requisição.
 */
@Controller('v1/editorial')
@UseGuards(GuardaDeAutenticacao)
@Papeis('curador', 'revisor', 'editor_chefe')
export class EditorialController {
  constructor(
    @Inject(MODULO_COMPROMISSOS) private readonly compromissos: ModuloCompromissos,
    @Inject(CAPTURAR_DOCUMENTO) private readonly capturarDocumento: CapturarDocumento,
  ) {}

  @Get('promessas')
  @Header('Cache-Control', 'no-store')
  listar(): Promise<ResumoDePromessaNaCuradoria[]> {
    return this.compromissos.consultaEditorial.listar();
  }

  @Get('promessas/:promessaId')
  @Header('Cache-Control', 'no-store')
  async buscar(@Param('promessaId') promessaId: string): Promise<PromessaNaCuradoria> {
    const promessa = await this.compromissos.consultaEditorial.buscar(promessaId);
    if (!promessa) throw new NotFoundException({ mensagem: 'Promessa não encontrada.' });
    return promessa;
  }

  @Post('capturas')
  @Papeis('curador', 'editor_chefe')
  async capturar(@Body() corpo: unknown): Promise<CapturarDocumentoOutput> {
    const { url } = entradas.ler(entradas.captura, corpo);
    return resultado(await this.capturarDocumento.execute({ url }));
  }

  @Post('promessas')
  @Papeis('curador')
  async registrar(
    @Body() corpo: unknown,
    @UsuarioAtual() usuario: Usuario,
  ): Promise<RegistrarPromessaOutput> {
    const dados = entradas.ler(entradas.novaPromessa, corpo);
    return resultado(
      await this.compromissos.registrarPromessa.execute({ ...dados, registradoPor: usuario.id }),
    );
  }

  @Post('promessas/:promessaId/fontes')
  @Papeis('curador')
  async adicionarFonte(
    @Param('promessaId') promessaId: string,
    @Body() corpo: unknown,
    @UsuarioAtual() usuario: Usuario,
  ): Promise<{ fonteId: string }> {
    const fonte = entradas.ler(entradas.fonte, corpo);
    return emConflito(async () =>
      resultado(
        await this.compromissos.adicionarFonte.execute({
          promessaId,
          fonte,
          adicionadaPor: usuario.id,
        }),
      ),
    );
  }

  @Post('promessas/:promessaId/vereditos')
  @Papeis('curador')
  @HttpCode(204)
  async propor(
    @Param('promessaId') promessaId: string,
    @Body() corpo: unknown,
    @UsuarioAtual() usuario: Usuario,
  ): Promise<void> {
    const proposta = entradas.ler(entradas.propostaDeVeredito, corpo);
    await emConflito(async () => {
      resultado(
        await this.compromissos.proporVeredito.execute({
          ...proposta,
          promessaId,
          propostoPor: usuario.id,
        }),
      );
    });
  }

  @Post('promessas/:promessaId/vereditos/publicacao')
  @Papeis('revisor', 'editor_chefe')
  async publicar(
    @Param('promessaId') promessaId: string,
    @UsuarioAtual() usuario: Usuario,
  ): Promise<PublicarVereditoOutput> {
    return emConflito(async () =>
      resultado(
        await this.compromissos.publicarVeredito.execute({ promessaId, revisadoPor: usuario.id }),
      ),
    );
  }

  @Post('promessas/:promessaId/vereditos/recusa')
  @Papeis('curador', 'revisor', 'editor_chefe')
  @HttpCode(204)
  async recusar(
    @Param('promessaId') promessaId: string,
    @Body() corpo: unknown,
    @UsuarioAtual() usuario: Usuario,
  ): Promise<void> {
    const { motivo } = entradas.ler(entradas.recusa, corpo);
    await emConflito(async () => {
      resultado(
        await this.compromissos.recusarVeredito.execute({
          promessaId,
          motivo,
          recusadoPor: usuario.id,
        }),
      );
    });
  }
}

/** Regra de negócio violada vira 422 com o código estável; promessa inexistente, 404. */
function resultado<T>(r: Result<T, DomainError>): T {
  if (r.ok) return r.value;
  const corpo: ErroDeNegocio = {
    codigo: r.error.code,
    mensagem: r.error.message,
    detalhes: r.error.details,
  };
  if (r.error.code === 'promessa.nao_encontrada') throw new NotFoundException(corpo);
  throw new UnprocessableEntityException(corpo);
}

/** Duas pessoas alterando a mesma promessa ao mesmo tempo: a segunda recarrega e tenta de novo. */
async function emConflito<T>(acao: () => Promise<T>): Promise<T> {
  try {
    return await acao();
  } catch (erro) {
    if (erro instanceof ConflitoDeConcorrencia) {
      throw new ConflictException({
        codigo: 'promessa.alterada_por_outra_pessoa',
        mensagem: 'Outra pessoa alterou esta promessa agora há pouco. Recarregue e tente de novo.',
      });
    }
    throw erro;
  }
}
