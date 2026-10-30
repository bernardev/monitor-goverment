import { type BancoDoContexto, gravarNaOutbox } from '@prometeu/infraestrutura';
import { and, eq } from 'drizzle-orm';

import type { RegistroDeFrequenciaRepository } from '../application/portas.js';
import { CASAS_LEGISLATIVAS, type CasaLegislativa } from '../domain/casa-legislativa.js';
import { DiaDeSessao } from '../domain/dia-de-sessao.js';
import {
  CapturaId,
  MandatoId,
  PessoaId,
  RegistroDeFrequenciaId,
} from '../domain/identificadores.js';
import { MotivoDaAusencia } from '../domain/motivo-da-ausencia.js';
import { RegistroDeFrequencia } from '../domain/registro-de-frequencia.js';
import { SITUACOES, type Situacao } from '../domain/situacao.js';
import { outbox, registroDeFrequencia } from './esquema.js';
import { ConflitoDeConcorrencia, confiavel, conhecido } from './persistencia.js';

export class RegistroDeFrequenciaRepositoryPostgres implements RegistroDeFrequenciaRepository {
  /** Versão lida de cada registro carregado por este repositório. */
  private readonly versoes = new WeakMap<RegistroDeFrequencia, number>();

  constructor(private readonly banco: BancoDoContexto) {}

  async buscar(
    casa: CasaLegislativa,
    pessoa: PessoaId,
    dia: DiaDeSessao,
  ): Promise<RegistroDeFrequencia | undefined> {
    const [linha] = await this.banco.executor
      .select()
      .from(registroDeFrequencia)
      .where(
        and(
          eq(registroDeFrequencia.casa, casa),
          eq(registroDeFrequencia.pessoaId, pessoa.valor),
          eq(registroDeFrequencia.dia, dia.valor),
        ),
      );
    if (!linha) return undefined;
    const encontrado = paraRegistro(linha);
    this.versoes.set(encontrado, linha.versao);
    return encontrado;
  }

  salvar(alvo: RegistroDeFrequencia): Promise<void> {
    return this.banco.transacao(async (tx) => {
      const versaoLida = this.versoes.get(alvo);
      const { apuracao } = alvo;
      const dados = {
        situacao: apuracao.situacao,
        motivoCategoria: apuracao.motivo?.categoria ?? null,
        motivoDescricao: apuracao.motivo?.descricaoNaFonte ?? null,
        registroNaFonte: apuracao.registroNaFonte,
        sessoes: apuracao.sessoes.map((s) => ({ descricao: s.descricao, presente: s.presente })),
        capturaId: alvo.captura.valor,
      };
      if (versaoLida === undefined) {
        await tx.insert(registroDeFrequencia).values({
          id: alvo.id.valor,
          casa: alvo.casa,
          dia: alvo.dia.valor,
          pessoaId: alvo.pessoa.valor,
          mandatoId: alvo.mandato.valor,
          ...dados,
          versao: 1,
        });
      } else {
        const atualizados = await tx
          .update(registroDeFrequencia)
          .set({ ...dados, versao: versaoLida + 1 })
          .where(
            and(
              eq(registroDeFrequencia.id, alvo.id.valor),
              eq(registroDeFrequencia.versao, versaoLida),
            ),
          )
          .returning({ id: registroDeFrequencia.id });
        if (atualizados.length === 0)
          throw new ConflitoDeConcorrencia(`O registro de frequência ${alvo.id.valor}`);
      }
      this.versoes.set(alvo, (versaoLida ?? 0) + 1);
      await gravarNaOutbox(tx, outbox, alvo.pullDomainEvents());
    });
  }
}

function paraRegistro(linha: typeof registroDeFrequencia.$inferSelect): RegistroDeFrequencia {
  const casa = conhecido(CASAS_LEGISLATIVAS, linha.casa, 'casa');
  const situacao: Situacao = conhecido(SITUACOES, linha.situacao, 'situação');
  const motivo =
    linha.motivoCategoria === null
      ? undefined
      : confiavel(MotivoDaAusencia.criar(linha.motivoCategoria, linha.motivoDescricao ?? ''));
  return RegistroDeFrequencia.reconstituir(confiavel(RegistroDeFrequenciaId.de(linha.id)), {
    casa,
    dia: confiavel(DiaDeSessao.de(linha.dia)),
    pessoa: confiavel(PessoaId.de(linha.pessoaId)),
    mandato: confiavel(MandatoId.de(linha.mandatoId)),
    apuracao: {
      situacao,
      motivo,
      registroNaFonte: linha.registroNaFonte,
      sessoes: linha.sessoes,
    },
    captura: confiavel(CapturaId.de(linha.capturaId)),
  });
}
