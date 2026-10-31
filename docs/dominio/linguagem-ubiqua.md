# Linguagem ubíqua

> Glossário obrigatório. O termo usado aqui é o termo usado no código, no banco, na API, na interface e nas
> conversas. Se um termo novo surgir, ele entra aqui **antes** de entrar no código.
> Ver [ADR-0011](../adr/0011-linguagem-ubiqua-em-portugues.md).

## Agentes públicos

| Termo                     | Definição                                                                                                                                                                                    | Não confundir com        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| **Pessoa**                | Ser humano identificado de forma única na plataforma, independentemente de cargo.                                                                                                            | Candidatura, Mandato     |
| **Candidatura**           | Registro de uma pessoa concorrendo a um cargo em uma eleição (fonte: TSE). Promessas de campanha pertencem a uma candidatura.                                                                | Mandato                  |
| **Mandato**               | Período em que uma pessoa exerce um cargo eletivo em um ente, da posse (ou reassunção) até a saída. Quem se licencia e volta tem dois mandatos; o suplente tem o seu enquanto está no cargo. | Cargo                    |
| **Cargo**                 | Função eletiva: presidente, governador, prefeito, senador, deputado federal, deputado estadual/distrital, vereador (e vices).                                                                | Mandato                  |
| **Ente federativo**       | União, estado, Distrito Federal ou município. Identificado pelo código IBGE (União = `0`).                                                                                                   | Órgão                    |
| **Esfera**                | `federal`, `estadual`, `distrital` ou `municipal`.                                                                                                                                           | —                        |
| **Casa legislativa**      | Câmara dos Deputados, Senado Federal, Assembleia Legislativa de UF, Câmara Legislativa do DF ou Câmara Municipal.                                                                            | Comissão                 |
| **Identificador externo** | Código de uma pessoa ou registro numa fonte (ex.: `camara:204554`, `tse:250001234567`).                                                                                                      | Id interno               |
| **Nome público**          | Nome pelo qual a pessoa é conhecida no exercício da função (nome parlamentar, nome de urna).                                                                                                 | Pessoa                   |
| **Filiação partidária**   | Partido ao qual a pessoa está filiada, como a fonte oficial escreve a sigla. Sem partido é um estado legítimo.                                                                               | Pessoa                   |
| **Circunscrição**         | Ente que elege o cargo: a União (presidente), uma UF ou o DF (senador, deputado federal, governador) ou um município (prefeito, vereador).                                                   | Mandato, Ente federativo |

## Compromissos (núcleo)

| Termo                             | Definição                                                                                                                                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Promessa**                      | Compromisso público verificável, atribuído a uma candidatura ou mandato, extraído de uma fonte. Unidade atômica: uma promessa = uma entrega.                                                                    |
| **Fonte da promessa**             | De onde a promessa veio: `plano_de_governo` (registrado no TSE), `debate`, `entrevista`, `sabatina`, `discurso`, `publicacao_oficial`.                                                                          |
| **Trecho**                        | A citação literal da fonte que sustenta a promessa, com localização (página do PDF ou intervalo de tempo do vídeo).                                                                                             |
| **Meta**                          | Parte mensurável da promessa, quando existe (ex.: "500 creches", "até 2028").                                                                                                                                   |
| **Mensurabilidade**               | `mensuravel`, `parcialmente_mensuravel` ou `generica`. Promessa genérica é registrada como tal, e isso é informação.                                                                                            |
| **Competência**                   | Se a entrega está dentro das atribuições do cargo: `propria`, `compartilhada`, `fora_da_competencia`.                                                                                                           |
| **Vínculo**                       | Ligação entre uma promessa e um fato de outro contexto: proposição, ação orçamentária, emenda, obra, ato normativo. Tem origem (`curador` ou `sugestao_ia`) e situação (`sugerido`, `confirmado`, `rejeitado`). |
| **Candidato a vínculo**           | Fato do autor da promessa (proposição de autoria, emenda que indicou, obra paga por ela) que o painel mostra à curadoria, ordenado pelas palavras em comum com a promessa. Não é vínculo até alguém sugerir.    |
| **Pedido de reavaliação**         | Aviso na promessa de que um fato com vínculo confirmado mudou na fonte (a obra parou, a emenda pagou, a proposição tramitou). Não muda estágio nem veredito; a curadoria olha e conclui a reavaliação.          |
| **Cadeia de entrega**             | Sequência de estágios pelos quais uma promessa passa: **Prometida → Ato → Orçamento → Execução → Entrega**.                                                                                                     |
| **Estágio na cadeia**             | O ponto mais avançado da cadeia que tem evidência confirmada. É **objetivo**, derivado dos vínculos.                                                                                                            |
| **Veredito**                      | Avaliação editorial da promessa: `nao_iniciada`, `em_andamento`, `travada`, `cumprida`, `cumprida_parcialmente`, `nao_cumprida`. É **editorial**, exige justificativa e evidência.                              |
| **Evidência**                     | Fato comprovado por uma captura no Acervo que justifica um vínculo, estágio ou veredito.                                                                                                                        |
| **Proposta de veredito**          | Veredito proposto por um curador e ainda não publicado. Só existe uma pendente por promessa.                                                                                                                    |
| **Fundamento de não cumprimento** | Por que a promessa não foi cumprida: `mandato_encerrado` ou `ato_em_sentido_contrario` (com captura do ato).                                                                                                    |
| **Errata**                        | Correção de um veredito publicado por erro de avaliação. Gera novo registro que aponta para o corrigido; nada é apagado.                                                                                        |

