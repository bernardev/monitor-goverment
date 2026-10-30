# `ingestao.camara_deputado` v2.0.0

Deputados federais da legislatura atual, um por legislatura em que exerceram mandato, com os períodos
de exercício. Fontes: `GET /api/v2/deputados?idLegislatura={id}` para achar os deputados e
`GET /api/v2/deputados/{id}/historico` para os dados de cada um, na
[API de Dados Abertos da Câmara](https://dadosabertos.camara.leg.br/swagger/api.html).

- **Conector:** `prometeu_dados.conectores.camara.ConectorDeputadosDaCamara`
- **Chave natural:** `(id_deputado, id_legislatura)`
- **Atualização:** diária, 6h (horário de Brasília)
- **Evento:** `LoteIngerido` com `fonte = camara`, `tabela = camara_deputado`
- **Consumidor:** Agentes Públicos

| Coluna           | Tipo      | Nulo | Regra de normalização                                                                              |
| ---------------- | --------- | ---- | -------------------------------------------------------------------------------------------------- |
| `id_deputado`    | `integer` | não  | `id` da Câmara.                                                                                    |
| `id_legislatura` | `integer` | não  | `idLegislatura`; ver `camara_legislatura`.                                                         |
| `nome`           | `text`    | não  | `nome` parlamentar da entrada mais recente da legislatura, com espaços repetidos colapsados.       |
| `sigla_partido`  | `text`    | não  | `siglaPartido` da mesma entrada, sem espaços nas pontas, grafia da fonte (`S.PART.`: sem partido). |
| `sigla_uf`       | `char(2)` | não  | `siglaUf` da mesma entrada; UF desconhecida faz o conector falhar.                                 |
| `url_foto`       | `text`    | sim  | `urlFoto`; texto vazio vira nulo.                                                                  |
| `exercicios`     | `jsonb`   | não  | Períodos em que o deputado esteve no cargo, em ordem: `[{inicio, fim}]`. Ver abaixo.               |

Mais as [colunas de origem](../colunas-de-origem.md).

## Períodos de exercício

Cada entrada do histórico tem uma `situacao`. As entradas da legislatura são lidas em ordem de
`dataHora` (horário de Brasília):

| `situacao`                                                                        | Efeito                                    |
| --------------------------------------------------------------------------------- | ----------------------------------------- |
| `Exercício`                                                                       | Abre um período, se não houver um aberto. |
| `Licença`, `SUPLENCIA`, `FIM_MANDATO`, `VACANCIA`, `SUSPENSO`, `Afastado`         | Fecha o período aberto.                   |
| `CONVOCADO` (suplente chamado, antes da posse), nulo (mudança de nome ou partido) | Nada muda.                                |

Qualquer outra situação faz o conector falhar. `inicio` e `fim` são instantes ISO 8601 com fuso
(`2026-06-16T17:13:00-03:00`); `fim` é nulo no período em curso. Licença curta para tratamento de
saúde não aparece no histórico: o deputado continua em exercício e a ausência vai para a frequência.

Só entram as legislaturas com ao menos um período de exercício. Quem foi eleito suplente e nunca
assumiu não aparece.

## Mudanças desde a v1

- A v1 trazia só os deputados em exercício no dia da coleta, e o suplente que saía sumia da tabela.
  A v2 traz todos os que exerceram mandato na legislatura, e também as legislaturas anteriores deles.
- Coluna nova `exercicios`.
- Sai `email`: o histórico não o informa, e nenhum consumidor usava.
