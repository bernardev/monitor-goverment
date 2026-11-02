import type { MedicaoDaObra } from '@prometeu/contracts';
import type { NumeroChave } from '@prometeu/ui';

import {
  comContagem,
  dataCurta,
  dia,
  periodoDasEmendas,
  reaisResumidos,
  SEM_DADO,
} from '../../_componentes/formatacao';

/** Largura, em letras minúsculas, que cabe em duas linhas do título no telefone (30 px). */
const LARGURA_DO_TITULO = 34;

/** Caixa alta ocupa mais largura que caixa baixa: pesa 1,4. */
export function nomeCabeNoTitulo(nome: string): boolean {
  const maiusculas = (nome.match(/\p{Lu}/gu) ?? []).length;
  const largura = nome.length + 0.4 * maiusculas;
  return largura <= LARGURA_DO_TITULO;
}

/** `até a coleta de 30/10/2026`; sem a data, não inventa uma. */
export function periodoAteAColeta(coletadaEm: string | null): string {
  return coletadaEm === null
    ? 'data da coleta não informada'
    : `até a coleta de ${dataCurta(coletadaEm)}`;
}

/**
 * Os três números do topo: quanto da obra está executado, o investimento previsto e o que as emendas
 * empenharam para ela. Sem dado, o valor é "—" e não conta; o rótulo e o período ficam.
 */
export function numerosDaObra(dados: {
  medicao: MedicaoDaObra | null;
  investimentoPrevistoCentavos: string;
  /** Um item por empenho: a mesma emenda pode ter mais de um. */
  emendas: readonly { codigoDaEmenda: string; empenhadoCentavos: string }[];
  coletadaEm: string | null;
}): NumeroChave[] {
  const { medicao, emendas, coletadaEm } = dados;
  const quantasEmendas = new Set(emendas.map((e) => e.codigoDaEmenda)).size;
  const empenhado = emendas.reduce((soma, e) => soma + BigInt(e.empenhadoCentavos), 0n);
  return [
    {
      ...(medicao
        ? comContagem(medicao.percentualCentesimos / 100, { casas: 2, sufixo: '%' })
        : { valor: SEM_DADO }),
      rotulo: 'da obra executados, segundo o Obrasgov.br',
      periodo: !medicao
        ? 'sem medição registrada'
        : medicao.em
          ? `medição de ${dia(medicao.em)}`
          : 'medição sem data informada',
    },
    {
      valor: reaisResumidos(dados.investimentoPrevistoCentavos),
      rotulo: 'de investimento previsto',
      periodo:
        coletadaEm === null
          ? 'previsto no cadastro'
          : `previsto no cadastro, coletado em ${dataCurta(coletadaEm)}`,
    },
    {
      valor: emendas.length > 0 ? reaisResumidos(empenhado) : SEM_DADO,
      rotulo: `empenhados (reservados no orçamento) por ${quantasEmendas === 0 ? '' : `${String(quantasEmendas)} `}${quantasEmendas === 1 ? 'emenda' : 'emendas'}`,
      periodo: periodoDasEmendas(coletadaEm),
    },
  ];
}
