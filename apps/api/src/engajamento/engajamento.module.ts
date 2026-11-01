import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { montarConsulta, SCHEMA_DA_CONSULTA } from '@prometeu/consulta';
import { montarEngajamento, SCHEMA_DE_ENGAJAMENTO } from '@prometeu/engajamento';
import { BancoDoContexto, urlDoBanco } from '@prometeu/infraestrutura';

import {
  ALVOS,
  type AlvosAcompanhaveis,
  type Descricao,
  EngajamentoController,
  MODULO_ENGAJAMENTO,
} from './engajamento.controller.js';

const BANCOS = Symbol('BancosDoEngajamento');

interface Bancos {
  readonly engajamento: BancoDoContexto;
  readonly consulta: BancoDoContexto;
}

/**
 * A conta do cidadão: Engajamento guarda o que ele acompanha, cada contexto com o próprio usuário de
 * banco (ADR-0006); a Consulta diz se o político ou a cidade existem e como se chamam.
 */
@Module({
  controllers: [EngajamentoController],
  providers: [
    {
      provide: BANCOS,
      useFactory: (): Bancos => ({
        engajamento: BancoDoContexto.conectar(
          SCHEMA_DE_ENGAJAMENTO,
          urlDoBanco(SCHEMA_DE_ENGAJAMENTO),
          4,
        ),
        consulta: BancoDoContexto.conectar(SCHEMA_DA_CONSULTA, urlDoBanco(SCHEMA_DA_CONSULTA), 2),
      }),
    },
    {
      provide: MODULO_ENGAJAMENTO,
      inject: [BANCOS],
      useFactory: (bancos: Bancos) => montarEngajamento(bancos.engajamento),
    },
    {
      provide: ALVOS,
      inject: [BANCOS],
      useFactory: (bancos: Bancos): AlvosAcompanhaveis => {
        const consulta = montarConsulta(bancos.consulta);
        return {
          existe: async (tipo, id) =>
            (tipo === 'parlamentar'
              ? await consulta.parlamentares.porIds([id])
              : await consulta.municipios.porCodigos([id])
            ).length > 0,
          descrever: async (alvos) => {
            const ids = (tipo: string) => alvos.filter((a) => a.tipo === tipo).map((a) => a.id);
            const [parlamentares, municipios] = await Promise.all([
              consulta.parlamentares.porIds(ids('parlamentar')),
              consulta.municipios.porCodigos(ids('municipio')),
            ]);
            return new Map<string, Descricao>([
              ...parlamentares.map((p): [string, Descricao] => [
                `parlamentar:${p.pessoaId}`,
                {
                  titulo: p.nome,
                  detalhe:
                    [p.siglaPartido, p.uf].filter((parte) => parte !== null).join('-') || null,
                },
              ]),
              ...municipios.map((m): [string, Descricao] => [
                `municipio:${m.codigoIbge}`,
                { titulo: m.nome, detalhe: m.uf },
              ]),
            ]);
          },
        };
      },
    },
  ],
})
export class EngajamentoModule implements OnApplicationShutdown {
  constructor(@Inject(BANCOS) private readonly bancos: Bancos) {}

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([this.bancos.engajamento.fechar(), this.bancos.consulta.fechar()]);
  }
}
