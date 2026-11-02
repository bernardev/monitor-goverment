# Design: o Prometeu com cara de jornal

- **Data:** 2026-11-02
- **Substitui:** a identidade visual do [ADR-0017](../../adr/0017-identidade-visual.md) ("Prometeu no pretérito").
- **Alcance:** o site do cidadão (`apps/web`), o painel de curadoria (`apps/curadoria`) e o pacote
  visual compartilhado (`packages/ui`).

## Intenção

O dono do produto achou o visual atual exagerado: verbos enormes ("Compareceu.", "Votou."), campos de
cor de tela inteira e uma tipografia de que não gostou. Ele quer que o Prometeu pareça um **jornal de
referência**, como Estadão e Valor: sério, com cara de notícia, e por isso com mais credibilidade.

O objetivo maior é que **uma pessoa leiga entenda a informação**: o que aquele número é, de quando é e
de onde veio. O visual de jornal serve a isso, porque é uma forma de ler que todo mundo já conhece.

Para não ficar "monocromático e velho", entram um azul-marinho e um movimento leve. A tecnologia não
aparece em efeitos: aparece no dado (o período, a fonte, a data da coleta, o número exato).

Os esboços aprovados estão em `.superpowers/brainstorm/1559-1793585900/content/` (fora do Git):
`estilo.html` (direção A escolhida), `graficos.html` (nível "Discreto" escolhido) e
`parlamentar-v2.html` (a página de referência, aprovada).

## Objetivos

- Todo o site e todo o painel no estilo de jornal de referência, sem página esquecida no visual antigo.
- Cada número diz **o que é, de quando é e de onde veio**, em português simples.
- A página de cada parlamentar, cidade, votação, emenda e obra se lê como uma reportagem.
- A capa se monta sozinha com o que há de mais recente na base.
- Movimento leve em todas as páginas, desligado para quem pede menos movimento.

## Fora do escopo

- Novos dados, novas fontes, novas rotas de API. A capa usa só o que a API já oferece.
- O vídeo de apresentação (`video-prometeu`), que tem layout próprio.
- Modo escuro.
- Gráficos interativos (passar o mouse, filtrar no gráfico): o dono escolheu o nível "Discreto".

## O que seria fracasso, mesmo funcionando

- Parecer portal popular: faixa vermelha, títulos gritados, chamada sensacionalista.
- Qualquer cor que lembre partido, ou "sim" e "não" em vermelho e verde.
- Número sem período ou sem fonte.
- Termo técnico sem explicação ("empenhado", "emenda", "sessão") onde um leigo vai ler.
- Animação que atrapalha a leitura, que repete em loop, ou que esconde conteúdo quando o script não
  roda.
- Voltar a usar verbos gigantes ou campos de cor de tela inteira.

## Restrições

- **Neutralidade** (vem do ADR-0017 e continua valendo): nada de cor de partido; "sim" e "não" se
  distinguem por tonalidade e por texto.
- **Prova** (ADR-0009): a fonte e a data da captura continuam visíveis em cada bloco de dado.
- **Sem dependências novas.** As fontes entram por `next/font/google`, como a atual, servidas pelo
  próprio site. Animações em CSS (e um script curto para contar números), sem biblioteca.
- **Acessibilidade:** contraste AA, foco visível, `prefers-reduced-motion` respeitado, conteúdo visível
  sem JavaScript.
- **Arquitetura:** `packages/ui` continua só de apresentação (regra `ui-so-apresentacao` do
  dependency-cruiser). Os apps não importam um do outro.
- **Sem foto de parlamentar identificável em destaque fora da página da própria pessoa** (ADR-0017,
  créditos em `_imagens/CREDITOS.md`).

## O que o dono decidiu

1. **Direção A, jornal de referência:** títulos com serifa, texto sem serifa, fundo branco, fios finos
   separando as seções, uma só cor de destaque (azul-marinho) nos chapéus e links.
2. **Gráficos no nível "Discreto":** barras simples, sem grade, sem interação.
3. **Movimento leve:** números contando até o valor, barras crescendo e itens surgindo ao aparecer na
   tela. Sem loop.
