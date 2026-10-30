# `ingestao.senado_processo` v1.0.0

Proposições normativas do Senado (PEC, PLP, PL, MPV e PDL) atualizadas na janela. Fontes:
`GET /processo?sigla=&numdias=` para listar e `GET /processo/{id}` para o detalhe, nos
[Dados Abertos do Senado](https://legis.senado.leg.br/dadosabertos/docs/).

- **Conector:** `prometeu_dados.conectores.senado.ConectorProposicoesDoSenado`
- **Chave natural:** `id_processo`
- **Atualização:** diária, 6h (horário de Brasília), com os processos atualizados nos últimos 3 dias
- **Evento:** `LoteIngerido` com `fonte = senado`, `tabela = senado_processo`
- **Consumidor:** Atividade Legislativa

A fonte só filtra pelos últimos N dias contados de hoje, com N de no máximo 30.

| Coluna            | Tipo      | Nulo | Regra de normalização                                                                                |
| ----------------- | --------- | ---- | ---------------------------------------------------------------------------------------------------- |
| `id_processo`     | `integer` | não  | `id`; é o `idProcesso` das votações (`senado_votacao` v1.1.0).                                       |
| `codigo_materia`  | `integer` | sim  | `codigoMateria`, o código do sistema anterior.                                                       |
| `sigla`           | `text`    | não  | `sigla`; tipo fora do filtro faz o conector falhar.                                                  |
| `numero`          | `integer` | não  | `numero` (a fonte manda como texto).                                                                 |
| `ano`             | `integer` | não  | `ano`.                                                                                               |
| `ementa`          | `text`    | sim  | `conteudo.ementa`, com espaços repetidos colapsados.                                                 |
| `apresentada_em`  | `date`    | sim  | `documento.dataApresentacao`.                                                                        |
| `casa_iniciadora` | `text`    | sim  | `siglaCasaIniciadora` (`SF`, `CD`).                                                                  |
| `tramitando`      | `boolean` | não  | `tramitando` (`Sim`/`Não`).                                                                          |
| `situacao`        | `jsonb`   | sim  | `{sigla, descricao, desde}` de `siglaSituacaoAtual`, `situacaoAtual` e `dataSituacaoAtual`.          |
| `autores`         | `jsonb`   | não  | `autoriaIniciativa`: `[{nome, tipo, codigo_parlamentar, sigla_partido, uf, ordem}]`.                 |
| `situacoes`       | `jsonb`   | não  | Situações da autuação principal, em ordem de início: `[{sigla, descricao, inicio, fim, colegiado}]`. |
| `norma_gerada`    | `text`    | sim  | `normaGerada.descricao` (`Lei nº 15.018 de 12/11/2024`).                                             |
| `url_documento`   | `text`    | sim  | `documento.url`.                                                                                     |

Mais as [colunas de origem](../colunas-de-origem.md).

`codigo_parlamentar` só é preenchido quando o autor é senador: o Senado dá um código próprio também
para deputados, que não é o id da Câmara.
