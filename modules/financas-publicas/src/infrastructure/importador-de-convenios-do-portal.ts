import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { eq } from 'drizzle-orm';

import type {
  RegistrarConvenio,
  RegistrarConvenioInput,
} from '../application/registrar-convenio.js';
import { transparenciaEmendaConvenio as prata } from './prata-do-portal.js';
import type { FalhaDeImportacao, ResumoDaImportacao } from './resumo-da-importacao.js';

type Linha = typeof prata.$inferSelect;

/**
 * Camada anticorrupção do Portal da Transparência (ADR-0005) para os convênios. Cada linha liga um
 * convênio a uma emenda que o paga; as do mesmo número formam o convênio.
 */
export class ImportadorDeConveniosDoPortal {
  constructor(
    private readonly banco: BancoDoContexto,
    private readonly registrar: RegistrarConvenio,
  ) {}

  async importar(loteId: string): Promise<ResumoDaImportacao> {
    const linhas = await this.banco.executor
      .select()
      .from(prata)
      .where(eq(prata.loteId, loteId))
      .orderBy(prata.numeroConvenio);

    const porConvenio = new Map<string, Linha[]>();
    for (const linha of linhas) {
      const doConvenio = porConvenio.get(linha.numeroConvenio);
      if (doConvenio) doConvenio.push(linha);
      else porConvenio.set(linha.numeroConvenio, [linha]);
    }

    let novos = 0;
    const falhas: FalhaDeImportacao[] = [];
    for (const [numero, doConvenio] of porConvenio) {
      const entrada = paraEntrada(numero, doConvenio);
      if (entrada === undefined) {
        falhas.push({
          codigoNaFonte: numero,
          erro: 'convenio.linhas_inconsistentes',
          mensagem: `Linhas do convênio ${numero} com convenente, objeto, data ou valor diferentes.`,
        });
        continue;
      }
      const resultado = await this.registrar.execute(entrada);
      if (resultado.ok) {
        if (resultado.value.novo) novos += 1;
      } else {
        falhas.push({
          codigoNaFonte: numero,
          erro: resultado.error.code,
          mensagem: resultado.error.message,
        });
      }
    }
    return { loteId, importacao: 'convenios', lidos: porConvenio.size, novos, falhas };
  }
}

function paraEntrada(numero: string, linhas: readonly Linha[]): RegistrarConvenioInput | undefined {
  const [primeira] = linhas;
  if (primeira === undefined) return undefined;
  // O convênio é o mesmo em todas as linhas; se não for, a fonte se contradiz.
  const coerente = linhas.every(
    (l) =>
      l.convenente === primeira.convenente &&
      l.objeto === primeira.objeto &&
      l.publicadoEm === primeira.publicadoEm &&
      l.valorCentavos === primeira.valorCentavos,
  );
  if (!coerente) return undefined;
  return {
    numero,
    apuracao: {
      convenente: primeira.convenente,
      objeto: primeira.objeto,
      publicadoEm: primeira.publicadoEm,
      valor: primeira.valorCentavos,
      emendas: linhas.map((l) => ({
        codigoDaEmenda: l.codigoEmenda,
        funcao: { codigo: l.codigoFuncao, nome: l.nomeFuncao },
        subfuncao: { codigo: l.codigoSubfuncao, nome: l.nomeSubfuncao },
        localidade: l.localidade,
      })),
    },
    origem: {
      fonte: primeira.origemFonte,
      url: primeira.origemUrl,
      coletadaEm: primeira.origemColetadaEm,
      sha256: primeira.origemSha256,
      caminho: primeira.origemCaminho,
      tipoDeConteudo: primeira.origemTipoDeConteudo,
    },
  };
}
