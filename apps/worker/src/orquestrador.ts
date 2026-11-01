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
  type ResumoDaImportacao as ResumoDeDeputados,
  SCHEMA_DE_AGENTES_PUBLICOS,
} from '@prometeu/agentes-publicos';
import {
  MIGRACOES_DE_ATIVIDADE_LEGISLATIVA,
  montarAtividadeLegislativa,
  type ResumoDaImportacao as ResumoDeAtividadeLegislativa,
  SCHEMA_DE_ATIVIDADE_LEGISLATIVA,
} from '@prometeu/atividade-legislativa';
import {
  MIGRACOES_DE_COMPROMISSOS,
  montarCompromissos,
  SCHEMA_DE_COMPROMISSOS,
} from '@prometeu/compromissos';
import { MIGRACOES_DE_ENGAJAMENTO, SCHEMA_DE_ENGAJAMENTO } from '@prometeu/engajamento';
import { MIGRACOES_DA_CONSULTA, montarConsulta, SCHEMA_DA_CONSULTA } from '@prometeu/consulta';
import {
  MIGRACOES_DE_FINANCAS_PUBLICAS,
  montarFinancasPublicas,
  type ResumoDaImportacao as ResumoDeFinancasPublicas,
  SCHEMA_DE_FINANCAS_PUBLICAS,
} from '@prometeu/financas-publicas';
import {
  MIGRACOES_DE_OBRAS,
  montarObras,
  type ResumoDaImportacao as ResumoDeObras,
  SCHEMA_DE_OBRAS,
} from '@prometeu/obras';
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
/** O que cada importação de Atividade Legislativa conta como novo, para o log. */
const UNIDADES: Readonly<Record<ResumoDeAtividadeLegislativa['importacao'], string>> = {
  frequencia_da_camara: 'dias novos',
  votacoes_da_camara: 'votações novas',
  votacoes_do_senado: 'votações novas',
  proposicoes_da_camara: 'proposições novas',
  proposicoes_do_senado: 'proposições novas',
};

/** O que cada importação de Finanças Públicas conta como novo, para o log. */
const UNIDADES_DE_FINANCAS: Readonly<Record<ResumoDeFinancasPublicas['importacao'], string>> = {
  emendas: 'emendas novas',
  favorecidos: 'listas de favorecidos novas',
  convenios: 'convênios novos',
};

