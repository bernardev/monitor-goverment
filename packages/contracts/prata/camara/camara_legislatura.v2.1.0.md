# `ingestao.camara_legislatura` v2.1.0

A legislatura em curso no dia da coleta e a anterior, que é a em curso no dia antes do início da
seguinte. Fonte: `GET /api/v2/legislaturas?data={aaaa-mm-dd}`.

- **Conector:** `prometeu_dados.conectores.camara.ConectorDeputadosDaCamara`
- **Chave natural:** `id_legislatura`
- **Atualização:** junto com `camara_deputado`, na mesma transação

| Coluna           | Tipo      | Nulo | Regra de normalização                                    |
| ---------------- | --------- | ---- | -------------------------------------------------------- |
| `id_legislatura` | `integer` | não  | `id`.                                                    |
| `data_inicio`    | `date`    | não  | `dataInicio` (ISO 8601); fim antes do início é recusado. |
| `data_fim`       | `date`    | não  | `dataFim` (ISO 8601).                                    |

Mais as [colunas de origem](../colunas-de-origem.md).

## Mudanças desde a v1

A v1 trazia cada legislatura citada pelos deputados em exercício (`GET /api/v2/legislaturas/{id}`).
A v2 traz a legislatura em curso, que define quais deputados são coletados. As colunas não mudaram.
Resposta com mais de uma legislatura para o dia faz o conector falhar.

## Mudanças desde a v2.0

A v2.0 trazia só a legislatura em curso; a v2.1 traz também a anterior, cujos deputados passam a ser
coletados em `camara_deputado`. As colunas não mudaram.
