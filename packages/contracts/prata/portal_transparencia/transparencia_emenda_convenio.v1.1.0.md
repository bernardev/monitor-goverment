# `ingestao.transparencia_emenda_convenio` v1.1.0

Convênios pagos com emendas aos orçamentos desde 2023. Fonte: o arquivo único de emendas do
[Portal da Transparência](https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares)
(`EmendasParlamentares_Convenios.csv` dentro do ZIP), o mesmo de
[`transparencia_emenda`](transparencia_emenda.v1.1.0.md).

- **Conector:** `prometeu_dados.conectores.portal_transparencia.ConectorEmendasDoPortal`
- **Chave natural:** `(codigo_emenda, numero_convenio, codigo_funcao, codigo_subfuncao, localidade)`
- **Atualização:** diária, 6h (horário de Brasília), junto com as emendas. Toda execução regrava todas
  as linhas.
- **Evento:** `LoteIngerido` com `fonte = portal_transparencia`, `tabela = transparencia_emenda_convenio`
- **Consumidor:** Finanças Públicas

Uma linha liga um convênio a uma emenda que o paga, numa classificação e localidade. O mesmo convênio
pode ser pago por mais de uma emenda; convenente, objeto, data e valor se repetem iguais em todas as
linhas dele. O convênio pode ser anterior ao orçamento da emenda (um convênio de 2020 que recebe
dinheiro de uma emenda de 2023). Cabeçalho diferente, tipo de emenda desconhecido, número de convênio,
data ou valor fora do formato, valor negativo, convenente vazio ou linha repetida fazem o conector
falhar.

| Coluna                               | Tipo     | Nulo | Regra de normalização                                                                      |
| ------------------------------------ | -------- | ---- | ------------------------------------------------------------------------------------------ |
| `codigo_emenda`                      | `text`   | não  | `Código da Emenda`; o mesmo de `transparencia_emenda`.                                     |
| `numero_convenio`                    | `text`   | não  | `Número Convênio` (`825378`, às vezes com letras: `9AAQKR`).                               |
| `codigo_funcao`, `nome_funcao`       | `text`   | não  | Função de governo (`10`, `Saúde`).                                                         |
| `codigo_subfuncao`, `nome_subfuncao` | `text`   | não  | Subfunção.                                                                                 |
| `localidade`                         | `text`   | não  | `Localidade do gasto` (`SÃO PAULO (UF)`, `SOUSA - PB`, `Nacional`).                        |
| `publicado_em`                       | `date`   | não  | `Data Publicação Convênio` (`06/01/2026`).                                                 |
| `convenente`                         | `text`   | não  | `Convenente`, quem recebe o dinheiro e executa o objeto; só o nome, a fonte não dá o CNPJ. |
| `objeto`                             | `text`   | sim  | `Objeto Convênio`; vazio vira nulo.                                                        |
| `valor_centavos`                     | `bigint` | não  | `Valor Convênio`, o valor do convênio inteiro, em centavos.                                |

Mais as [colunas de origem](../colunas-de-origem.md).
