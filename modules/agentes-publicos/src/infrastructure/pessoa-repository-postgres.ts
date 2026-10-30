import { type BancoDoContexto, gravarNaOutbox } from '@prometeu/infraestrutura';
import { CodigoIbge, type DomainError, Periodo, type Result } from '@prometeu/shared-kernel';
import { and, eq } from 'drizzle-orm';

import type { PessoaRepository } from '../application/portas.js';
import { CARGOS } from '../domain/cargo.js';
import { IdentificadorExterno } from '../domain/identificador-externo.js';
import { CapturaId, MandatoId, PessoaId } from '../domain/identificadores.js';
import { Mandato } from '../domain/mandato.js';
import { NomePublico } from '../domain/nome-publico.js';
import { Pessoa } from '../domain/pessoa.js';
import { SiglaPartidaria } from '../domain/sigla-partidaria.js';
import { UrlPublica } from '../domain/url-publica.js';
import { identificadorExterno, mandato, outbox, pessoa } from './esquema.js';

/** Outra gravação mudou a pessoa entre a leitura e a escrita; o consumidor tenta de novo. */
export class ConflitoDeConcorrencia extends Error {
  constructor(pessoaId: string) {
    super(`A pessoa ${pessoaId} foi alterada por outra gravação.`);
  }
}

export class PessoaRepositoryPostgres implements PessoaRepository {
  /** Versão lida de cada pessoa carregada por este repositório. */
  private readonly versoes = new WeakMap<Pessoa, number>();

  constructor(private readonly banco: BancoDoContexto) {}

  async buscarPorIdentificador(identificador: IdentificadorExterno): Promise<Pessoa | undefined> {
    const executor = this.banco.executor;
    const [linha] = await executor
      .select({ pessoa })
      .from(identificadorExterno)
      .innerJoin(pessoa, eq(pessoa.id, identificadorExterno.pessoaId))
      .where(
        and(
          eq(identificadorExterno.fonte, identificador.fonte),
          eq(identificadorExterno.codigo, identificador.codigo),
        ),
      );
    if (!linha) return undefined;

    const identificadores = await executor
      .select()
      .from(identificadorExterno)
      .where(eq(identificadorExterno.pessoaId, linha.pessoa.id));
    const mandatos = await executor
      .select()
      .from(mandato)
      .where(eq(mandato.pessoaId, linha.pessoa.id));

    const encontrada = Pessoa.reconstituir(confiavel(PessoaId.de(linha.pessoa.id)), {
      nome: confiavel(NomePublico.criar(linha.pessoa.nome)),
      filiacao: opcional(linha.pessoa.siglaPartido, SiglaPartidaria.criar),
      foto: opcional(linha.pessoa.urlDaFoto, UrlPublica.criar),
      identificadores: identificadores.map((i) =>
        confiavel(IdentificadorExterno.criar(i.fonte, i.codigo)),
      ),
      mandatos: mandatos.map(paraMandato),
    });
    this.versoes.set(encontrada, linha.pessoa.versao);
    return encontrada;
  }

  salvar(alvo: Pessoa): Promise<void> {
    return this.banco.transacao(async (tx) => {
      const versaoLida = this.versoes.get(alvo);
      const dados = {
        nome: alvo.nome.valor,
        siglaPartido: alvo.filiacao?.valor ?? null,
        urlDaFoto: alvo.foto?.valor ?? null,
      };
      if (versaoLida === undefined) {
        await tx.insert(pessoa).values({ id: alvo.id.valor, ...dados, versao: 1 });
      } else {
        const atualizadas = await tx
          .update(pessoa)
          .set({ ...dados, versao: versaoLida + 1 })
          .where(and(eq(pessoa.id, alvo.id.valor), eq(pessoa.versao, versaoLida)))
          .returning({ id: pessoa.id });
        if (atualizadas.length === 0) throw new ConflitoDeConcorrencia(alvo.id.valor);
      }
      this.versoes.set(alvo, (versaoLida ?? 0) + 1);

      await tx
        .insert(identificadorExterno)
        .values(
          alvo.identificadores.map((i) => ({
            fonte: i.fonte,
            codigo: i.codigo,
            pessoaId: alvo.id.valor,
          })),
        )
        .onConflictDoNothing();
      // Mandatos não mudam depois de registrados: só os novos entram.
      if (alvo.mandatos.length > 0) {
        await tx
          .insert(mandato)
          .values(
            alvo.mandatos.map((m) => ({
              id: m.id.valor,
              pessoaId: alvo.id.valor,
              cargo: m.cargo,
              circunscricao: m.circunscricao.valor,
              inicio: m.periodo.inicio,
              fim: m.periodo.fim ?? null,
              capturaId: m.captura.valor,
            })),
          )
          .onConflictDoNothing();
      }
      await gravarNaOutbox(tx, outbox, alvo.pullDomainEvents());
    });
  }
}

function paraMandato(linha: typeof mandato.$inferSelect): Mandato {
  const cargo = CARGOS.find((c) => c === linha.cargo);
  if (cargo === undefined) throw new Error(`Cargo desconhecido no banco: ${linha.cargo}`);
  return Mandato.reconstituir(confiavel(MandatoId.de(linha.id)), {
    cargo,
    circunscricao: confiavel(CodigoIbge.criar(linha.circunscricao)),
    periodo: confiavel(Periodo.criar(linha.inicio, linha.fim ?? undefined)),
    captura: confiavel(CapturaId.de(linha.capturaId)),
  });
}

/** O banco só guarda o que o domínio validou; um valor inválido aqui é dado corrompido. */
function confiavel<T>(resultado: Result<T, DomainError>): T {
  if (!resultado.ok) {
    throw new Error(`Dado corrompido em agentes_publicos: ${resultado.error.message}`);
  }
  return resultado.value;
}

function opcional<T>(
  valor: string | null,
  fabrica: (valor: string) => Result<T, DomainError>,
): T | undefined {
  return valor === null ? undefined : confiavel(fabrica(valor));
}
