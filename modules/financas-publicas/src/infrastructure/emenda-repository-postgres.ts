import { type BancoDoContexto, gravarNaOutbox } from '@prometeu/infraestrutura';
import { Dinheiro } from '@prometeu/shared-kernel';
import { and, eq } from 'drizzle-orm';

import type { EmendaRepository } from '../application/portas.js';
import { Emenda } from '../domain/emenda.js';
import { CapturaId, EmendaId, PessoaId } from '../domain/identificadores.js';
import { MODALIDADES, TIPOS_DE_EMENDA } from '../domain/tipo-de-emenda.js';
import { emenda, outbox } from './esquema.js';
import { ConflitoDeConcorrencia, confiavel, conhecido } from './persistencia.js';

export class EmendaRepositoryPostgres implements EmendaRepository {
  /** Versão lida de cada emenda carregada por este repositório. */
  private readonly versoes = new WeakMap<Emenda, number>();

  constructor(private readonly banco: BancoDoContexto) {}

  async buscar(codigoNaFonte: string): Promise<Emenda | undefined> {
    const [linha] = await this.banco.executor
      .select()
      .from(emenda)
      .where(eq(emenda.codigoNaFonte, codigoNaFonte));
    if (!linha) return undefined;
    const encontrada = paraEmenda(linha);
    this.versoes.set(encontrada, linha.versao);
    return encontrada;
  }

  salvar(alvo: Emenda): Promise<void> {
    return this.banco.transacao(async (tx) => {
      const versaoLida = this.versoes.get(alvo);
      const a = alvo.apuracao;
      const dados = {
        ano: a.ano,
        tipo: a.tipo,
        numero: a.numero,
        autor: {
          pessoaId: a.autor.pessoa?.valor ?? null,
          nomeNaFonte: a.autor.nomeNaFonte,
          codigoNaFonte: a.autor.codigoNaFonte,
        },
        destinacoes: a.destinacoes.map((d) => ({
          localidade: d.localidade,
          municipioIbge: d.municipioIbge,
          ufIbge: d.ufIbge,
          funcao: { ...d.funcao },
          subfuncao: { ...d.subfuncao },
          programa: { ...d.programa },
          acao: { ...d.acao },
          planoOrcamentario: { ...d.planoOrcamentario },
          modalidade: d.modalidade,
          empenhado: d.execucao.empenhado.centavos.toString(),
          liquidado: d.execucao.liquidado.centavos.toString(),
          pago: d.execucao.pago.centavos.toString(),
          restosInscritos: d.execucao.restosInscritos.centavos.toString(),
          restosCancelados: d.execucao.restosCancelados.centavos.toString(),
          restosPagos: d.execucao.restosPagos.centavos.toString(),
        })),
        capturaId: alvo.captura.valor,
      };
      if (versaoLida === undefined) {
        await tx
          .insert(emenda)
          .values({ id: alvo.id.valor, codigoNaFonte: alvo.codigoNaFonte, ...dados, versao: 1 });
      } else {
        const atualizadas = await tx
          .update(emenda)
          .set({ ...dados, versao: versaoLida + 1 })
          .where(and(eq(emenda.id, alvo.id.valor), eq(emenda.versao, versaoLida)))
          .returning({ id: emenda.id });
        if (atualizadas.length === 0) {
          throw new ConflitoDeConcorrencia(`A emenda ${alvo.id.valor}`);
        }
      }
      this.versoes.set(alvo, (versaoLida ?? 0) + 1);
      await gravarNaOutbox(tx, outbox, alvo.pullDomainEvents());
    });
  }
}

function paraEmenda(linha: typeof emenda.$inferSelect): Emenda {
  const real = (centavos: string) => confiavel(Dinheiro.deCentavos(BigInt(centavos)));
  return Emenda.reconstituir(confiavel(EmendaId.de(linha.id)), {
    codigoNaFonte: linha.codigoNaFonte,
    apuracao: {
      ano: linha.ano,
      tipo: conhecido(TIPOS_DE_EMENDA, linha.tipo, 'tipo de emenda'),
      numero: linha.numero,
      autor: {
        pessoa:
          linha.autor.pessoaId === null ? undefined : confiavel(PessoaId.de(linha.autor.pessoaId)),
        nomeNaFonte: linha.autor.nomeNaFonte,
        codigoNaFonte: linha.autor.codigoNaFonte,
      },
      destinacoes: linha.destinacoes.map((d) => ({
        localidade: d.localidade,
        municipioIbge: d.municipioIbge,
        ufIbge: d.ufIbge,
        funcao: d.funcao,
        subfuncao: d.subfuncao,
        programa: d.programa,
        acao: d.acao,
        planoOrcamentario: d.planoOrcamentario,
        modalidade:
          d.modalidade === null ? null : conhecido(MODALIDADES, d.modalidade, 'modalidade'),
        execucao: {
          empenhado: real(d.empenhado),
          liquidado: real(d.liquidado),
          pago: real(d.pago),
          restosInscritos: real(d.restosInscritos),
          restosCancelados: real(d.restosCancelados),
          restosPagos: real(d.restosPagos),
        },
      })),
    },
    captura: confiavel(CapturaId.de(linha.capturaId)),
  });
}
