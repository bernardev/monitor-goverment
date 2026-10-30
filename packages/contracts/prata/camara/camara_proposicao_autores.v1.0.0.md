# `ingestao.camara_proposicao_autores` v1.0.0

Os autores de cada proposição de `camara_proposicao`, numa linha por proposição. Fonte:
`GET /api/v2/proposicoes/{id}/autores` da
[API de Dados Abertos da Câmara](https://dadosabertos.camara.leg.br/swagger/api.html).

- **Conector:** `prometeu_dados.conectores.camara.ConectorProposicoesDaCamara`
- **Chave natural:** `id_proposicao`
- **Atualização:** junto com `camara_proposicao`, na mesma transação

| Coluna          | Tipo      | Nulo | Regra de normalização                |
| --------------- | --------- | ---- | ------------------------------------ |
| `id_proposicao` | `integer` | não  | `id` da proposição.                  |
| `autores`       | `jsonb`   | não  | Lista na ordem da fonte. Ver abaixo. |

Mais as [colunas de origem](../colunas-de-origem.md).

| Campo              | Regra de normalização                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------- |
| `nome`             | `nome`, com espaços repetidos colapsados.                                                 |
| `tipo`             | `tipo` (`Deputado(a)`, `Órgão do Poder Executivo`...), grafia da fonte.                   |
| `id_deputado`      | O id no fim de `uri` quando ela aponta para `/deputados/{id}`; nulo para órgãos e outros. |
| `ordem_assinatura` | `ordemAssinatura`.                                                                        |
| `proponente`       | `proponente` igual a 1: autor de fato, e não só quem assina junto.                        |
