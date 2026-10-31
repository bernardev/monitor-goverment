# ADR-0017: Identidade visual: Prometeu no pretérito

- **Status:** Aceito
- **Data:** 2026-10-31

## Contexto

O site e o painel nasceram com HTML semântico e quase nenhum estilo, de propósito: o domínio vinha
antes. Com as etapas 1 a 5 prontas, a parte pública (etapa 6) precisa de uma cara antes de crescer, ou
cada página nova seria refeita depois. Duas forças pesam mais do que o gosto:

- **Neutralidade.** A plataforma fiscaliza políticos de todos os partidos. Verde e amarelo, vermelho,
  azul de partido, qualquer cor que lembre campanha compromete a leitura antes de o dado aparecer.
- **Prova.** Todo número vem de um registro oficial capturado (ADR-0009). O visual não pode sugerir
  julgamento onde só existe registro, nem esconder a fonte.

Foram desenhadas três direções sobre a página real de um deputado (o santinho pelo avesso, os verbos
no pretérito e a súmula de partida). A escolhida foi a dos verbos.

## Decisão

**A ideia.** O nome da plataforma é um verbo: Prometeu. A página de um político se lê como frases no
pretérito, uma por capítulo: _Prometeu. Propôs. Compareceu. Votou. Indicou. Financiou._ Cada verbo é
um fato registrado, nunca uma nota.

**Capítulos de cor.** Cada assunto ocupa a largura inteira com uma cor plana, e a cor significa o
assunto em todo o site:

| Campo   | Cor       | Assunto                               |
| ------- | --------- | ------------------------------------- |
| Papel   | `#ECE8DF` | Fundo; presença no plenário; obras    |
| Grafite | `#1B1B1B` | Promessas; rodapé                     |
| Aço     | `#CBD8DE` | Votos e proposições                   |
| Areia   | `#E4D5B7` | Dinheiro: emendas, empenho, pagamento |

A tinta é o grafite sobre os campos claros e o papel sobre o grafite. Não há verde e amarelo, nem
vermelho, nem cor de partido; "sim" e "não" se distinguem por claridade e por texto, nunca por
vermelho e verde.

**Tipografia.** Uma família, Schibsted Grotesk (licença OFL), em dois pesos de trabalho: 900 para os
verbos e números grandes, 400 e 500 para o texto. Cinco tamanhos: verbo, título, destaque, texto
(18 px) e nota (16 px). Números tabulares onde alinham.

**Regras da casa.** Títulos em até duas linhas; sem gradiente, sem sombra em repouso, sem fios
decorativos (só em tabelas), sem rótulos minúsculos em caixa alta, sem emoji. Toda seção de fatos
termina com a fonte.

**Implementação.** O sistema mora em `packages/ui`: tokens como variáveis CSS, uma folha de estilo e
componentes React de servidor (capítulo, cifra, proporção, calendário, cadeia de entrega). Fica sem
Tailwind por enquanto: com uma família, quatro campos e meia dúzia de componentes, variáveis CSS e
classes do próprio pacote bastam e não exigem etapa de build. Radix entra quando houver o primeiro
componente interativo que precise dele (menu, diálogo). Isso substitui a linha "UI" do ADR-0004.

## Alternativas consideradas

- **O santinho pelo avesso** (a frente é o santinho de campanha, o verso traz o mandato): sóbria e
  boa para tabelas, mas o santinho é um objeto da campanha, e a plataforma acompanha o mandato inteiro.
- **A súmula do mandato** (placar de LEDs, lance a lance): a mais chamativa, mas o tom de jogo
  trivializa a fiscalização e convida a ler o mandato como vitória ou derrota.
- **Tailwind desde já, como previa o ADR-0004:** mais uma etapa de build e uma linguagem de classes
  para um sistema que hoje cabe em uma folha de estilo. Pode voltar se o sistema crescer.

## Consequências

- **Positivas:** uma identidade que nenhum concorrente pode copiar sem copiar o nome; a cor ensina o
  assunto antes do texto; o pacote serve o site e, depois, o painel.
- **Negativas / custos:** capítulos de tela cheia alongam a página; listas densas (votações, emendas)
  pedem a disciplina de tabela dentro dos capítulos, não capítulos para cada item.
- **O que precisa acontecer a partir de agora:** toda página nova do site usa `@prometeu/ui`; cores e
  tamanhos fora dos tokens são recusados em revisão; o painel de curadoria migra depois do site.
