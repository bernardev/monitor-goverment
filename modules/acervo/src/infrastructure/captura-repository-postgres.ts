import { type BancoDoContexto, gravarNaOutbox } from '@prometeu/infraestrutura';
import { eq } from 'drizzle-orm';

import type { CapturaRepository } from '../application/portas.js';
import { Captura } from '../domain/captura.js';
import { HashSha256 } from '../domain/hash-sha256.js';
import { CapturaId } from '../domain/identificadores.js';
import { captura, outbox } from './esquema.js';

export class CapturaRepositoryPostgres implements CapturaRepository {
  constructor(private readonly banco: BancoDoContexto) {}

  async buscarPorHash(sha256: HashSha256): Promise<Captura | undefined> {
    const [linha] = await this.banco.executor
      .select()
      .from(captura)
      .where(eq(captura.sha256, sha256.valor))
      .limit(1);
    return linha ? paraCaptura(linha) : undefined;
  }

  salvar(nova: Captura): Promise<void> {
    return this.banco.transacao(async (tx) => {
      await tx.insert(captura).values({
        id: nova.id.valor,
        sha256: nova.sha256.valor,
        fonte: nova.fonte,
        url: nova.url,
        coletadaEm: nova.coletadaEm,
        caminho: nova.caminho,
        tipoDeConteudo: nova.tipoDeConteudo,
        registradaEm: nova.registradaEm,
      });
      await gravarNaOutbox(tx, outbox, nova.pullDomainEvents());
    });
  }
}

/** O banco só guarda o que o domínio validou; um valor inválido aqui é dado corrompido. */
function paraCaptura(linha: typeof captura.$inferSelect): Captura {
  const id = CapturaId.de(linha.id);
  const sha256 = HashSha256.de(linha.sha256);
  if (!id.ok || !sha256.ok) throw new Error(`Captura corrompida no banco: ${linha.id}`);
  return Captura.reconstituir(id.value, {
    fonte: linha.fonte,
    url: linha.url,
    coletadaEm: linha.coletadaEm,
    sha256: sha256.value,
    caminho: linha.caminho,
    tipoDeConteudo: linha.tipoDeConteudo,
    registradaEm: linha.registradaEm,
  });
}
