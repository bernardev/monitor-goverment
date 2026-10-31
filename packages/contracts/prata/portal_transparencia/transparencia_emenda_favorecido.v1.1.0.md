# `ingestao.transparencia_emenda_favorecido` v1.1.0

Quem recebeu o dinheiro das emendas aos orçamentos desde 2023, mês a mês. Fonte: o arquivo único de
emendas do
[Portal da Transparência](https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares)
(`EmendasParlamentares_PorFavorecido.csv` dentro do ZIP), o mesmo de
[`transparencia_emenda`](transparencia_emenda.v1.1.0.md).

- **Conector:** `prometeu_dados.conectores.portal_transparencia.ConectorEmendasDoPortal`
- **Chave natural:** `(codigo_emenda, mes, tipo_favorecido, codigo_favorecido, uf, municipio)`, com
  nulos iguais entre si (`NULLS NOT DISTINCT`)
- **Atualização:** diária, 6h (horário de Brasília), junto com as emendas. Toda execução regrava todas
  as linhas.
- **Evento:** `LoteIngerido` com `fonte = portal_transparencia`, `tabela = transparencia_emenda_favorecido`
- **Consumidor:** Finanças Públicas

O valor é o recebido no mês, não acumulado, e pode ser negativo (estorno). Cabeçalho diferente, tipo de
favorecido desconhecido, documento fora do formato, mês ou valor fora do formato, UF desconhecida ou o
mesmo favorecido duas vezes no mês da mesma emenda fazem o conector falhar. Linhas sem código de emenda
e de orçamentos anteriores a 2023 ficam de fora.

**Pessoas físicas não entram uma a uma.** O Portal publica o nome e parte do CPF de quem recebe como
pessoa física (bolsas, auxílios). A plataforma acompanha o dinheiro, não o cidadão: essas linhas são
somadas por emenda, mês e município, sem nome, CPF nem natureza jurídica, e `quantidade` diz quantas
foram somadas. O mesmo vale para a inscrição genérica (quem não tem CPF nem CNPJ, que mistura pessoas e
empresas estrangeiras) e para o favorecido sem informação. O nome continua só no bronze, que é a prova
do que a fonte publicou.

| Coluna              | Tipo      | Nulo | Regra de normalização                                                                                    |
| ------------------- | --------- | ---- | -------------------------------------------------------------------------------------------------------- |
| `codigo_emenda`     | `text`    | não  | `Código da Emenda`; o mesmo de `transparencia_emenda`.                                                   |
| `mes`               | `char(7)` | não  | `Ano/Mês` (`202605`) como `2026-05`.                                                                     |
| `tipo_favorecido`   | `text`    | não  | `Tipo Favorecido`. Ver abaixo.                                                                           |
| `codigo_favorecido` | `text`    | sim  | `Código do Favorecido`: CNPJ (14 dígitos) ou código da unidade gestora (6 dígitos). Nulo no somado.      |
| `nome_favorecido`   | `text`    | sim  | `Favorecido`, espaços normalizados. Nulo no somado.                                                      |
| `natureza_juridica` | `text`    | sim  | `Natureza Jurídica` (`Associação Privada`, `Município`); `Sem informação` e o somado viram nulo.         |
| `uf`                | `char(2)` | sim  | `UF Favorecido`, sigla; vazio e `-1` viram nulo.                                                         |
| `municipio`         | `text`    | sim  | `Município Favorecido`, como a fonte escreve (`SÃO PAULO`), sem código IBGE; `Sem informação` vira nulo. |
| `quantidade`        | `integer` | não  | Quantas linhas da fonte a linha soma: 1 no favorecido identificado.                                      |
| `valor_centavos`    | `bigint`  | não  | `Valor Recebido` no mês, em centavos inteiros; somado no favorecido somado. Pode ser negativo (estorno). |

Mais as [colunas de origem](../colunas-de-origem.md).

Tipos de favorecido:

- identificados, com documento e nome: `Pessoa Jurídica` (CNPJ) e `Unidade Gestora` (órgão federal,
  pelo código SIAFI);
- somados: `Pessoa Física` (a fonte escreve `Pessoa Fisica`), `Inscrição Genérica` (a fonte às vezes
  corta em `Inscrição Genéric`) e `Sem informação`.

As colunas de autor, número e tipo da emenda do CSV não entram: estão em `transparencia_emenda`.
