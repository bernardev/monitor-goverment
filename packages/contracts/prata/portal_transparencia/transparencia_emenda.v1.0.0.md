# `ingestao.transparencia_emenda` v1.0.0

Emendas parlamentares aos orçamentos federais desde 2023, uma linha por destinação (ação orçamentária e
localidade). Fonte: o arquivo único de emendas do
[Portal da Transparência](https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares)
(`EmendasParlamentares.csv` dentro do ZIP). A API do Portal exige cadastro com chave; o arquivo, não.

- **Conector:** `prometeu_dados.conectores.portal_transparencia.ConectorEmendasDoPortal`
- **Chave natural:** `(codigo_emenda, localidade, codigo_funcao, codigo_subfuncao, codigo_programa, codigo_acao, codigo_plano_orcamentario)`
- **Atualização:** diária, 6h (horário de Brasília). O arquivo é um retrato completo: toda execução regrava
  todas as linhas, com os valores acumulados até a data da CGU.
- **Evento:** `LoteIngerido` com `fonte = portal_transparencia`, `tabela = transparencia_emenda`
- **Consumidor:** Finanças Públicas

O CSV vem em Latin-1, separado por `;`, com valores como `1234567,89`. Cabeçalho diferente, tipo de
emenda desconhecido, valor fora do formato ou destinação repetida fazem o conector falhar. Linhas sem
código de emenda (só em orçamentos antigos) e de orçamentos anteriores a 2023 ficam de fora.

| Coluna                                                 | Tipo      | Nulo | Regra de normalização                                                            |
| ------------------------------------------------------ | --------- | ---- | -------------------------------------------------------------------------------- |
| `codigo_emenda`                                        | `text`    | não  | `Código da Emenda` (`202638970001`: ano, autor e número).                        |
| `ano`                                                  | `integer` | não  | `Ano da Emenda`, o ano do orçamento.                                             |
| `tipo`                                                 | `text`    | não  | `Tipo de Emenda`, grafia da fonte. Ver abaixo.                                   |
| `codigo_autor`                                         | `text`    | não  | `Código do Autor da Emenda`, código do Portal (não é o da Câmara nem do Senado). |
| `nome_autor`                                           | `text`    | não  | `Nome do Autor da Emenda` (`ACACIO FAVACHO`, `BANCADA DA BAHIA`).                |
| `numero_emenda`                                        | `text`    | não  | `Número da emenda` (`0001`).                                                     |
| `localidade`                                           | `text`    | não  | `Localidade de aplicação do recurso` (`SÃO PAULO - SP`, `MÚLTIPLO`, `Nacional`). |
| `codigo_municipio_ibge`                                | `char(7)` | sim  | `Código Município IBGE`; `Sem informação` vira nulo.                             |
| `codigo_uf_ibge`                                       | `char(7)` | sim  | `Código UF IBGE`; `-1` e `-14` (múltiplo, nacional) viram nulo.                  |
| `codigo_funcao`, `nome_funcao`                         | `text`    | não  | Função de governo (`10`, `Saúde`).                                               |
| `codigo_subfuncao`, `nome_subfuncao`                   | `text`    | não  | Subfunção.                                                                       |
| `codigo_programa`, `nome_programa`                     | `text`    | não  | Programa do PPA.                                                                 |
| `codigo_acao`, `nome_acao`                             | `text`    | não  | Ação orçamentária.                                                               |
| `codigo_plano_orcamentario`, `nome_plano_orcamentario` | `text`    | não  | Plano orçamentário.                                                              |
| `empenhado_centavos`                                   | `bigint`  | não  | `Valor Empenhado`, em centavos inteiros.                                         |
| `liquidado_centavos`                                   | `bigint`  | não  | `Valor Liquidado`, em centavos.                                                  |
| `pago_centavos`                                        | `bigint`  | não  | `Valor Pago`, em centavos.                                                       |
| `restos_inscritos_centavos`                            | `bigint`  | não  | `Valor Restos A Pagar Inscritos`, em centavos.                                   |
| `restos_cancelados_centavos`                           | `bigint`  | não  | `Valor Restos A Pagar Cancelados`, em centavos; pode ser negativo.               |
| `restos_pagos_centavos`                                | `bigint`  | não  | `Valor Restos A Pagar Pagos`, em centavos.                                       |

Mais as [colunas de origem](../colunas-de-origem.md).

Tipos de emenda: `Emenda Individual - Transferências com Finalidade Definida`,
`Emenda Individual - Transferências Especiais` (a "emenda PIX"), `Emenda de Bancada`,
`Emenda de Comissão` e `Emenda de Relator`.