4. **O azul-marinho entra nos números e nas barras** dos gráficos, para não ficar monocromático.
5. **Os verbos no pretérito saem.** O nome **Prometeu** fica.
6. **O painel da curadoria também muda** para o mesmo visual.
7. **Página do parlamentar** como em `parlamentar-v2.html`:
   - cabeçalho com foto, chapéu do cargo, nome, partido-UF e Acompanhar;
   - faixa de quatro números-chave, **cada um com o seu período**;
   - seções com título em serifa sobre fio grosso e o período à direita;
   - **legenda** sob o calendário de presença;
   - fonte e data da coleta no rodapé de cada seção.
8. **Capa como primeira página de jornal** que se monta com o mais recente (`paginas.html`).

## Escolhas minhas (o dono não opinou; dá para mudar)

- **Fontes:** Source Serif 4 (títulos, nome da marca, números-chave) e Inter (texto, rótulos, menus),
  ambas OFL, por `next/font/google`. Schibsted Grotesk sai.
- **Cores:**
  - **fundo:** branco `#ffffff`, com superfície `#f4f5f7` para caixas;
  - **tinta:** `#111111`; texto secundário `#555555`; notas `#6b6b6b` (5,3:1 sobre o branco, AA para
    13 px; `#777777`, dos esboços, fica abaixo);
  - **fios:** `#e3e3e3` (finos) e `#111111` (fortes);
  - **destaque:** azul-marinho `#0b3d6b`, nos chapéus, links, números-chave e barras principais;
  - **segunda série dos gráficos:** azul-claro `#9fb3c8`;
  - **valor ausente:** branco com contorno `#999999`.
- **Neutralidade nas votações:** sim em `#0b3d6b`, não em `#9fb3c8`, abstenção e sem voto em cinza
  `#cccccc`, sempre com o rótulo escrito. Tonalidade, nunca vermelho e verde. As cores claras ficam
  abaixo de 3:1 contra o branco; passam porque o rótulo escrito sempre acompanha a barra.
- **Período dos números que a API entrega sem intervalo** (soma das emendas do parlamentar, totais de
  emendas e obras, pago e empenhado da cidade): o início vem de uma constante única,
  `INICIO_DA_COBERTURA_DE_EMENDAS = 2023`, porque a base de emendas começa no orçamento de 2023
  (roadmap, fatia 4.1). O fim é "até a coleta de dd/mm/aaaa", com a data da coleta que a resposta já
  traz (`fonte.coletadaEm`). Presença e votos usam o `de`/`ate` que a API já devolve. Se a cobertura
  de emendas recuar algum dia, muda-se só a constante.
- **A capa sem mudar a API:**
  - a obra da capa é **a maior obra paralisada** (`listarObras` com `situacao=paralisada` ordena por
    investimento), com uma chamada a `buscarObra` para o motivo;
  - o destaque de presença é uma chamada de texto, sem número total, levando a Parlamentares.

  Ganhar "a mais recente" ou um total de presença pediria campo novo na API, que fica fora deste
  trabalho.

- **Entrega de uma vez:** todo o trabalho fica no branch `feat/visual-jornal` e só entra na `main`
  quando todas as páginas estiverem no visual novo e o `verify` passar. A `main` nunca mostra metade
  em cada visual, então o CSS velho pode ser apagado à medida que cada página migra.
- **Verificação do tour:** pelo roteiro automático que já roda localmente contra o site real
  (puppeteer do cache do HyperFrames, fora do repositório), sem instalar Playwright. Escrever o teste
  de ponta a ponta no repositório, previsto no ADR-0004, é outro trabalho.
- **Tamanhos (desktop / telefone):**
  - título da página: 40 / 30 px;
  - título de seção: 22 / 20 px;
  - chamada da capa: 30 / 24 px;
  - número-chave: 30 / 26 px;
  - texto: 17 px;
  - nota e fonte: 13 px;
  - chapéu: 12 px em caixa alta, espaçado.
- **Largura de leitura:** 1200 px no máximo para a página e 720 px para parágrafos.
- **Movimento:**
  - itens entram com opacidade e 8 px de subida em 0,5 s;
  - barras crescem da esquerda em 1 s;
  - números contam em 0,9 s, quando o bloco entra na tela (IntersectionObserver), uma vez só;
  - sem JavaScript, ou com `prefers-reduced-motion: reduce`, tudo aparece pronto.
