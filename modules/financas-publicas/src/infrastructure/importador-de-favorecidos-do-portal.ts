import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { and, eq, inArray } from 'drizzle-orm';

import type {
  RegistrarFavorecidosDaEmenda,
  RegistrarFavorecidosDaEmendaInput,
} from '../application/registrar-favorecidos-da-emenda.js';
import type { TipoDeFavorecido } from '../domain/tipo-de-favorecido.js';
import { transparenciaEmendaFavorecido as prata } from './prata-do-portal.js';
import type { FalhaDeImportacao, ResumoDaImportacao } from './resumo-da-importacao.js';

/** Grafias do Portal (contrato `transparencia_emenda_favorecido`, já corrigidas na prata). */
const TIPO: Readonly<Record<string, TipoDeFavorecido>> = {
  'Pessoa Jurídica': 'pessoa_juridica',
  'Unidade Gestora': 'unidade_gestora',
  'Pessoa Física': 'pessoas_fisicas',
  'Inscrição Genérica': 'inscricao_generica',
  'Sem informação': 'nao_informado',
};

/** Emendas lidas da prata por vez: o lote tem centenas de milhares de linhas. */
const EMENDAS_POR_VEZ = 500;

type Linha = typeof prata.$inferSelect;

/**
 * Camada anticorrupção do Portal da Transparência (ADR-0005) para os favorecidos: as linhas da
 * mesma emenda formam a lista de quem recebeu, mês a mês. Pessoas físicas já chegam somadas e sem
 * nome (contrato da prata).
 */
export class ImportadorDeFavorecidosDoPortal {
  constructor(
    private readonly banco: BancoDoContexto,
    private readonly registrar: RegistrarFavorecidosDaEmenda,
  ) {}

  async importar(loteId: string): Promise<ResumoDaImportacao> {
    const codigos = (
      await this.banco.executor
        .selectDistinct({ codigo: prata.codigoEmenda })
        .from(prata)
        .where(eq(prata.loteId, loteId))
        .orderBy(prata.codigoEmenda)
    ).map((l) => l.codigo);

    let novos = 0;
    const falhas: FalhaDeImportacao[] = [];
    for (let inicio = 0; inicio < codigos.length; inicio += EMENDAS_POR_VEZ) {
      const linhas = await this.banco.executor
        .select()
        .from(prata)
        .where(
          and(
            eq(prata.loteId, loteId),
            inArray(prata.codigoEmenda, codigos.slice(inicio, inicio + EMENDAS_POR_VEZ)),
          ),
        );
      const porEmenda = new Map<string, Linha[]>();
      for (const linha of linhas) {
        const daEmenda = porEmenda.get(linha.codigoEmenda);
        if (daEmenda) daEmenda.push(linha);
        else porEmenda.set(linha.codigoEmenda, [linha]);
      }
      for (const [codigoDaEmenda, recebimentos] of [...porEmenda].sort(([a], [b]) =>
        a < b ? -1 : 1,
      )) {
        const entrada = paraEntrada(codigoDaEmenda, recebimentos);
        if (entrada === undefined) {
          falhas.push({
            codigoNaFonte: codigoDaEmenda,
            erro: 'favorecidos.tipo_desconhecido',
            mensagem: `Tipo de favorecido fora do contrato na emenda ${codigoDaEmenda}.`,
          });
          continue;
        }
        const resultado = await this.registrar.execute(entrada);
        if (resultado.ok) {
          if (resultado.value.novos) novos += 1;
        } else {
          falhas.push({
            codigoNaFonte: codigoDaEmenda,
            erro: resultado.error.code,
            mensagem: resultado.error.message,
          });
        }
      }
    }
    return { loteId, importacao: 'favorecidos', lidos: codigos.length, novos, falhas };
  }
}

function paraEntrada(
  codigoDaEmenda: string,
  linhas: readonly Linha[],
): RegistrarFavorecidosDaEmendaInput | undefined {
  const [primeira] = linhas;
  if (primeira === undefined || linhas.some((l) => TIPO[l.tipoFavorecido] === undefined)) {
    return undefined;
  }
  return {
    codigoDaEmenda,
    recebimentos: linhas.map((l) => ({
      mes: l.mes,
      favorecido: {
        tipo: TIPO[l.tipoFavorecido] ?? 'nao_informado',
        documento: l.codigoFavorecido,
        nome: l.nomeFavorecido,
        naturezaJuridica: l.naturezaJuridica,
        uf: l.uf,
        municipio: l.municipio,
      },
      quantidade: l.quantidade,
      valor: l.valorCentavos,
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