@Injectable()
export class Orquestrador implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(Orquestrador.name);
  private readonly bancos = {
    acervo: BancoDoContexto.conectar(SCHEMA_DO_ACERVO, urlDoBanco(SCHEMA_DO_ACERVO)),
    agentesPublicos: BancoDoContexto.conectar(
      SCHEMA_DE_AGENTES_PUBLICOS,
      urlDoBanco(SCHEMA_DE_AGENTES_PUBLICOS),
    ),
    atividadeLegislativa: BancoDoContexto.conectar(
      SCHEMA_DE_ATIVIDADE_LEGISLATIVA,
      urlDoBanco(SCHEMA_DE_ATIVIDADE_LEGISLATIVA),
    ),
    compromissos: BancoDoContexto.conectar(
      SCHEMA_DE_COMPROMISSOS,
      urlDoBanco(SCHEMA_DE_COMPROMISSOS),
    ),
    consulta: BancoDoContexto.conectar(SCHEMA_DA_CONSULTA, urlDoBanco(SCHEMA_DA_CONSULTA)),
    // Só para migrar: o worker ainda não consome eventos para o Engajamento (os alertas, etapa 6.3).
    engajamento: BancoDoContexto.conectar(
      SCHEMA_DE_ENGAJAMENTO,
      urlDoBanco(SCHEMA_DE_ENGAJAMENTO),
      1,
    ),
    financasPublicas: BancoDoContexto.conectar(
      SCHEMA_DE_FINANCAS_PUBLICAS,
      urlDoBanco(SCHEMA_DE_FINANCAS_PUBLICAS),
    ),
    obras: BancoDoContexto.conectar(SCHEMA_DE_OBRAS, urlDoBanco(SCHEMA_DE_OBRAS)),
    ingestao: BancoDoContexto.conectar('ingestao', urlDoBanco('ingestao')),
  };
  private barramento: BarramentoPgBoss | undefined;
  private readonly relays: RelayDaOutbox[] = [];

  async onApplicationBootstrap(): Promise<void> {
    await migrar(this.bancos.acervo, MIGRACOES_DO_ACERVO);
    await migrar(this.bancos.agentesPublicos, MIGRACOES_DE_AGENTES_PUBLICOS);
    await migrar(this.bancos.atividadeLegislativa, MIGRACOES_DE_ATIVIDADE_LEGISLATIVA);
    await migrar(this.bancos.compromissos, MIGRACOES_DE_COMPROMISSOS);
    await migrar(this.bancos.consulta, MIGRACOES_DA_CONSULTA);
    await migrar(this.bancos.engajamento, MIGRACOES_DE_ENGAJAMENTO);
    await migrar(this.bancos.financasPublicas, MIGRACOES_DE_FINANCAS_PUBLICAS);
    await migrar(this.bancos.obras, MIGRACOES_DE_OBRAS);
    this.logger.log('Migrações aplicadas.');

    const barramento = await BarramentoPgBoss.iniciar(urlDoBanco('barramento'));
    this.barramento = barramento;

    const acervo = montarAcervo(this.bancos.acervo);
    const agentesPublicos = montarAgentesPublicos({
      banco: this.bancos.agentesPublicos,
      registrarCaptura: acervo.registrarCaptura,
    });
    const atividadeLegislativa = montarAtividadeLegislativa({
      banco: this.bancos.atividadeLegislativa,
      registrarCaptura: acervo.registrarCaptura,
      mandatos: agentesPublicos.mandatos,
      pessoas: agentesPublicos.pessoas,
    });
    const financasPublicas = montarFinancasPublicas({
      banco: this.bancos.financasPublicas,
      registrarCaptura: acervo.registrarCaptura,
      pessoas: agentesPublicos.pessoas,
    });
    const consulta = montarConsulta(this.bancos.consulta);
    const compromissos = montarCompromissos({
      banco: this.bancos.compromissos,
      mandatos: agentesPublicos.mandatos,
    });

    await agentesPublicos.assinarConsumidores(barramento, (resumo) => {
      this.relatar(resumo, `${String(resumo.pessoasNovas)} pessoas novas`);
    });
    await atividadeLegislativa.assinarConsumidores(barramento, (resumo) => {
      const unidade = UNIDADES[resumo.importacao];
      this.relatar(resumo, `${String(resumo.novos)} ${unidade}`);
    });
    await financasPublicas.assinarConsumidores(barramento, (resumo) => {
      this.relatar(resumo, `${String(resumo.novos)} ${UNIDADES_DE_FINANCAS[resumo.importacao]}`);
    });
    const obras = montarObras({
      banco: this.bancos.obras,
      registrarCaptura: acervo.registrarCaptura,
    });
    await obras.assinarConsumidores(barramento, (resumo) => {
      this.relatar(resumo, `${String(resumo.novos)} obras novas`);
    });
    await consulta.assinarConsumidores(barramento);
    await compromissos.assinarConsumidores(barramento);

    this.relays.push(
      new RelayDaOutbox(this.bancos.ingestao, outboxDaIngestao, barramento),
      acervo.criarRelay(barramento),
      agentesPublicos.criarRelay(barramento),
      atividadeLegislativa.criarRelay(barramento),
      compromissos.criarRelay(barramento),
      financasPublicas.criarRelay(barramento),
      obras.criarRelay(barramento),
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

  private relatar(
    resumo:
      ResumoDeDeputados | ResumoDeAtividadeLegislativa | ResumoDeFinancasPublicas | ResumoDeObras,
    novidades: string,
  ): void {
    this.logger.log(
      `Lote ${resumo.loteId}: ${String(resumo.lidos)} lidos, ${novidades}, ` +
        `${String(resumo.falhas.length)} recusados.`,
    );
    for (const falha of resumo.falhas) {
      this.logger.warn(
        `Recusado na fonte ${falha.codigoNaFonte}: ${falha.erro} (${falha.mensagem})`,
      );
    }
  }
}
