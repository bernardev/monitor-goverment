# Linguagem ubíqua

> Glossário obrigatório. O termo usado aqui é o termo usado no código, no banco, na API, na interface e nas
> conversas. Se um termo novo surgir, ele entra aqui **antes** de entrar no código.
> Ver [ADR-0011](../adr/0011-linguagem-ubiqua-em-portugues.md).

## Agentes públicos

| Termo                     | Definição                                                                                                                     | Não confundir com    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| **Pessoa**                | Ser humano identificado de forma única na plataforma, independentemente de cargo.                                             | Candidatura, Mandato |
| **Candidatura**           | Registro de uma pessoa concorrendo a um cargo em uma eleição (fonte: TSE). Promessas de campanha pertencem a uma candidatura. | Mandato              |
| **Mandato**               | Período em que uma pessoa exerce um cargo eletivo em um ente. Nasce de uma candidatura eleita (ou de suplência/posse).        | Cargo                |
| **Cargo**                 | Função eletiva: presidente, governador, prefeito, senador, deputado federal, deputado estadual/distrital, vereador (e vices). | Mandato              |
| **Ente federativo**       | União, estado, Distrito Federal ou município. Identificado pelo código IBGE (União = `0`).                                    | Órgão                |
| **Esfera**                | `federal`, `estadual`, `distrital` ou `municipal`.                                                                            | —                    |
| **Casa legislativa**      | Câmara dos Deputados, Senado Federal, Assembleia Legislativa de UF, Câmara Legislativa do DF ou Câmara Municipal.             | Comissão             |
| **Identificador externo** | Código de uma pessoa ou registro numa fonte (ex.: `camara:204554`, `tse:250001234567`).                                       | Id interno           |

## Compromissos (núcleo)

| Termo                 | Definição                                                                                                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Promessa**          | Compromisso público verificável, atribuído a uma candidatura ou mandato, extraído de uma fonte. Unidade atômica: uma promessa = uma entrega.                                                                    |
| **Fonte da promessa** | De onde a promessa veio: `plano_de_governo` (registrado no TSE), `debate`, `entrevista`, `sabatina`, `discurso`, `publicacao_oficial`.                                                                          |
| **Trecho**            | A citação literal da fonte que sustenta a promessa, com localização (página do PDF ou intervalo de tempo do vídeo).                                                                                             |
| **Meta**              | Parte mensurável da promessa, quando existe (ex.: "500 creches", "até 2028").                                                                                                                                   |
| **Mensurabilidade**   | `mensuravel`, `parcialmente_mensuravel` ou `generica`. Promessa genérica é registrada como tal, e isso é informação.                                                                                            |
| **Competência**       | Se a entrega está dentro das atribuições do cargo: `propria`, `compartilhada`, `fora_da_competencia`.                                                                                                           |
| **Vínculo**           | Ligação entre uma promessa e um fato de outro contexto: proposição, ação orçamentária, emenda, obra, ato normativo. Tem origem (`curador` ou `sugestao_ia`) e situação (`sugerido`, `confirmado`, `rejeitado`). |
| **Cadeia de entrega** | Sequência de estágios pelos quais uma promessa passa: **Prometida → Ato → Orçamento → Execução → Entrega**.                                                                                                     |
| **Estágio na cadeia** | O ponto mais avançado da cadeia que tem evidência confirmada. É **objetivo**, derivado dos vínculos.                                                                                                            |
| **Veredito**          | Avaliação editorial da promessa: `nao_iniciada`, `em_andamento`, `travada`, `cumprida`, `cumprida_parcialmente`, `nao_cumprida`. É **editorial**, exige justificativa e evidência.                              |
| **Evidência**         | Fato comprovado por uma captura no Acervo que justifica um vínculo, estágio ou veredito.                                                                                                                        |

> **Estágio ≠ Veredito.** O estágio diz _onde_ a promessa está na cadeia (fato). O veredito diz _se_ ela foi
> cumprida (julgamento editorial com regras públicas). Separar os dois é o que nos torna verificáveis.

## Atividade legislativa

| Termo          | Definição                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Proposição** | Projeto de lei, PEC, MP, requerimento etc., identificado por sigla + número + ano + casa.                                                                          |
| **Tramitação** | Cada movimento de uma proposição (apresentação, comissão, plenário, sanção, veto, arquivamento).                                                                   |
| **Sessão**     | Reunião deliberativa ou não deliberativa de uma casa ou comissão.                                                                                                  |
| **Votação**    | Deliberação sobre uma proposição numa sessão.                                                                                                                      |
| **Voto**       | Posição de um mandato numa votação nominal: `sim`, `nao`, `abstencao`, `obstrucao`, `artigo_17`, `ausente`.                                                        |
| **Presença**   | Registro de comparecimento de um mandato a uma sessão.                                                                                                             |
| **Ausência**   | Não comparecimento, com **motivo da ausência** quando registrado oficialmente (ex.: missão autorizada, licença médica, licença particular) ou `sem_justificativa`. |

## Finanças públicas

| Termo                                | Definição                                                                                                                                                               |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dinheiro**                         | Valor monetário em centavos inteiros + moeda. Nunca ponto flutuante.                                                                                                    |
| **Programa (PPA)**                   | Programa do Plano Plurianual.                                                                                                                                           |
| **Ação orçamentária**                | Item da LOA ao qual o dinheiro é destinado.                                                                                                                             |
| **Emenda**                           | Alteração ao orçamento indicada por parlamentar, bancada ou comissão. Tipos: `individual`, `bancada`, `comissao`, `relator`, `transferencia_especial` (a "emenda PIX"). |
| **Plano de trabalho**                | Documento que detalha onde e como o recurso de uma emenda será aplicado.                                                                                                |
| **Empenho / Liquidação / Pagamento** | Fases da despesa: reserva → reconhecimento da entrega → saída do dinheiro.                                                                                              |
| **Transferência**                    | Repasse entre entes (constitucional, legal ou voluntária).                                                                                                              |

## Obras e acervo

| Termo                | Definição                                                                       |
| -------------------- | ------------------------------------------------------------------------------- |
| **Obra**             | Empreendimento físico financiado com recurso público, com localização.          |
| **Situação da obra** | `planejada`, `em_execucao`, `paralisada`, `concluida`, `cancelada`.             |
| **Medição**          | Percentual executado informado numa data.                                       |
| **Registro cidadão** | Foto ou relato enviado por cidadão sobre uma obra, publicado só após moderação. |
| **Documento fonte**  | Recurso externo identificado por URL (PDF, página, vídeo, API).                 |
| **Captura**          | Cópia imutável de um documento fonte num instante, com hash SHA-256. É a prova. |
| **Transcrição**      | Texto de um vídeo ou áudio, dividido em segmentos com tempo inicial e final.    |

## Editorial e engajamento

| Termo              | Definição                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| **Curadoria**      | Trabalho humano de registrar promessas, confirmar vínculos e propor vereditos.                                 |
| **Revisão**        | Aprovação por uma segunda pessoa, obrigatória para vereditos sensíveis.                                        |
| **Sugestão**       | Proposta gerada por IA (promessa extraída, vínculo, resumo). Nunca é publicada sem decisão humana.             |
| **Contestação**    | Pedido formal de correção feito por qualquer pessoa, inclusive o próprio agente público (direito de resposta). |
| **Errata**         | Registro público de correção, com o que mudou e por quê.                                                       |
| **Acompanhamento** | Um cidadão seguindo uma pessoa, promessa, proposição ou município.                                             |
| **Meu governo**    | Recorte personalizado: todos os mandatos, emendas e obras ligados ao município do cidadão.                     |
