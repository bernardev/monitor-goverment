# `ingestao.senado_senador` v1.0.0

Senadores que exerceram mandato na legislatura em curso, inclusive suplentes que já saíram. Fontes:
`GET /senador/lista/atual` (para achar a legislatura), `GET /senador/lista/legislatura/{numero}` e
`GET /senador/{codigo}` nos [Dados Abertos do Senado](https://legis.senado.leg.br/dadosabertos/docs/).

- **Conector:** `prometeu_dados.conectores.senado.ConectorSenadoresDoSenado`
- **Chave natural:** `codigo`
- **Atualização:** diária, 6h (horário de Brasília)
- **Evento:** `LoteIngerido` com `fonte = senado`, `tabela = senado_senador`
- **Consumidor:** Agentes Públicos, que lê os exercícios em `senado_exercicios`

| Coluna          | Tipo      | Nulo | Regra de normalização                                                 |
| --------------- | --------- | ---- | --------------------------------------------------------------------- |
| `codigo`        | `integer` | não  | `CodigoParlamentar`.                                                  |
| `nome`          | `text`    | não  | `NomeParlamentar`, com espaços repetidos colapsados.                  |
| `sigla_partido` | `text`    | sim  | `SiglaPartidoParlamentar`, grafia da fonte; nulo se a fonte não traz. |
| `url_foto`      | `text`    | sim  | `UrlFotoParlamentar`; texto vazio vira nulo.                          |

Mais as [colunas de origem](../colunas-de-origem.md).

O detalhe só traz a UF de quem está em exercício; a UF de cada exercício vem do mandato, em
`senado_exercicios`. Detalhe de outro senador faz o conector falhar.