- **Explicações para leigos.** Onde o termo aparece pela primeira vez na página, uma frase curta logo
  ao lado ou numa nota. Textos-base:
  - **Emenda:** dinheiro do orçamento federal que deputados e senadores indicam para estados e cidades.
  - **Empenhado:** dinheiro reservado no orçamento para aquela despesa.
  - **Pago:** dinheiro que já saiu para quem recebe.
  - **Sessão:** reunião do plenário em que há registro de presença.
  - **Falta justificada:** ausência com motivo aceito pela Casa (licença médica, missão oficial etc.).
  - **Votação nominal:** votação em que fica registrado o voto de cada parlamentar.
  - **Favorecido:** empresa ou órgão que recebeu o dinheiro.
  - **Situação da obra:** a que o Obrasgov.br informa (planejada, em execução, paralisada, concluída).
- **Registro da decisão:** novo ADR-0018 ("Identidade visual: jornal de referência"). O ADR-0017 passa
  a "Substituído por ADR-0018", mantendo o texto como histórico. As regras de neutralidade e de prova
  migram para o ADR-0018.

## Como cada parte fica

### Peças comuns (`packages/ui`)

O pacote troca as peças do visual antigo por peças de jornal. O desenho de cada uma é do builder;
estas são as que as páginas precisam:

- **Cabeçalho:**
  - marca "Prometeu" em serifa;
  - data do dia na capa;
  - menu entre fio fino e fio duplo, com o item atual sublinhado;
  - busca à direita.

  No telefone, a marca, a busca e um menu que abre (hoje a navegação some e fica só no rodapé; o tour
  de boas-vindas depende disso, ver abaixo). O cabeçalho deixa de trocar de cor por capítulo.

- **Chapéu:** a etiqueta em caixa alta azul acima de títulos ("Votações · Câmara").
- **Seção:** título em serifa sobre fio grosso, período à direita, conteúdo, e a **Fonte** no rodapé.
- **Faixa de números-chave:** de 2 a 4 números, cada um com rótulo em linguagem simples e o período.
- **Chamada:** chapéu, título, linha fina e fonte, em três tamanhos (manchete, secundária, lista).
- **Gráficos:**
  - **Ranking:** barras horizontais com valor à direita;
  - **Proporção:** barra empilhada com legenda escrita;
  - **Calendário:** dias como quadrados, com a legenda obrigatória;
  - **Cadeia de entrega:** os cinco estágios da promessa;
  - **Placar:** sim, não, abstenção e sem voto.

  Todos no estilo "Discreto", com o azul na série principal e animação de entrada.

- **Nota explicativa:** a frase curta para leigos (ver os textos-base acima).
- **Rodapé:** a marca, os links e a frase de método, que hoje já existem, no visual novo.

`Capitulo` (o verbo gigante com campo de cor) e o tipo `Campo` saem. `Cifra` vira o número-chave.
`medidas.ts` (`porcentagens`, `porMes`) fica, com os testes.

### Capa (`apps/web/app/page.tsx`)

Primeira página que se monta a cada revalidação, só com chamadas da API atual:

