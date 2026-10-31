# `ingestao.obrasgov_projeto` v1.0.0

Os projetos de investimento (obras e projetos) ligados a emendas pelos empenhos. Fonte:
`/projeto-investimento?id_projeto_investimento=…`, um pedido por projeto. Ver o [README](README.md) da
fonte.

- **Chave natural:** `(id_projeto)`

| Coluna                                                    | Tipo      | Nulo | Regra de normalização                                                                                          |
| --------------------------------------------------------- | --------- | ---- | -------------------------------------------------------------------------------------------------------------- |
| `id_projeto`                                              | `text`    | não  | `id_projeto_investimento` (`151020.43-16`); o pedido e a resposta têm de bater.                                |
| `nome`                                                    | `text`    | não  | `desc_nome`, espaços normalizados.                                                                             |
| `descricao`                                               | `text`    | sim  | `desc_projeto`.                                                                                                |
| `natureza`, `especie`                                     | `text`    | sim  | `natureza_intervencao` (`Obra`, `Projeto`), `especie_intervencao` (`Construção`, `Reforma`).                   |
| `situacao`                                                | `text`    | não  | `situacao`, grafia da fonte: `Cadastrada`, `Em execução`, `Paralisada`, `Concluída`, `Cancelada`, `Inacabada`. |
| `uf`                                                      | `char(2)` | sim  | `uf_principal`, sigla.                                                                                         |
| `cep`, `endereco`                                         | `text`    | sim  | `nr_cep`, `desc_endereco`.                                                                                     |
| `inicio_previsto`, `fim_previsto`                         | `date`    | sim  | `dt_inicial_prevista`, `dt_final_prevista`.                                                                    |
| `inicio_efetivo`, `fim_efetivo`                           | `date`    | sim  | `dt_inicial_efetiva`, `dt_final_efetiva`.                                                                      |
| `cadastrado_em`                                           | `date`    | sim  | `dt_cadastro`.                                                                                                 |
| `organizacao_responsavel`, `cnpj_organizacao_responsavel` | `text`    | sim  | `organizacao_resp`, `cnpj_organizacao_resp` (14 dígitos).                                                      |
| `executores`, `tomadores`, `repassadores`                 | `jsonb`   | não  | Listas de `{nome, cnpj}`.                                                                                      |
| `investimentos_previstos`                                 | `jsonb`   | não  | Lista de `{fonte, valor_centavos}` (`Federal` e, quando há, a contrapartida).                                  |
| `tipos`                                                   | `jsonb`   | não  | Lista de `{eixo, tipo, subtipo}` (`Social`, `Saúde`, `UBS`).                                                   |
| `localizacoes`                                            | `jsonb`   | não  | Lista de `{latitude, longitude}` em texto decimal, lidos do WKT `pin` (ver abaixo).                            |
| `sistema_responsavel`                                     | `text`    | sim  | `sistema_resp` (`Transferegov.br`, `CIPI`, `SIMEC-FNDE`).                                                      |

Os pontos vêm do texto WKT (`POINT(-35.22 -9.01)`, longitude primeiro). Os campos `latitude` e
`longitude` da fonte são recortados desse texto e saem quebrados quando falta o espaço depois de
`POINT` (`9.01025)`); o WKT está sempre certo.
