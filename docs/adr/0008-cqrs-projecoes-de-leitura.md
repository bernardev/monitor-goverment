# ADR-0008: CQRS: projeções de leitura para site e API pública

- **Status:** Aceito
- **Data:** 2026-10-28

## Contexto

A carga é **muito mais de leitura do que de escrita**: milhões de visitas em dias de votação ou notícia
contra algumas centenas de ações editoriais por dia e lotes de ingestão. As telas cruzam contextos (o perfil
de um deputado mostra presença, votos, emendas, obras e promessas), o que os modelos de escrita isolados
não devem fazer.

## Decisão

- **Escrita:** comandos passam pelos casos de uso de cada módulo e alteram só o seu agregado.
- **Leitura:** o módulo `consulta` mantém **projeções desnormalizadas** no schema `consulta`, atualizadas
  por consumidores de eventos. Ex.: `perfil_do_mandato`, `linha_do_tempo_da_promessa`, `meu_governo_por_municipio`,
  `presenca_por_mandato`.
- Projeções são **descartáveis e reconstruíveis**: um comando de reprocessamento recria qualquer projeção a
  partir dos dados de escrita.
- Site e API pública leem **apenas** projeções.
- **Cache em camadas:** CDN na frente do site (ISR do Next.js), com **revalidação sob demanda** disparada por
  eventos (quando um veredito é publicado, só as páginas afetadas são regeneradas).
- **API pública** de dados abertos (`/v1`, somente leitura, com limite de requisições) devolve à sociedade o
  que organizamos. Isso gera credibilidade e uso por imprensa e pesquisadores.

## Alternativas consideradas

- **Consultas com JOIN entre schemas:** viola a propriedade dos dados e acopla os módulos.
- **Banco de leitura separado desde já:** possível no futuro (réplica ou outro banco); hoje o schema basta.

## Consequências

- **Positivas:** leitura rápida e barata; picos absorvidos pela CDN; telas evoluem sem tocar no domínio.
- **Negativas:** atraso de segundos entre a escrita e a tela; mais código de projeção para manter.
