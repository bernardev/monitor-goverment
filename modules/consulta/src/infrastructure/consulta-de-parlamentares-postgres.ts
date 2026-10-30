import type {
  FonteDoDado,
  Pagina,
  ParlamentarResumo,
  PerfilDeParlamentar,
} from '@prometeu/contracts';
import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { CodigoIbge } from '@prometeu/shared-kernel';
import { and, asc, count, eq, gte, isNotNull, isNull, lte, or, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type {
  ConsultaDeParlamentares,
  FiltroDeParlamentares,
  Relogio,
} from '../application/portas.js';
import { captura, parlamentar } from './esquema.js';

const capturaDoMandato = alias(captura, 'captura_do_mandato');

type Linha = typeof parlamentar.$inferSelect;
type LinhaComNome = Linha & { nome: string };

export class ConsultaDeParlamentaresPostgres implements ConsultaDeParlamentares {
  constructor(
    private readonly banco: BancoDoContexto,
    private readonly relogio: Relogio,
  ) {}

  /** Só quem está no cargo agora; quem já saiu continua com o perfil acessível pelo id. */
  async listar(filtro: FiltroDeParlamentares): Promise<Pagina<ParlamentarResumo>> {
    const agora = this.relogio.agora();
    const condicoes: (SQL | undefined)[] = [
      isNotNull(parlamentar.nome),
      lte(parlamentar.mandatoInicio, agora),
      or(isNull(parlamentar.mandatoFim), gte(parlamentar.mandatoFim, agora)),
    ];
    if (filtro.uf !== undefined) {
      const uf = CodigoIbge.daUf(filtro.uf);
      if (!uf.ok) return paginaVazia(filtro);
      condicoes.push(eq(parlamentar.circunscricao, uf.value.valor));
    }
    if (filtro.partido !== undefined) condicoes.push(eq(parlamentar.siglaPartido, filtro.partido));
    const onde = and(...condicoes);

    const [linhas, [total]] = await Promise.all([
      this.banco.drizzle
        .select()
        .from(parlamentar)
        .where(onde)
        .orderBy(asc(parlamentar.nome), asc(parlamentar.pessoaId))
        .limit(filtro.itensPorPagina)
        .offset((filtro.pagina - 1) * filtro.itensPorPagina),
      this.banco.drizzle.select({ total: count() }).from(parlamentar).where(onde),
    ]);
    return {
      itens: linhas.filter(temNome).map(paraResumo),
      pagina: filtro.pagina,
      itensPorPagina: filtro.itensPorPagina,
      total: total?.total ?? 0,
    };
  }

  async buscar(pessoaId: string): Promise<PerfilDeParlamentar | undefined> {
    const [linha] = await this.banco.drizzle
      .select({ parlamentar, captura, capturaDoMandato })
      .from(parlamentar)
      .leftJoin(captura, eq(captura.capturaId, parlamentar.capturaId))
      .leftJoin(capturaDoMandato, eq(capturaDoMandato.capturaId, parlamentar.mandatoCapturaId))
      .where(eq(parlamentar.pessoaId, pessoaId));
    // Sem nome ou sem captura, o perfil ainda não tem o evento de registro: não é exibido.
    const p = linha?.parlamentar;
    if (!linha || !p || !temNome(p) || p.capturaId === null) return undefined;
    return {
      ...paraResumo(p),
      fonte: fonte(p.capturaId, linha.captura),
      mandato:
        p.mandatoId && p.cargo && p.circunscricao && p.mandatoInicio && p.mandatoCapturaId
          ? {
              mandatoId: p.mandatoId,
              cargo: p.cargo,
              circunscricao: p.circunscricao,
              inicio: p.mandatoInicio.toISOString(),
              fim: p.mandatoFim?.toISOString() ?? null,
              fonte: fonte(p.mandatoCapturaId, linha.capturaDoMandato),
            }
          : null,
      atualizadoEm: p.atualizadoEm.toISOString(),
    };
  }
}

function temNome(linha: Linha): linha is LinhaComNome {
  return linha.nome !== null;
}

function paraResumo(linha: LinhaComNome): ParlamentarResumo {
  const ente = linha.circunscricao === null ? undefined : CodigoIbge.criar(linha.circunscricao);
  return {
    pessoaId: linha.pessoaId,
    nome: linha.nome,
    siglaPartido: linha.siglaPartido,
    uf: ente?.ok ? (ente.value.uf() ?? null) : null,
    cargo: linha.cargo,
    urlDaFoto: linha.urlDaFoto,
  };
}

function fonte(capturaId: string, linha: typeof captura.$inferSelect | null): FonteDoDado {
  return {
    capturaId,
    url: linha?.url ?? null,
    coletadaEm: linha?.coletadaEm.toISOString() ?? null,
  };
}

function paginaVazia(filtro: FiltroDeParlamentares): Pagina<ParlamentarResumo> {
  return { itens: [], pagina: filtro.pagina, itensPorPagina: filtro.itensPorPagina, total: 0 };
}
