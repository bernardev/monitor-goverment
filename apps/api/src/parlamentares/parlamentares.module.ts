import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { montarConsulta, SCHEMA_DA_CONSULTA } from '@prometeu/consulta';
import { BancoDoContexto, urlDoBanco } from '@prometeu/infraestrutura';

import { CONSULTA_DE_PARLAMENTARES, ParlamentaresController } from './parlamentares.controller.js';

const BANCO_DA_CONSULTA = Symbol('BancoDaConsulta');

/** A API pública só lê projeções do contexto Consulta (ADR-0008), com o usuário desse contexto. */
@Module({
  controllers: [ParlamentaresController],
  providers: [
    {
      provide: BANCO_DA_CONSULTA,
      useFactory: () =>
        BancoDoContexto.conectar(SCHEMA_DA_CONSULTA, urlDoBanco(SCHEMA_DA_CONSULTA)),
    },
    {
      provide: CONSULTA_DE_PARLAMENTARES,
      inject: [BANCO_DA_CONSULTA],
      useFactory: (banco: BancoDoContexto) => montarConsulta(banco).parlamentares,
    },
  ],
})
export class ParlamentaresModule implements OnApplicationShutdown {
  constructor(@Inject(BANCO_DA_CONSULTA) private readonly banco: BancoDoContexto) {}

  async onApplicationShutdown(): Promise<void> {
    await this.banco.fechar();
  }
}
