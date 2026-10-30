# `ingestao.camara_votacao` v1.0.0

Votações nominais do plenário da Câmara: as que têm voto por deputado. Fontes:
`GET /api/v2/votacoes?idOrgao=180&dataInicio=&dataFim=` para listar as votações do plenário e
`GET /api/v2/votacoes/{id}` para o detalhe de cada uma, na
[API de Dados Abertos da Câmara](https://dadosabertos.camara.leg.br/swagger/api.html).

- **Conector:** `prometeu_dados.conectores.camara.ConectorVotacoesDaCamara`
- **Chave natural:** `id_votacao`
- **Atualização:** diária, 6h (horário de Brasília), revisitando os últimos 30 dias
- **Evento:** `LoteIngerido` com `fonte = camara`, `tabela = camara_votacao`
- **Consumidor:** Atividade Legislativa, que lê os votos em `camara_votos`

A votação simbólica (sem voto por deputado) não entra: o conector busca os votos de cada votação da
lista e só busca o detalhe quando há votos.

| Coluna          | Tipo          | Nulo | Regra de normalização                                                         |
| --------------- | ------------- | ---- | ----------------------------------------------------------------------------- |
| `id_votacao`    | `text`        | não  | `id` da Câmara (`2635476-36`).                                                |
| `data`          | `date`        | não  | `data` (ISO 8601), dia do calendário de Brasília.                             |
| `registrada_em` | `timestamptz` | não  | `dataHoraRegistro`, horário de Brasília.                                      |
| `descricao`     | `text`        | não  | `descricao`, com espaços repetidos colapsados. Traz o resultado e o placar.   |
| `aprovacao`     | `boolean`     | sim  | `aprovacao`: `1` vira verdadeiro, `0` falso; nulo quando a fonte não informa. |
| `proposicoes`   | `jsonb`       | não  | `proposicoesAfetadas`: `[{id, sigla_tipo, numero, ano, ementa}]`.             |

Mais as [colunas de origem](../colunas-de-origem.md).

O detalhe de outra votação, de outro órgão ou com `aprovacao` fora de `0`, `1` e nulo faz o conector
falhar.