> **Estágio ≠ Veredito.** O estágio diz _onde_ a promessa está na cadeia (fato). O veredito diz _se_ ela foi
> cumprida (julgamento editorial com regras públicas). Separar os dois é o que nos torna verificáveis.

## Atividade legislativa

| Termo                      | Definição                                                                                                                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Proposição**             | Proposta que pode virar norma (PEC, PLP, PL, MPV, PDL), identificada por sigla + número + ano + casa. A mesma matéria nas duas casas são duas proposições. Requerimentos e pareceres são documentos de trâmite, não proposições aqui. |
| **Autoria**                | Quem apresentou a proposição: parlamentar (ligado à pessoa quando conhecido), Poder Executivo, comissão ou outro órgão. Quem só assina junto não é proponente.                                                                        |
| **Tramitação**             | Cada movimento de uma proposição (apresentação, comissão, plenário, sanção, veto, arquivamento), em ordem cronológica. Ato novo depois dos conhecidos é **avanço**; mudança no que a casa já publicou é **retificação**.              |
| **Sessão**                 | Reunião deliberativa ou não deliberativa de uma casa ou comissão.                                                                                                                                                                     |
| **Votação**                | Deliberação sobre uma proposição numa sessão.                                                                                                                                                                                         |
| **Votação nominal**        | Votação em que a casa registra o voto de cada parlamentar. A simbólica, sem voto por parlamentar, não é nominal.                                                                                                                      |
| **Voto**                   | Posição de um mandato numa votação nominal: `sim`, `nao`, `abstencao`, `obstrucao`, `presidente_da_sessao` (presidia e só vota para desempatar) ou `secreto`. Ausência não é voto.                                                    |
| **Votação secreta**        | Votação nominal em que a casa registra quem votou, mas não como. Todos os votos são `secreto`, ou nenhum.                                                                                                                             |
| **Relação completa**       | A casa lista, em cada votação, todos os parlamentares em exercício, inclusive quem não votou e por quê (o Senado faz isso; a Câmara não).                                                                                             |
| **Situação sem voto**      | Por que um parlamentar listado não votou: `presente_sem_voto`, `ausente`, `ausencia_justificada` (com **motivo da ausência**) ou `nao_informada` (registro da casa sem legenda pública).                                              |
| **Sem voto registrado**    | O parlamentar estava no cargo e a casa não registrou voto dele na votação. Não é sinônimo de ausência: a situação do dia vem do **registro de frequência**.                                                                           |
| **Presença**               | Registro de comparecimento de um mandato a uma sessão.                                                                                                                                                                                |
| **Ausência**               | Não comparecimento, com **motivo da ausência** quando registrado oficialmente (ex.: missão autorizada, licença médica, licença particular) ou `sem_justificativa`.                                                                    |
| **Dia de sessão**          | Dia do calendário de Brasília em que houve sessão do plenário. É a unidade em que as casas apuram a frequência (`aaaa-mm-dd`, nunca um instante em UTC).                                                                              |
| **Registro de frequência** | Situação de um mandato num dia de sessão: `presente`, `ausente` ou `ausencia_justificada`, com as sessões do dia e a captura que prova. Um por pessoa, casa e dia.                                                                    |
| **Ausência justificada**   | Ausência que a casa aceitou, sempre com **motivo da ausência**. Só ela tem motivo; uma falta comum (`ausente`) não tem.                                                                                                               |
| **Motivo da ausência**     | Categoria comparável entre casas (`licenca_saude`, `licenca_gestante`, `licenca_paternidade`, `licenca_particular`, `missao_autorizada`, `atividade_parlamentar`, `decisao_da_mesa`, `outro`) mais a descrição nas palavras da fonte. |
| **Retificação**            | Correção de um registro de frequência pela própria casa (ex.: a justificativa aceita dias depois). Gera `FrequenciaRetificada`; o registro anterior fica nos eventos.                                                                 |
| **Registro na fonte**      | Como a casa escreveu a situação (`Presença (~)`), guardado para conferência. Não é interpretado além da tradução documentada no importador.                                                                                           |

