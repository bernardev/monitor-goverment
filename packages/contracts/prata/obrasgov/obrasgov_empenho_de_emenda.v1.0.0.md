# `ingestao.obrasgov_empenho_de_emenda` v1.0.0

Empenhos de obras que trazem o código de uma emenda parlamentar de orçamento a partir de 2023. Fonte:
`/empenho`. Ver o [README](README.md) da fonte.

- **Chave natural:** `(id_projeto, ug_emitente, numero_empenho, codigo_emenda)`

Os outros empenhos (sem emenda, com `0`, `@`, `SEM EMENDA` ou só o código do autor) ficam de fora.

| Coluna                     | Tipo     | Nulo | Regra de normalização                                                 |
| -------------------------- | -------- | ---- | --------------------------------------------------------------------- |
| `id_projeto`               | `text`   | não  | `id_projeto_investimento` (`151020.43-16`).                           |
| `ug_emitente`              | `text`   | não  | `ug_emitente`, a unidade gestora que emitiu o empenho.                |
| `numero_empenho`           | `text`   | não  | `nr_empenho` (`2026NE000123`).                                        |
| `codigo_emenda`            | `text`   | não  | `codigo_autor_emenda` com 12 dígitos, sem o `.0`; o código do Portal. |
| `acao_orcamentaria`        | `text`   | sim  | `acao_orcamentaria`; vazio vira nulo.                                 |
| `programa_trabalho`        | `text`   | sim  | `programa_trabalho`.                                                  |
| `plano_interno`            | `text`   | sim  | `plano_interno`.                                                      |
| `valor_empenhado_centavos` | `bigint` | não  | `valor_empenho`, em centavos.                                         |
| `pago_centavos`            | `bigint` | sim  | `pago`, em centavos; a fonte quase nunca informa.                     |
| `emitido_em`               | `date`   | sim  | `data_emissao`.                                                       |
| `descricao`                | `text`   | sim  | `descricao_empenho`, espaços normalizados.                            |
