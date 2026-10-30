import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { eq } from 'drizzle-orm';

import type { RegistrarEmenda, RegistrarEmendaInput } from '../application/registrar-emenda.js';
import type { TipoDeEmenda } from '../domain/tipo-de-emenda.js';
import { transparenciaEmenda } from './prata-do-portal.js';
import type { FalhaDeImportacao, ResumoDaImportacao } from './resumo-da-importacao.js';

/** Grafias do Portal (contrato `transparencia_emenda`). */
const TIPO: Readonly<Record<string, TipoDeEmenda>> = {
  'Emenda Individual - Transferências com Finalidade Definida': 'individual',
  'Emenda Individual - Transferências Especiais': 'transferencia_especial',
  'Emenda de Bancada': 'bancada',
  'Emenda de Comissão': 'comissao',
  'Emenda de Relator': 'relator',
};

type Linha = typeof transparenciaEmenda.$inferSelect;

/**
 * Camada anticorrupção do Portal da Transparência (ADR-0005): traduz as linhas da prata para a
 * linguagem deste contexto. Cada linha é uma destinação; as do mesmo código formam uma emenda.
 *
 * O arquivo é um retrato completo e todo lote traz todas as linhas: uma destinação que a fonte tirou
 * fica com o lote antigo e não volta.
 */
export class ImportadorDeEmendasDoPortal {
  constructor(
    private readonly banco: BancoDoContexto,
    private readonly registrar: RegistrarEmenda,
  ) {}

  async importar(loteId: string): Promise<ResumoDaImportacao> {
    const linhas = await this.banco.executor
      .select()
      .from(transparenciaEmenda)
      .where(eq(transparenciaEmenda.loteId, loteId))
      // A ordem da chave natural: a mesma emenda grava as destinações sempre na mesma ordem.
      .orderBy(
        transparenciaEmenda.codigoEmenda,
        transparenciaEmenda.localidade,
        transparenciaEmenda.codigoFuncao,
        transparenciaEmenda.codigoSubfuncao,
        transparenciaEmenda.codigoPrograma,
        transparenciaEmenda.codigoAcao,
        transparenciaEmenda.codigoPlanoOrcamentario,
      );

    const porEmenda = new Map<string, Linha[]>();
    for (const linha of linhas) {
      porEmenda.set(linha.codigoEmenda, [...(porEmenda.get(linha.codigoEmenda) ?? []), linha]);
    }

    let novos = 0;
    const falhas: FalhaDeImportacao[] = [];
    for (const [codigoNaFonte, destinacoes] of porEmenda) {
      const entrada = paraEntrada(codigoNaFonte, destinacoes);
      if (entrada === undefined) {
        falhas.push({
          codigoNaFonte,
          erro: 'emenda.cabecalho_inconsistente',
          mensagem: `Linhas da emenda ${codigoNaFonte} com tipo, ano ou autor diferentes.`,
        });
        continue;
      }
      const resultado = await this.registrar.execute(entrada);
      if (resultado.ok) {
        if (resultado.value.nova) novos += 1;
      } else {
        falhas.push({
          codigoNaFonte,
          erro: resultado.error.code,
          mensagem: resultado.error.message,
        });
      }
    }
    return { loteId, lidos: porEmenda.size, novos, falhas };
  }
}

function paraEntrada(
  codigoNaFonte: string,
  linhas: readonly Linha[],
): RegistrarEmendaInput | undefined {
  const [primeira] = linhas;
  const tipo = primeira ? TIPO[primeira.tipo] : undefined;
  if (primeira === undefined || tipo === undefined) return undefined;
  // O que identifica a emenda é igual em todas as suas linhas; se não for, a fonte se contradiz.
  const coerente = linhas.every(
    (l) =>
      l.tipo === primeira.tipo &&
      l.ano === primeira.ano &&
      l.codigoAutor === primeira.codigoAutor &&
      l.nomeAutor === primeira.nomeAutor &&
      l.numeroEmenda === primeira.numeroEmenda,
  );
  if (!coerente) return undefined;
  return {
    codigoNaFonte,
    ano: primeira.ano,
    tipo,
    numero: primeira.numeroEmenda,
    autor: { nomeNaFonte: primeira.nomeAutor, codigoNaFonte: primeira.codigoAutor },
    destinacoes: linhas.map((l) => ({
      localidade: l.localidade,
      municipioIbge: l.codigoMunicipioIbge,
      ufIbge: l.codigoUfIbge,
      funcao: { codigo: l.codigoFuncao, nome: l.nomeFuncao },
      subfuncao: { codigo: l.codigoSubfuncao, nome: l.nomeSubfuncao },
      programa: { codigo: l.codigoPrograma, nome: l.nomePrograma },
      acao: { codigo: l.codigoAcao, nome: l.nomeAcao },
      planoOrcamentario: { codigo: l.codigoPlanoOrcamentario, nome: l.nomePlanoOrcamentario },
      execucao: {
        empenhado: l.empenhadoCentavos,
        liquidado: l.liquidadoCentavos,
        pago: l.pagoCentavos,
        restosInscritos: l.restosInscritosCentavos,
        restosCancelados: l.restosCanceladosCentavos,
        restosPagos: l.restosPagosCentavos,
      },
    })),
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
