# Colunas comuns a toda tabela prata

Toda linha da camada prata diz de qual lote veio e de qual resposta bruta foi extraída
([ADR-0016](../../../docs/adr/0016-registro-de-capturas-na-importacao.md)).

| Coluna                    | Tipo          | Significado                                                             |
| ------------------------- | ------------- | ----------------------------------------------------------------------- |
| `lote_id`                 | `uuid`        | Id do evento `LoteIngerido` que gravou a linha por último.              |
| `origem_fonte`            | `text`        | Nome do conector (`camara`).                                            |
| `origem_url`              | `text`        | URL exata consultada.                                                   |
| `origem_coletada_em`      | `timestamptz` | Quando a resposta foi recebida.                                         |
| `origem_sha256`           | `char(64)`    | Hash da resposta bruta; identifica a captura.                           |
| `origem_caminho`          | `text`        | Chave do objeto no bronze (`bronze/<fonte>/<aaaa>/<mm>/<dd>/<sha256>`). |
| `origem_tipo_de_conteudo` | `text`        | Content-Type devolvido pela fonte.                                      |
| `ingerido_em`             | `timestamptz` | Quando a linha entrou na prata.                                         |
| `atualizado_em`           | `timestamptz` | Última regravação.                                                      |

Para ler só as linhas de um lote: `WHERE lote_id = <id do LoteIngerido>`. Um lote mais novo regrava as
mesmas linhas com o próprio id, então o importador sempre vê o retrato mais recente.