- **Manchete:** a votação nominal mais recente, com placar e "veja como votou cada deputado".
- **Secundárias:** a maior obra paralisada, com o motivo, e um destaque de presença em texto ("faltas
  com o motivo dado à Câmara"), sem número total.
- **Coluna lateral:**
  - "O que chegou à sua cidade", com a busca de município;
  - uma cidade de exemplo;
  - os totais de emendas e de obras concluídas, cada um com período.
- **Seção "Por onde começar":** as entradas para cada parte do site, como hoje, no visual novo.

As fotos do Congresso e do Senado podem ficar como ilustração de seção, com crédito, ou sair; é
escolha do builder, desde que nenhum parlamentar identificável apareça em destaque.

### Parlamentar (`apps/web/app/parlamentares/[pessoaId]`)

Segue `parlamentar-v2.html`. As seções de hoje (promessas, presença, votos, proposições, emendas e
obras financiadas) viram **Seções** com títulos simples ("Promessas", "Presença nas sessões",
"Votações", "Projetos apresentados", "Emendas", "Obras pagas com as emendas"), cada uma com período e
fonte. A faixa de números-chave usa os dados que a página já busca. O sumário do topo (que hoje leva
aos verbos) passa a levar às seções.

### Cidade (`apps/web/app/municipios/[codigoIbge]`)

Mesma forma da reportagem:

- cabeçalho com nome, UF e Acompanhar;
- números-chave: pago, empenhado, número de emendas e número de obras, cada um com o período;
- seções "Quem mandou o dinheiro" (Ranking), "Obras pagas com emendas" (Proporção mais lista) e
  "Quem representa a cidade no Congresso" (a bancada);
- no fim, as listas completas.

### Votação, proposição, emenda e obra (as páginas de detalhe)

Cabeçalho de reportagem (chapéu, título, linha fina), números-chave quando houver e as seções de hoje
com títulos simples:

- **Votação:** Placar, depois "Como votou cada um" e "Quem não votou".
- **Emenda:** "Quanto foi reservado e pago", "Para onde foi", "Quem recebeu" e "Virou obra".
- **Obra:** "Andamento", "Paradas, se houve" e "Quanto foi pago".
- **Proposição:** situação e tramitação.

### Listas, busca, fontes e 404/erro

`PaginaDeLista` vira cabeçalho de editoria (título em serifa, frase explicativa, filtros discretos em
linha), contagem, lista com fios entre os itens e paginação. A busca e a página "Situação das fontes"
seguem o mesmo molde. As páginas de não encontrado e de erro viram uma mensagem curta de jornal ("Não
achamos esta página"), sem o verbo gigante.

### Minha conta e o tour de boas-vindas

Mesmo conteúdo, no visual novo. O tour (`_componentes/tour.tsx`) continua igual no comportamento.

- **Cartão:** passa a usar o branco com fio do novo sistema.
- **Destaque:** o contorno do item aceso usa o azul.
- **Telefone:** se o novo cabeçalho do telefone tiver menu que abre, os passos da navegação passam a
  dizer "abra o menu" em vez de "fica no rodapé". O teste `tour-regras.test.ts` continua passando.

### Painel da curadoria (`apps/curadoria`)

Mesma tipografia, cores, cabeçalho e peças, mas com cara de ferramenta:

- lista de promessas como tabela com fios;
- página da promessa com Seções (Fontes, Vínculos, Candidatos, Fatos que mudaram, Histórico de
  vereditos, Propor veredito);
- formulários com campos de borda fina e o botão principal em azul.

Sem capa e sem números contando; a animação de entrada pode ficar, mais curta.

## Como saber que deu certo

- **Leitura por um leigo:** mostrar a página de um parlamentar, a de uma cidade e a capa a alguém que
  não conhece a plataforma. A pessoa diz o que cada número é e de quando é, sem ajuda.
- **Inspeção com `design-taste-frontend/scripts/inspect.mjs`** na capa, no parlamentar, na cidade, na
  votação, na emenda, na obra, numa lista, na conta e nas duas páginas do painel, a 1440, 768 e
  390 px:
  - sem FAIL;
  - nenhum título com mais de duas linhas;
  - nenhum texto abaixo de 13 px;
  - sem rolagem horizontal.
- **Movimento:**
  - com `prefers-reduced-motion: reduce`, nenhuma animação roda e tudo aparece;
  - sem JavaScript, todo o conteúdo está visível.
- **Tour:** o roteiro automático local do tour continua passando no site real. Ele cobre login, nove
  passos, fechar, não reabrir, rever na conta e telefone.
- `pnpm verify` e o CI verdes, incluindo `pnpm build`.
- Nenhuma ocorrência restante de `Capitulo`, `verbo=` ou `data-campo` nos apps.

## O que fica com o builder

- O desenho exato de cada peça, os espaçamentos e as grades, dentro das escolhas acima.
- A ordem das páginas na implementação e como dividir em commits. A sugestão é: tokens e peças em
  `packages/ui`, depois parlamentar, cidade, capa, detalhes, listas, painel e por fim a limpeza.
- Os textos das linhas finas e das explicações, seguindo os textos-base e o tom neutro do site.
- Se as fotos da capa ficam ou saem.
- Como o menu do telefone abre (sem biblioteca; um `<details>` ou um botão simples bastam).
