import type { CapturaRegistrada } from '@prometeu/acervo';
import type {
  FiliacaoPartidariaAlterada,
  FotoOficialAlterada,
  MandatoRegistrado,
  NomePublicoAlterado,
  PessoaRegistrada,
} from '@prometeu/agentes-publicos';
import type { EnvelopeDeEvento } from '@prometeu/contracts';
import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { and, eq, isNull, lte, or, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

import { captura, parlamentar } from './esquema.js';

type Dados<E extends { dados: unknown }> = E['dados'];

/**
 * Mantém a projeção `parlamentar` a partir dos eventos de Agentes Públicos e do Acervo. Cada evento
 * só altera os campos que conhece, e só se for mais novo do que o que já foi aplicado: a ordem de
 * chegada não importa, e reaplicar o mesmo evento não muda nada.
 */
export class ProjetorDeParlamentares {
  constructor(private readonly banco: BancoDoContexto) {}

  async aplicar(envelope: EnvelopeDeEvento): Promise<void> {
    const quando = new Date(envelope.ocorridoEm);
    const pessoaId = envelope.idDoAgregado;
    switch (envelope.tipo) {
      case 'PessoaRegistrada': {
        const dados = envelope.dados as Dados<PessoaRegistrada>;
        await this.garantirLinha(pessoaId, quando);
        await this.nome(pessoaId, dados.nome, quando);
        await this.partido(pessoaId, dados.siglaPartido, quando);
        await this.foto(pessoaId, dados.urlDaFoto, quando);
        await this.proveniencia(pessoaId, dados.capturaId, quando);
        return;
      }
      case 'NomePublicoAlterado': {
        const dados = envelope.dados as Dados<NomePublicoAlterado>;
        await this.garantirLinha(pessoaId, quando);
        await this.nome(pessoaId, dados.para, quando);
        await this.proveniencia(pessoaId, dados.capturaId, quando);
        return;
      }
      case 'FiliacaoPartidariaAlterada': {
        const dados = envelope.dados as Dados<FiliacaoPartidariaAlterada>;
        await this.garantirLinha(pessoaId, quando);
        await this.partido(pessoaId, dados.para, quando);
        await this.proveniencia(pessoaId, dados.capturaId, quando);
        return;
      }
      case 'FotoOficialAlterada': {
        const dados = envelope.dados as Dados<FotoOficialAlterada>;
        await this.garantirLinha(pessoaId, quando);
        await this.foto(pessoaId, dados.urlDaFoto, quando);
        await this.proveniencia(pessoaId, dados.capturaId, quando);
        return;
      }
      case 'MandatoRegistrado': {
        await this.garantirLinha(pessoaId, quando);
        await this.mandato(pessoaId, envelope.dados as Dados<MandatoRegistrado>);
        return;
      }
      case 'CapturaRegistrada': {
        const dados = envelope.dados as Dados<CapturaRegistrada>;
        await this.banco.executor
          .insert(captura)
          .values({
            capturaId: envelope.idDoAgregado,
            fonte: dados.fonte,
            url: dados.url,
            coletadaEm: new Date(dados.coletadaEm),
            sha256: dados.sha256,
          })
          .onConflictDoNothing();
        return;
      }
    }
  }

  private async garantirLinha(pessoaId: string, quando: Date): Promise<void> {
    await this.banco.executor
      .insert(parlamentar)
      .values({ pessoaId, atualizadoEm: quando })
      .onConflictDoNothing();
  }

  private nome(pessoaId: string, nome: string, quando: Date): Promise<void> {
    return this.seMaisNovo(pessoaId, parlamentar.nomeEm, quando, { nome, nomeEm: quando });
  }

  private partido(pessoaId: string, siglaPartido: string | null, quando: Date): Promise<void> {
    return this.seMaisNovo(pessoaId, parlamentar.partidoEm, quando, {
      siglaPartido,
      partidoEm: quando,
    });
  }

  private foto(pessoaId: string, urlDaFoto: string | null, quando: Date): Promise<void> {
    return this.seMaisNovo(pessoaId, parlamentar.fotoEm, quando, { urlDaFoto, fotoEm: quando });
  }

  private proveniencia(pessoaId: string, capturaId: string, quando: Date): Promise<void> {
    return this.seMaisNovo(pessoaId, parlamentar.atualizadoEm, quando, {
      capturaId,
      atualizadoEm: quando,
    });
  }

  /** O mandato exibido é o de posse mais recente. */
  private mandato(pessoaId: string, dados: Dados<MandatoRegistrado>): Promise<void> {
    const inicio = new Date(dados.inicio);
    return this.seMaisNovo(pessoaId, parlamentar.mandatoInicio, inicio, {
      mandatoId: dados.mandatoId,
      cargo: dados.cargo,
      circunscricao: dados.circunscricao,
      mandatoInicio: inicio,
      mandatoFim: dados.fim === null ? null : new Date(dados.fim),
      mandatoCapturaId: dados.capturaId,
    });
  }

  private async seMaisNovo(
    pessoaId: string,
    marco: PgColumn,
    quando: Date,
    campos: Partial<typeof parlamentar.$inferInsert>,
  ): Promise<void> {
    const maisNovo: SQL | undefined = or(isNull(marco), lte(marco, quando));
    await this.banco.executor
      .update(parlamentar)
      .set(campos)
      .where(and(eq(parlamentar.pessoaId, pessoaId), maisNovo));
  }
}

/** Eventos que esta projeção acompanha. */
export const EVENTOS_PROJETADOS = [
  'PessoaRegistrada',
  'NomePublicoAlterado',
  'FiliacaoPartidariaAlterada',
  'FotoOficialAlterada',
  'MandatoRegistrado',
  'CapturaRegistrada',
] as const;
