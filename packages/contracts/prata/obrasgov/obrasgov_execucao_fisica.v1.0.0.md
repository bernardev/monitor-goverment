# `ingestao.obrasgov_execucao_fisica` v1.0.0

Execução física das obras: o percentual executado e quando foi informado. Fonte: `/execucao-fisica`,
todas as páginas, de todas as obras. Ver o [README](README.md) da fonte.

- **Chave natural:** `(id_execucao)`

A fonte repete linhas idênticas em páginas vizinhas; a chave as junta. A obra pode ter mais de um
registro (um por instrumento).

| Coluna                  | Tipo      | Nulo | Regra de normalização                                                                               |
| ----------------------- | --------- | ---- | --------------------------------------------------------------------------------------------------- |
| `id_execucao`           | `bigint`  | não  | `id_execucao_fisica`.                                                                               |
| `id_projeto`            | `text`    | não  | `id_projeto_investimento`.                                                                          |
| `percentual_centesimos` | `integer` | sim  | `percentual_execucao_fisica` em centésimos de ponto (`23.35` → 2335). Acima de 100% fica como veio. |
| `inicio`, `fim`         | `date`    | sim  | `dt_inicial_execucao`, `dt_final_execucao`.                                                         |
| `tipo_instrumento`      | `text`    | sim  | `tipo_instrumento` (`Convênio`, `Contrato`).                                                        |
| `forma_execucao`        | `text`    | sim  | `tipo_forma_execucao` (`Repasse`, `Execução Direta`).                                               |
| `cadastrada_em`         | `date`    | sim  | `dt_cadastro_execucao`.                                                                             |
| `atualizada_em`         | `date`    | sim  | `dt_atualizacao_execucao`: a data da medição.                                                       |
| `motivos`               | `jsonb`   | não  | Descrições dos motivos informados (`Revisão de projeto básico`), sem repetir, em ordem alfabética.  |
