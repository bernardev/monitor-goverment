import { Inject, Module, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { montarCapturaDeDocumentos, SCHEMA_DO_ACERVO } from '@prometeu/acervo';
import { montarConsultaDeMandatos, SCHEMA_DE_AGENTES_PUBLICOS } from '@prometeu/agentes-publicos';
import { montarCompromissos, SCHEMA_DE_COMPROMISSOS } from '@prometeu/compromissos';
import { montarConsulta, SCHEMA_DA_CONSULTA } from '@prometeu/consulta';
import { BancoDoContexto, urlDoBanco } from '@prometeu/infraestrutura';

import {
  CAPTURAR_DOCUMENTO,
  EditorialController,
  FATOS,
  type FatosParaVinculo,
  MODULO_COMPROMISSOS,
} from './editorial.controller.js';

const BANCOS = Symbol('BancosDaEditorial');
const PREPARAR_CAPTURAS = Symbol('PrepararCapturas');

interface Bancos {
  readonly compromissos: BancoDoContexto;
  readonly agentesPublicos: BancoDoContexto;
  readonly acervo: BancoDoContexto;
  readonly consulta: BancoDoContexto;
}

function configuracaoDoS3(ambiente: NodeJS.ProcessEnv = process.env) {
  return {
    endpoint: ambiente['S3_ENDPOINT'] ?? 'http://localhost:9000',
    chaveDeAcesso: ambiente['S3_ACCESS_KEY'] ?? 'prometeu',
    segredo: ambiente['S3_SECRET_KEY'] ?? 'desenvolvimento',
    balde: ambiente['S3_BALDE_CAPTURAS'] ?? 'prometeu-capturas',
  };
}

/**
 * Composição da API editorial: cada contexto com o próprio usuário de banco (ADR-0006). Agentes
 * Públicos só é lido (mandatos); o Acervo registra as capturas da curadoria; a Consulta dá os fatos
 * que a curadoria liga às promessas.
 */
@Module({
  controllers: [EditorialController],
  providers: [
    {
      provide: BANCOS,
      useFactory: (): Bancos => ({
        compromissos: BancoDoContexto.conectar(
          SCHEMA_DE_COMPROMISSOS,
          urlDoBanco(SCHEMA_DE_COMPROMISSOS),
        ),
        agentesPublicos: BancoDoContexto.conectar(
          SCHEMA_DE_AGENTES_PUBLICOS,
          urlDoBanco(SCHEMA_DE_AGENTES_PUBLICOS),
          2,
        ),
        acervo: BancoDoContexto.conectar(SCHEMA_DO_ACERVO, urlDoBanco(SCHEMA_DO_ACERVO), 2),
        consulta: BancoDoContexto.conectar(SCHEMA_DA_CONSULTA, urlDoBanco(SCHEMA_DA_CONSULTA), 2),
      }),
    },
    {
      provide: FATOS,
      inject: [BANCOS],
      useFactory: (bancos: Bancos): FatosParaVinculo => {
        const consulta = montarConsulta(bancos.consulta);
        const fontes = {
          emenda: (id: string) => consulta.emendas.buscar(id),
          obra: (id: string) => consulta.obras.buscar(id),
          proposicao: (id: string) => consulta.proposicoes.buscar(id),
        };
        return {
          candidatos: (pessoaId, texto) => consulta.candidatos.doAutor(pessoaId, texto),
          capturaDoFato: async (tipo, id) => (await fontes[tipo](id))?.fonte.capturaId,
        };
      },
    },
    {
      provide: MODULO_COMPROMISSOS,
      inject: [BANCOS],
      useFactory: (bancos: Bancos) =>
        montarCompromissos({
          banco: bancos.compromissos,
          mandatos: montarConsultaDeMandatos(bancos.agentesPublicos),
        }),
    },
    {
      provide: PREPARAR_CAPTURAS,
      inject: [BANCOS],
      useFactory: (bancos: Bancos) =>
        montarCapturaDeDocumentos({ banco: bancos.acervo, s3: configuracaoDoS3() }),
    },
    {
      provide: CAPTURAR_DOCUMENTO,
      inject: [PREPARAR_CAPTURAS],
      useFactory: (captura: ReturnType<typeof montarCapturaDeDocumentos>) =>
        captura.capturarDocumento,
    },
  ],
})
export class EditorialModule implements OnModuleInit, OnApplicationShutdown {
  constructor(
    @Inject(BANCOS) private readonly bancos: Bancos,
    @Inject(PREPARAR_CAPTURAS)
    private readonly captura: ReturnType<typeof montarCapturaDeDocumentos>,
  ) {}

  /** Cria o balde das capturas, se faltar; sem ele, capturar falharia na primeira vez. */
  async onModuleInit(): Promise<void> {
    if (process.env['NODE_ENV'] !== 'test') await this.captura.preparar();
  }

  async onApplicationShutdown(): Promise<void> {
    const { compromissos, agentesPublicos, acervo, consulta } = this.bancos;
    await Promise.all([
      compromissos.fechar(),
      agentesPublicos.fechar(),
      acervo.fechar(),
      consulta.fechar(),
    ]);
  }
}
