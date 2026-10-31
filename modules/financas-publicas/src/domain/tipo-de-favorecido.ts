/**
 * Quem recebeu o dinheiro. Pessoa jurídica (pelo CNPJ) e unidade gestora (órgão federal, pelo código
 * SIAFI) são identificadas. Pessoas físicas, inscrições genéricas (quem não tem CPF nem CNPJ) e
 * favorecidos não informados chegam somados por mês e município, sem nome nem documento: o Prometeu
 * acompanha o dinheiro, e dado de cidadão é o mínimo necessário.
 */
export const TIPOS_DE_FAVORECIDO = [
  'pessoa_juridica',
  'unidade_gestora',
  'pessoas_fisicas',
  'inscricao_generica',
  'nao_informado',
] as const;
export type TipoDeFavorecido = (typeof TIPOS_DE_FAVORECIDO)[number];

const DOCUMENTO: Readonly<Partial<Record<TipoDeFavorecido, RegExp>>> = {
  pessoa_juridica: /^\d{14}$/,
  unidade_gestora: /^\d{6}$/,
};

/** O formato do documento do favorecido identificado; `undefined` no somado, que não tem documento. */
export function formatoDoDocumento(tipo: TipoDeFavorecido): RegExp | undefined {
  return DOCUMENTO[tipo];
}
