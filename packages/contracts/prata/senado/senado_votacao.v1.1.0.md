# `ingestao.senado_votacao` v1.1.0

Votações nominais do plenário do Senado, com a situação de cada senador em exercício. Fonte:
`GET /votacao?dataInicio=&dataFim=` nos [Dados Abertos do Senado](https://legis.senado.leg.br/dadosabertos/docs/).

- **Conector:** `prometeu_dados.conectores.senado.ConectorVotacoesDoSenado`
- **Chave natural:** `codigo_sessao_votacao`
- **Atualização:** diária, 6h (horário de Brasília), revisitando os últimos 30 dias
- **Evento:** `LoteIngerido` com `fonte = senado`, `tabela = senado_votacao`
- **Consumidor:** Atividade Legislativa

| Coluna                  | Tipo      | Nulo | Regra de normalização                                                   |
| ----------------------- | --------- | ---- | ----------------------------------------------------------------------- |
| `codigo_sessao_votacao` | `integer` | não  | `codigoSessaoVotacao`. Votação repetida faz o conector falhar.          |
| `codigo_sessao`         | `integer` | não  | `codigoSessao`.                                                         |
| `data`                  | `date`    | não  | `dataSessao`, dia do calendário de Brasília.                            |
| `descricao`             | `text`    | não  | `descricaoVotacao`, com espaços repetidos colapsados.                   |
| `identificacao`         | `text`    | sim  | `identificacao` da matéria (`PLP 124/2022`).                            |
| `codigo_materia`        | `integer` | sim  | `codigoMateria`.                                                        |
| `id_processo`           | `integer` | sim  | `idProcesso`: o mesmo id de `senado_processo`. Novo na v1.1.0.          |
| `sigla_materia`         | `text`    | sim  | `sigla` da matéria.                                                     |
| `numero_materia`        | `text`    | sim  | `numero` da matéria, como texto.                                        |
| `ano_materia`           | `integer` | sim  | `ano` da matéria.                                                       |
| `ementa`                | `text`    | sim  | `ementa`, com espaços repetidos colapsados.                             |
| `aprovada`              | `boolean` | sim  | `resultadoVotacao`: `A` vira verdadeiro, `R` falso; nulo sem resultado. |
| `secreta`               | `boolean` | não  | `votacaoSecreta` (`S`/`N`).                                             |
| `votos`                 | `jsonb`   | não  | Um item por senador em exercício, na ordem da fonte. Ver abaixo.        |

Mais as [colunas de origem](../colunas-de-origem.md).

## Cada senador na votação

| Campo                | Regra de normalização                                             |
| -------------------- | ----------------------------------------------------------------- |
| `codigo_parlamentar` | `codigoParlamentar`; ver `senado_senador`.                        |
| `sigla_voto`         | `siglaVotoParlamentar`, grafia da fonte. Ver abaixo.              |
| `descricao_voto`     | `descricaoVotoParlamentar` (`Licença saúde`); nulo quando não há. |
| `sigla_partido`      | `siglaPartidoParlamentar` no dia da votação.                      |
| `sigla_uf`           | `siglaUFParlamentar`.                                             |

| `sigla_voto`                   | Significado                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `Sim`, `Não`, `Abstenção`      | Voto.                                                                                                                     |
| `Votou`                        | Voto em votação secreta: a fonte não diz qual.                                                                            |
| `Presidente (art. 51 RISF)`    | Presidia a sessão; só vota para desempatar.                                                                               |
| `P-NRV`                        | Presente, não registrou voto.                                                                                             |
| `NCom`                         | Não compareceu, sem justificativa.                                                                                        |
| `AP`, `LS`, `MIS`, `LP`, `LAP` | Ausente com motivo: atividade parlamentar, licença saúde, missão, licença particular, licença paternidade ou ao adotante. |
| `NA`                           | "Dispositivo não citado", sem legenda pública.                                                                            |

Outra sigla, senador repetido ou votação sem nenhum senador fazem o conector falhar.
