import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { MIGRACOES_DO_ACERVO, montarAcervo, SCHEMA_DO_ACERVO } from '@prometeu/acervo';
import {
  MIGRACOES_DE_AGENTES_PUBLICOS,
  montarAgentesPublicos,
  type ResumoDaImportacao,
  SCHEMA_DE_AGENTES_PUBLICOS,
} from '@prometeu/agentes-publicos';
import { MIGRACOES_DA_CONSULTA, montarConsulta, SCHEMA_DA_CONSULTA } from '@prometeu/consulta';
import {
  BancoDoContexto,
  BarramentoPgBoss,
  migrar,
  outboxDaIngestao,
  RelayDaOutbox,
  urlDoBanco,
} from '@prometeu/infraestrutura';

/**
 * Raiz de composição do processo de fundo (ADR-0007, ADR-0015): cada contexto com o próprio usuário de
 * banco, um relay por outbox e os consumidores de eventos de cada módulo.
 */
@Injectable()
export class Orquestrador implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(Orquestrador.name);
  private readonly bancos = {
    acervo: BancoDoContexto.conectar(SCHEMA_DO_ACERVO, urlDoBanco(SCHEMA_DO_ACERVO)),
    agentesPublicos: BancoDoContexto.conectar(
      SCHEMA_DE_AGENTES_PUBLICOS,
      urlDoBanco(SCHEMA_DE_AGENTES_PUBLICOS),
    ),
    consulta: BancoDoContexto.conectar(SCHEMA_DA_CONSULTA, urlDoBanco(SCHEMA_DA_CONSULTA)),
    ingestao: BancoDoContexto.conectar('ingestao', urlDoBanco('ingestao')),
  };
  private barramento: BarramentoPgBoss | undefined;
  private readonly relays: RelayDaOutbox[] = [];

  async onApplicationBootstrap(): Promise<void> {
    await migrar(this.bancos.acervo, MIGRACOES_DO_ACERVO);
    await migrar(this.bancos.agentesPublicos, MIGRACOES_DE_AGENTES_PUBLICOS);
    await migrar(this.bancos.consulta, MIGRACOES_DA_CONSULTA);
    this.logger.log('Migrações aplicadas.');

    const barramento = await BarramentoPgBoss.iniciar(urlDoBanco('barramento'));
    this.barramento = barramento;

    const acervo = montarAcervo(this.bancos.acervo);
    const agentesPublicos = montarAgentesPublicos({
      banco: this.bancos.agentesPublicos,
      registrarCaptura: acervo.registrarCaptura,
    });
    const consulta = montarConsulta(this.bancos.consulta);

    await agentesPublicos.assinarConsumidores(barramento, (resumo) => {
      this.relatar(resumo);
    });
    await consulta.assinarConsumidores(barramento);

    this.relays.push(
      new RelayDaOutbox(this.bancos.ingestao, outboxDaIngestao, barramento),
      acervo.criarRelay(barramento),
      agentesPublicos.criarRelay(barramento),
    );
    for (const relay of this.relays) {
      relay.iniciar(1000, (erro) => {
        this.logger.error('Falha no relay da outbox.', erro);
      });
    }
    this.logger.log('Worker pronto: relays e consumidores ativos.');
  }

  async onApplicationShutdown(): Promise<void> {
    for (const relay of this.relays) relay.parar();
    await this.barramento?.fechar();
    await Promise.all(Object.values(this.bancos).map((banco) => banco.fechar()));
  }

  private relatar(resumo: ResumoDaImportacao): void {
    this.logger.log(
      `Lote ${resumo.loteId}: ${resumo.lidos} lidos, ${resumo.pessoasNovas} pessoas novas, ` +
        `${resumo.falhas.length} recusados.`,
    );
    for (const falha of resumo.falhas) {
      this.logger.warn(
        `Recusado na fonte ${falha.codigoNaFonte}: ${falha.erro} (${falha.mensagem})`,
      );
    }
  }
}
