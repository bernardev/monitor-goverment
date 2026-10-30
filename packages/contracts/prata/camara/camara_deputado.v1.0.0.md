# `ingestao.camara_deputado` v1.0.0

Deputados federais em exercício, um por legislatura. Fonte: `GET /api/v2/deputados` da
[API de Dados Abertos da Câmara](https://dadosabertos.camara.leg.br/swagger/api.html).

- **Conector:** `prometeu_dados.conectores.camara.ConectorDeputadosDaCamara`
- **Chave natural:** `(id_deputado, id_legislatura)`
- **Atualização:** diária, 6h (horário de Brasília)
- **Evento:** `LoteIngerido` com `fonte = camara`, `tabela = camara_deputado`
- **Consumidor:** Agentes Públicos

| Coluna           | Tipo      | Nulo | Regra de normalização                                                                         |
| ---------------- | --------- | ---- | --------------------------------------------------------------------------------------------- |
| `id_deputado`    | `integer` | não  | `id` da Câmara.                                                                               |
| `id_legislatura` | `integer` | não  | `idLegislatura`; ver `camara_legislatura`.                                                    |
| `nome`           | `text`    | não  | `nome` parlamentar, com espaços repetidos colapsados.                                         |
| `sigla_partido`  | `text`    | não  | `siglaPartido` sem espaços nas pontas, grafia da fonte (`PCdoB`, `S.PART.` para sem partido). |
| `sigla_uf`       | `char(2)` | não  | `siglaUf`; UF desconhecida faz o conector falhar.                                             |
| `url_foto`       | `text`    | sim  | `urlFoto`; texto vazio vira nulo.                                                             |
| `email`          | `text`    | sim  | `email`; texto vazio vira nulo.                                                               |

Mais as [colunas de origem](../colunas-de-origem.md).
