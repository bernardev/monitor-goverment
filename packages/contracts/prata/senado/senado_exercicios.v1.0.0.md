# `ingestao.senado_exercicios` v1.0.0

Os exercícios de cada senador, de todos os mandatos dele, numa linha por senador. Fonte:
`GET /senador/{codigo}/mandatos` nos [Dados Abertos do Senado](https://legis.senado.leg.br/dadosabertos/docs/).

- **Conector:** `prometeu_dados.conectores.senado.ConectorSenadoresDoSenado`
- **Chave natural:** `codigo`
- **Atualização:** junto com `senado_senador`, na mesma transação
- **Consumidor:** Agentes Públicos, ao importar `senado_senador`

Só entra quem tem ao menos um exercício: o suplente que nunca assumiu não aparece.

| Coluna       | Tipo      | Nulo | Regra de normalização                      |
| ------------ | --------- | ---- | ------------------------------------------ |
| `codigo`     | `integer` | não  | `CodigoParlamentar`; ver `senado_senador`. |
| `exercicios` | `jsonb`   | não  | Lista em ordem de início. Ver abaixo.      |

Mais as [colunas de origem](../colunas-de-origem.md).

## Cada exercício

| Campo                  | Regra de normalização                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `codigo_exercicio`     | `CodigoExercicio`.                                                                        |
| `uf`                   | `UfParlamentar` do mandato; UF desconhecida faz o conector falhar.                        |
| `inicio`               | `DataInicio` (`aaaa-mm-dd`, calendário de Brasília).                                      |
| `fim`                  | `DataFim`; nulo no exercício em curso. Fim antes do início faz o conector falhar.         |
| `fim_do_mandato`       | `DataFim` da última legislatura do mandato: o limite do exercício em curso.               |
| `causa_do_afastamento` | `SiglaCausaAfastamento` (`LCS`, `RET`, `REN`, `TER`...), grafia da fonte; nulo se não há. |

As datas são dias, sem hora. O Senado às vezes encerra um exercício e começa o seguinte no mesmo dia
(o titular renuncia e o suplente, que já estava no cargo, continua); quem consome decide como juntar
exercícios que se tocam.
