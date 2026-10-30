# `ingestao.camara_frequencia_dia` v1.0.0

Frequência de cada deputado em cada dia com sessão do plenário, com a justificativa da ausência.
Fonte: `GET /SitCamaraWS/sessoesreunioes.asmx/ListarPresencasParlamentar`, uma consulta por matrícula
(a API v2 não publica a justificativa).

- **Conector:** `prometeu_dados.conectores.camara.ConectorFrequenciaDaCamara`
- **Chave natural:** `(matricula, dia)`
- **Atualização:** diária, 6h (horário de Brasília), revisitando os últimos 30 dias: a justificativa
  costuma ser registrada depois da sessão, e regravar o dia atualiza a linha.
- **Evento:** `LoteIngerido` com `fonte = camara`, `tabela = camara_frequencia_dia`
- **Consumidor:** Atividade Legislativa

| Coluna          | Tipo      | Nulo | Regra de normalização                                                                                    |
| --------------- | --------- | ---- | -------------------------------------------------------------------------------------------------------- |
| `matricula`     | `integer` | não  | `numMatriculaParlamentar` consultada; a resposta precisa trazer a mesma `carteiraParlamentar`.           |
| `dia`           | `date`    | não  | Data de `data` (`dd/mm/aaaa hh:mm:ss`, calendário de Brasília); a hora é descartada.                     |
| `frequencia`    | `text`    | não  | `frequencianoDia`, grafia da fonte: `Presença`, `Presença (~)`, `Ausência` ou `Ausência justificada`.    |
| `justificativa` | `text`    | sim  | `justificativa` com espaços colapsados, grafia da fonte (`Missão Autorizada`...); texto vazio vira nulo. |
| `sessoes`       | `jsonb`   | não  | Lista de `{ "descricao", "frequencia" }`, uma por sessão do dia, com a mesma grafia de `frequencia`.     |

Grafia de frequência fora da lista faz o conector falhar: ninguém sabe interpretar uma grafia nova, e
gravá-la mesmo assim levaria um dado errado ao site.

O serviço responde 404 para algumas matrículas. A resposta é descartada sem gravar nada: falta de dado
não é ausência do deputado.

Mais as [colunas de origem](../colunas-de-origem.md).
