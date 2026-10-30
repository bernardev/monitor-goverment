import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  type Papel,
  TokenInvalido,
  type Usuario,
  VerificadorDeToken,
} from './verificador-de-token.js';

const CHAVE_DOS_PAPEIS = 'papeis';

/** Papéis aceitos na rota; basta um deles (ADR-0014). */
export const Papeis = (...papeis: Papel[]): MethodDecorator & ClassDecorator =>
  SetMetadata(CHAVE_DOS_PAPEIS, papeis);

/** O que a guarda lê e escreve na requisição HTTP, sem depender do servidor por baixo do Nest. */
interface RequisicaoAutenticada {
  readonly headers: { readonly authorization?: string | undefined };
  usuario?: Usuario;
}

/** A pessoa autenticada na requisição; só existe em rotas protegidas pela guarda. */
export const UsuarioAtual = createParamDecorator(
  (_dado: unknown, contexto: ExecutionContext): Usuario => {
    const usuario = contexto.switchToHttp().getRequest<RequisicaoAutenticada>().usuario;
    if (!usuario) throw new UnauthorizedException({ mensagem: 'Login necessário.' });
    return usuario;
  },
);

/** 401 sem token válido; 403 com token válido sem nenhum dos papéis exigidos. */
@Injectable()
export class GuardaDeAutenticacao implements CanActivate {
  constructor(
    @Inject(VerificadorDeToken) private readonly verificador: VerificadorDeToken,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const requisicao = contexto.switchToHttp().getRequest<RequisicaoAutenticada>();
    const [esquema, token] = (requisicao.headers.authorization ?? '').split(' ');
    if (esquema !== 'Bearer' || !token) {
      throw new UnauthorizedException({ mensagem: 'Login necessário.' });
    }
    try {
      requisicao.usuario = await this.verificador.verificar(token);
    } catch (erro) {
      if (erro instanceof TokenInvalido) {
        throw new UnauthorizedException({ mensagem: 'Sessão inválida ou expirada.' });
      }
      throw erro;
    }

    const exigidos = this.reflector.getAllAndOverride<Papel[] | undefined>(CHAVE_DOS_PAPEIS, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    const { papeis } = requisicao.usuario;
    if (exigidos && !exigidos.some((papel) => papeis.includes(papel))) {
      throw new ForbiddenException({ mensagem: 'Seu papel não permite esta ação.' });
    }
    return true;
  }
}
