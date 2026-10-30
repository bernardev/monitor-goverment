# `ingestao.camara_proposicao_tramitacoes` v1.0.0

O histórico completo de tramitação de cada proposição de `camara_proposicao`, numa linha por
proposição. Fonte: `GET /api/v2/proposicoes/{id}/tramitacoes` da
[API de Dados Abertos da Câmara](https://dadosabertos.camara.leg.br/swagger/api.html).

- **Conector:** `prometeu_dados.conectores.camara.ConectorProposicoesDaCamara`
- **Chave natural:** `id_proposicao`
- **Atualização:** junto com `camara_proposicao`, na mesma transação

| Coluna          | Tipo      | Nulo | Regra de normalização                      |
| --------------- | --------- | ---- | ------------------------------------------ |
| `id_proposicao` | `integer` | não  | `id` da proposição.                        |
| `tramitacoes`   | `jsonb`   | não  | Lista em ordem de `sequencia`. Ver abaixo. |

Mais as [colunas de origem](../colunas-de-origem.md).

| Campo                  | Regra de normalização                                        |
| ---------------------- | ------------------------------------------------------------ |
| `sequencia`            | `sequencia`. Não identifica a tramitação: ver abaixo.        |
| `data_hora`            | `dataHora`, instante ISO 8601 com o fuso de Brasília.        |
| `sigla_orgao`          | `siglaOrgao`; nulo se vazio.                                 |
| `descricao_tramitacao` | `descricaoTramitacao` (`Parecer do Relator`); nulo se vazio. |
| `descricao_situacao`   | `descricaoSituacao` (`Aguardando Parecer`); nulo se vazio.   |
| `despacho`             | `despacho`, com espaços repetidos colapsados; nulo se vazio. |
| `url`                  | `url` do documento do ato; nulo se não há.                   |

A Câmara repete a `sequencia` quando registra dois despachos do mesmo ato. A ordenação é estável:
entre tramitações com a mesma sequência, vale a ordem da fonte. Data fora do formato faz o conector
falhar.
