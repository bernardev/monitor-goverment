# `ingestao.camara_matricula` v1.0.0

Correspondência entre a matrícula (carteira parlamentar) usada pelo serviço legado SitCamaraWS e o id
da API de Dados Abertos v2. Fonte: `GET /SitCamaraWS/Deputados.asmx/ObterDeputados` (deputados em
exercício).

- **Conector:** `prometeu_dados.conectores.camara.ConectorFrequenciaDaCamara`
- **Chave natural:** `matricula`
- **Atualização:** junto com `camara_frequencia_dia`, na mesma transação

| Coluna        | Tipo      | Nulo | Regra de normalização                                       |
| ------------- | --------- | ---- | ----------------------------------------------------------- |
| `matricula`   | `integer` | não  | `matricula`; ausente ou não numérica faz o conector falhar. |
| `id_deputado` | `integer` | não  | `ideCadastro`, o mesmo `id` de `camara_deputado`.           |

Mais as [colunas de origem](../colunas-de-origem.md).
