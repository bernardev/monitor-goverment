# `ingestao.senado_senador` v1.1.0

Senadores que exerceram mandato na legislatura em curso ou na anterior, inclusive suplentes que já
saíram. Fontes: `GET /senador/lista/atual` (para achar as legislaturas),
`GET /senador/lista/legislatura/{numero}` e `GET /senador/{codigo}` nos
[Dados Abertos do Senado](https://legis.senado.leg.br/dadosabertos/docs/).

- **Conector:** `prometeu_dados.conectores.senado.ConectorSenadoresDoSenado`
- **Chave natural:** `codigo`
- **Atualização:** diária, 6h (horário de Brasília)
- **Evento:** `LoteIngerido` com `fonte = senado`, `tabela = senado_senador`
- **Consumidor:** Agentes Públicos, que lê os exercícios em `senado_exercicios`

| Coluna          | Tipo      | Nulo | Regra de normalização                                                                            |
| --------------- | --------- | ---- | ------------------------------------------------------------------------------------------------ |
| `codigo`        | `integer` | não  | `CodigoParlamentar`.                                                                             |
| `nome`          | `text`    | não  | `NomeParlamentar`, com espaços repetidos colapsados.                                             |
| `sigla_partido` | `text`    | sim  | `SiglaPartidoParlamentar`, grafia da fonte (`S/Partido`: sem partido); nulo se a fonte não traz. |
| `url_foto`      | `text`    | sim  | `UrlFotoParlamentar`; texto vazio vira nulo.                                                     |

Mais as [colunas de origem](../colunas-de-origem.md).

O detalhe só traz a UF de quem está em exercício; a UF de cada exercício vem do mandato, em
`senado_exercicios`. Detalhe de outro senador faz o conector falhar.

## Mudanças desde a v1.0

A v1.0 percorria só os senadores da legislatura em curso; a v1.1 percorre também os da anterior,
achada nos mandatos de quem está em exercício (o mandato de senador cobre duas legislaturas). Entram
os senadores cujo mandato terminou com a legislatura anterior. As colunas não mudaram. O motivo: as
emendas ao primeiro orçamento de cada legislatura são propostas pela que termina.
