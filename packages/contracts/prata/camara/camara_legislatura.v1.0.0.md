# `ingestao.camara_legislatura` v1.0.0

Período de cada legislatura citada em `camara_deputado`. Fonte: `GET /api/v2/legislaturas/{id}`.

- **Conector:** `prometeu_dados.conectores.camara.ConectorDeputadosDaCamara`
- **Chave natural:** `id_legislatura`
- **Atualização:** junto com `camara_deputado`, na mesma transação

| Coluna           | Tipo      | Nulo | Regra de normalização                                    |
| ---------------- | --------- | ---- | -------------------------------------------------------- |
| `id_legislatura` | `integer` | não  | `id`.                                                    |
| `data_inicio`    | `date`    | não  | `dataInicio` (ISO 8601); fim antes do início é recusado. |
| `data_fim`       | `date`    | não  | `dataFim` (ISO 8601).                                    |

Mais as [colunas de origem](../colunas-de-origem.md).
