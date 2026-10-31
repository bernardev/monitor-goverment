import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { montarConsulta, SCHEMA_DA_CONSULTA } from '@prometeu/consulta';
import { BancoDoContexto, urlDoBanco } from '@prometeu/infraestrutura';

import { CONSULTA_DE_EMENDAS, EmendasController } from '../emendas/emendas.controller.js';
import { CONSULTA_DE_FONTES, FontesController } from '../fontes/fontes.controller.js';
import {
  CONSULTA_DE_MUNICIPIOS,
  MunicipiosController,
} from '../municipios/municipios.controller.js';
import { CONSULTA_DE_OBRAS, ObrasController } from '../obras/obras.controller.js';
import {
  CONSULTA_DE_PROPOSICOES,
  ProposicoesController,
} from '../proposicoes/proposicoes.controller.js';
import { VotacoesController } from '../votacoes/votacoes.controller.js';
import {
  CONSULTA_DE_FREQUENCIA,
  CONSULTA_DE_PARLAMENTARES,
  CONSULTA_DE_VOTACOES,
  ParlamentaresController,
} from './parlamentares.controller.js';

const BANCO_DA_CONSULTA = Symbol('BancoDaConsulta');

/**
 * Parlamentares, a atividade legislativa (votações e proposições), as emendas ao orçamento, as obras
 * que elas pagam e a situação das fontes. A API pública só lê projeções do contexto Consulta
 * (ADR-0008), com o usuário desse contexto.
 */
@Module({
  controllers: [
    ParlamentaresController,
    VotacoesController,
    ProposicoesController,
    EmendasController,
    ObrasController,
    FontesController,
    MunicipiosController,
  ],
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
    {
      provide: CONSULTA_DE_FREQUENCIA,
      inject: [BANCO_DA_CONSULTA],
      useFactory: (banco: BancoDoContexto) => montarConsulta(banco).frequencia,
    },
    {
      provide: CONSULTA_DE_VOTACOES,
      inject: [BANCO_DA_CONSULTA],
      useFactory: (banco: BancoDoContexto) => montarConsulta(banco).votacoes,
    },
    {
      provide: CONSULTA_DE_PROPOSICOES,
      inject: [BANCO_DA_CONSULTA],
      useFactory: (banco: BancoDoContexto) => montarConsulta(banco).proposicoes,
    },
    {
      provide: CONSULTA_DE_EMENDAS,
      inject: [BANCO_DA_CONSULTA],
      useFactory: (banco: BancoDoContexto) => montarConsulta(banco).emendas,
    },
    {
      provide: CONSULTA_DE_OBRAS,
      inject: [BANCO_DA_CONSULTA],
      useFactory: (banco: BancoDoContexto) => montarConsulta(banco).obras,
    },
    {
      provide: CONSULTA_DE_FONTES,
      inject: [BANCO_DA_CONSULTA],
      useFactory: (banco: BancoDoContexto) => montarConsulta(banco).fontes,
    },
    {
      provide: CONSULTA_DE_MUNICIPIOS,
      inject: [BANCO_DA_CONSULTA],
      useFactory: (banco: BancoDoContexto) => montarConsulta(banco).municipios,
    },
  ],
})
export class ParlamentaresModule implements OnApplicationShutdown {
  constructor(@Inject(BANCO_DA_CONSULTA) private readonly banco: BancoDoContexto) {}

  async onApplicationShutdown(): Promise<void> {
    await this.banco.fechar();
  }
}
