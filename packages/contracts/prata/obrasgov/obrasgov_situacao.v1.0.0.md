# `ingestao.obrasgov_situacao` v1.0.0

Histórico de paralisações, cancelamentos e declarações de obra inacabada. Fonte:
`/historico-situacao-cancelada-paralisada`, todas as páginas. Ver o [README](README.md) da fonte.

- **Chave natural:** `(id_historico)`

Situação fora de `Paralisada`, `Cancelada` e `Inacabada`, ou registro sem data, faz o conector falhar.

A fonte repete o mesmo registro (mesmo dia, situação e justificativa) dezenas de vezes, com
identificadores diferentes; a prata guarda todos, e o importador de Obras fica com um.

| Coluna                | Tipo      | Nulo | Regra de normalização                                         |
| --------------------- | --------- | ---- | ------------------------------------------------------------- |
| `id_historico`        | `bigint`  | não  | `id_historico_situacao_investimento`.                         |
| `id_projeto`          | `text`    | não  | `id_projeto_investimento`.                                    |
| `situacao`            | `text`    | não  | `descricao_historico_situacao_investimento`, grafia da fonte. |
| `em`                  | `date`    | não  | `data_historico_situacao_investimento`.                       |
| `justificativa`       | `text`    | sim  | `justificativa_cancelada_paralisada`.                         |
| `com_tratativas`      | `boolean` | sim  | `possui_tratativas_situacao_investimento` (`Sim`, `Não`).     |
| `fase_das_tratativas` | `text`    | sim  | `fase_tratativas_situacao_investimento`.                      |