## Finanças públicas

| Termo                                | Definição                                                                                                                                                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dinheiro**                         | Valor monetário em centavos inteiros + moeda. Nunca ponto flutuante.                                                                                                                                        |
| **Programa (PPA)**                   | Programa do Plano Plurianual.                                                                                                                                                                               |
| **Ação orçamentária**                | Item da LOA ao qual o dinheiro é destinado.                                                                                                                                                                 |
| **Emenda**                           | Alteração ao orçamento indicada por parlamentar, bancada ou comissão. Tipos: `individual`, `bancada`, `comissao`, `relator`. Só a individual tem um parlamentar como autor.                                 |
| **Destinação**                       | Para onde vai o dinheiro da emenda: uma localidade e uma classificação orçamentária (função, subfunção, programa, ação, plano orçamentário), com a execução acumulada.                                      |
| **Modalidade**                       | Como o dinheiro da emenda individual chega ao ente, em cada destinação: `finalidade_definida` ou `transferencia_especial` (a "emenda PIX", direto no caixa).                                                |
| **Restos a pagar**                   | Empenho que não foi pago no ano do orçamento e passa como dívida aos anos seguintes, onde pode ser pago ou cancelado.                                                                                       |
| **Plano de trabalho**                | Documento que detalha onde e como o recurso de uma emenda será aplicado.                                                                                                                                    |
| **Empenho / Liquidação / Pagamento** | Fases da despesa: reserva → reconhecimento da entrega → saída do dinheiro.                                                                                                                                  |
| **Transferência**                    | Repasse entre entes (constitucional, legal ou voluntária).                                                                                                                                                  |
| **Favorecido**                       | Quem recebeu dinheiro de uma emenda: pessoa jurídica (CNPJ) ou unidade gestora (órgão federal), com nome. Pessoas físicas e quem não tem CPF nem CNPJ entram somados por município, sem nome nem documento. |
| **Recebimento**                      | O que um favorecido recebeu de uma emenda num mês (`aaaa-mm`). Pode ser negativo: estorno.                                                                                                                  |
| **Convênio**                         | Acordo pelo qual a União repassa dinheiro a um **convenente** (quem recebe e executa) para um objeto, com valor e data de publicação. Uma ou mais emendas o pagam.                                          |

## Obras e acervo

| Termo                | Definição                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Obra**             | Empreendimento físico financiado com recurso público, com localização.                                               |
| **Situação da obra** | `planejada` (cadastrada, sem execução), `em_execucao`, `paralisada`, `concluida`, `cancelada`, `inacabada`.          |
| **Interrupção**      | Paralisação, cancelamento ou declaração de obra inacabada registrada no histórico da obra, com data e justificativa. |
| **Medição**          | Percentual executado informado numa data. A fonte registra medições acima de 100%, e elas ficam como vieram.         |
| **Registro cidadão** | Foto ou relato enviado por cidadão sobre uma obra, publicado só após moderação.                                      |
| **Documento fonte**  | Recurso externo identificado por URL (PDF, página, vídeo, API).                                                      |
| **Captura**          | Cópia imutável de um documento fonte num instante, com hash SHA-256. É a prova.                                      |
| **Bronze**           | Resposta bruta de uma fonte, guardada sem alteração no armazenamento de objetos e endereçada pelo hash.              |
| **Prata**            | Dados de uma fonte limpos e tipados no schema `ingestao`, cada tabela com contrato versionado.                       |
| **Lote**             | Resultado de uma coleta gravado de uma vez na prata e anunciado pelo evento `LoteIngerido`.                          |
| **Projeção**         | Tabela de leitura montada a partir de eventos para o site e a API (contexto Consulta). Descartável e reconstruível.  |
| **Transcrição**      | Texto de um vídeo ou áudio, dividido em segmentos com tempo inicial e final.                                         |

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
