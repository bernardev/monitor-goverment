# `ingestao.camara_votos` v1.0.0

Os votos de cada votação nominal do plenário, numa linha por votação. Fonte:
`GET /api/v2/votacoes/{id}/votos` da
[API de Dados Abertos da Câmara](https://dadosabertos.camara.leg.br/swagger/api.html).

- **Conector:** `prometeu_dados.conectores.camara.ConectorVotacoesDaCamara`
- **Chave natural:** `id_votacao`
- **Atualização:** junto com `camara_votacao`, na mesma transação
- **Consumidor:** Atividade Legislativa, ao importar `camara_votacao`

Os votos ficam numa lista, e não numa linha por deputado: se a Câmara corrigir a votação e tirar um
voto, a linha inteira é regravada e não sobra voto velho.

| Coluna       | Tipo    | Nulo | Regra de normalização                  |
| ------------ | ------- | ---- | -------------------------------------- |
| `id_votacao` | `text`  | não  | `id` da votação; ver `camara_votacao`. |
| `votos`      | `jsonb` | não  | Lista na ordem da fonte. Ver abaixo.   |

Mais as [colunas de origem](../colunas-de-origem.md).

## Cada voto

| Campo           | Regra de normalização                                                               |
| --------------- | ----------------------------------------------------------------------------------- |
| `id_deputado`   | `deputado_.id`, o mesmo id de `camara_deputado`.                                    |
| `voto`          | `tipoVoto`, grafia da fonte: `Sim`, `Não`, `Abstenção`, `Obstrução` ou `Artigo 17`. |
|                 | Nulo na votação secreta: a fonte diz quem votou, não como.                          |
| `registrado_em` | `dataRegistroVoto`, instante ISO 8601 com o fuso de Brasília.                       |
| `sigla_partido` | `deputado_.siglaPartido` no dia da votação, sem espaços nas pontas.                 |
| `sigla_uf`      | `deputado_.siglaUf`; nulo se vier vazio.                                            |

`Artigo 17` é o presidente da sessão, que só vota para desempatar (art. 17 do Regimento Interno).
Outra grafia, deputado repetido ou data fora do formato fazem o conector falhar.

O deputado ausente não aparece na lista: a fonte não informa quem faltou à votação.
