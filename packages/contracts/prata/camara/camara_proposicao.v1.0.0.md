# `ingestao.camara_proposicao` v1.0.0

Proposições normativas da Câmara (PEC, PLP, PL, MPV e PDL) com tramitação na janela. Fontes:
`GET /api/v2/proposicoes?siglaTipo=&dataInicio=&dataFim=` para listar e `GET /api/v2/proposicoes/{id}`
para o detalhe, na [API de Dados Abertos da Câmara](https://dadosabertos.camara.leg.br/swagger/api.html).

- **Conector:** `prometeu_dados.conectores.camara.ConectorProposicoesDaCamara`
- **Chave natural:** `id_proposicao`
- **Atualização:** diária, 6h (horário de Brasília), com os últimos 3 dias de tramitação
- **Evento:** `LoteIngerido` com `fonte = camara`, `tabela = camara_proposicao`
- **Consumidor:** Atividade Legislativa, que lê autores e tramitações nas tabelas irmãs

Requerimentos, pareceres, emendas e outros documentos de trâmite não entram: não viram norma.

| Coluna             | Tipo          | Nulo | Regra de normalização                                                   |
| ------------------ | ------------- | ---- | ----------------------------------------------------------------------- |
| `id_proposicao`    | `integer`     | não  | `id` da Câmara.                                                         |
| `sigla_tipo`       | `text`        | não  | `siglaTipo`; tipo fora do filtro faz o conector falhar.                 |
| `numero`           | `integer`     | não  | `numero`.                                                               |
| `ano`              | `integer`     | não  | `ano`.                                                                  |
| `ementa`           | `text`        | sim  | `ementa`, com espaços repetidos colapsados; vazia vira nulo.            |
| `apresentada_em`   | `timestamptz` | não  | `dataApresentacao`, horário de Brasília.                                |
| `url_inteiro_teor` | `text`        | sim  | `urlInteiroTeor`.                                                       |
| `situacao`         | `jsonb`       | sim  | `statusProposicao`, a última tramitação, no formato de cada tramitação. |

Mais as [colunas de origem](../colunas-de-origem.md). O formato de uma tramitação está em
[`camara_proposicao_tramitacoes`](camara_proposicao_tramitacoes.v1.0.0.md).
