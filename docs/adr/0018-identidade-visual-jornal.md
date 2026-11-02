# ADR-0018: Identidade visual: jornal de referência

- **Status:** Aceito
- **Data:** 2026-11-02
- **Substitui:** [ADR-0017](0017-identidade-visual.md)

## Contexto

O visual do [ADR-0017](0017-identidade-visual.md) ("Prometeu no pretérito") foi aplicado em todo o
site e no painel, e o dono do produto o achou exagerado: verbos enormes ("Compareceu.", "Votou."),
campos de cor de tela inteira e uma tipografia de que não gostou. Ele quer que a plataforma pareça um
**jornal de referência**, como Estadão e Valor: sério, com cara de notícia e, por isso, com mais
credibilidade.

O objetivo maior é que **uma pessoa leiga entenda a informação**: o que aquele número é, de quando é
e de onde veio. O visual de jornal serve a isso porque é uma forma de ler que todo mundo já conhece.

As duas forças do ADR-0017 continuam de pé e passam a viver aqui:

- **Neutralidade.** A plataforma fiscaliza políticos de todos os partidos; nenhuma cor pode lembrar
  campanha antes de o dado aparecer.
- **Prova.** Todo número vem de um registro oficial capturado (ADR-0009); o visual não pode esconder a
  fonte nem sugerir julgamento onde só existe registro.

## Decisão

**A ideia.** Fundo branco, tinta preta, títulos em serifa, texto sem serifa e fios finos no lugar de
blocos de cor. Uma só cor de destaque, o azul-marinho, nos chapéus, links, números-chave e barras
principais. O nome **Prometeu** fica; os verbos no pretérito como títulos saem.

**Cores.** Tokens em variáveis CSS, em `packages/ui`:

| Uso                        | Cor                   |
| -------------------------- | --------------------- |
| Fundo                      | `#ffffff`             |
| Superfície das caixas      | `#f4f5f7`             |
| Tinta                      | `#111111`             |
| Texto secundário           | `#555555`             |
| Notas e fontes             | `#6b6b6b`             |
| Fio fino / fio forte       | `#e3e3e3` / `#111111` |
| Destaque (azul-marinho)    | `#0b3d6b`             |
| Segunda série dos gráficos | `#9fb3c8`             |
| Valor ausente (contorno)   | `#999999`             |
| Abstenção e sem voto       | `#cccccc`             |

O cinza das notas (`#6b6b6b`) tem 5,3:1 sobre o branco, o que passa em AA para 13 px.

**Tipografia.** Duas famílias, ambas OFL, por `next/font/google` (servidas pelo próprio site):

- **Source Serif 4**, pesos 600 e 700, para títulos, nome da marca e números-chave;
- **Inter**, pesos 400 a 700, para texto, rótulos e menus.

Tamanhos (desktop / telefone até 640 px): título da página 40 / 30 px; título de seção 22 / 20 px;
chamada da capa 30 / 24 px; número-chave 30 / 26 px; texto 17 px; nota e fonte 13 px; chapéu 12 px em
caixa alta com `letter-spacing: 0.07em`. A página tem no máximo 1200 px e os parágrafos 720 px.

**Neutralidade.** Nada de cor de partido, nem vermelho e verde. Nas votações, "sim" é `#0b3d6b`,
"não" é `#9fb3c8` e abstenção e sem voto são `#cccccc`: tonalidade, nunca matiz, e **sempre com o
rótulo escrito** junto da barra. As cores claras ficam abaixo de 3:1 contra o branco; passam porque o
rótulo acompanha toda barra. Nenhum parlamentar identificável aparece em destaque fora da página da
própria pessoa.

**Prova.** Toda seção de dado termina com a **fonte** (componente `Fonte`) e o **período** que o
número cobre. Presença e votos usam o `de`/`ate` que a API devolve. Os totais de emendas e obras, que
a API entrega sem intervalo, usam `INICIO_DA_COBERTURA_DE_EMENDAS = 2023` (a base de emendas começa no
orçamento de 2023) e a data da coleta: "desde o orçamento de 2023, até a coleta de dd/mm/aaaa". Se a
fonte vier sem data de coleta, o texto omite o "até a coleta" e nunca mostra data inválida. As obras
são chamadas de "obras com dinheiro de emenda": os dados são empenhos, e "pagas" afirmaria um
pagamento que a fonte não registra.

**Movimento.** Leve, sem loop, em CSS e um script curto (`Movimento`), sem biblioteca:

- itens entram com opacidade 0→1 e 8 px de subida, em 0,5 s;
- barras crescem da esquerda (`scaleX` 0→1), em 1 s;
- números contam em 0,9 s, uma só vez, quando o bloco entra na tela;
- com `prefers-reduced-motion: reduce` nada roda, e sem JavaScript tudo aparece pronto: o HTML do
  servidor já traz o texto final de cada número.

**Explicações para leigos.** Onde um termo técnico aparece pela primeira vez na página, uma frase
curta ao lado ou numa nota (componente `Explica`, textos em `glossario.ts`): emenda (dinheiro do
orçamento federal que deputados e senadores indicam para estados e cidades), empenhado (reservado no
orçamento para a despesa), pago (já saiu para quem recebe), sessão, falta justificada, votação
nominal, favorecido e situação da obra.

**Implementação.** O sistema continua em `packages/ui`, só de apresentação (regra `ui-so-apresentacao`
do dependency-cruiser): tokens, uma folha de estilo e componentes de servidor. Saem `Capitulo`, `Campo`
e `Cifra`. Entram `Chapeu`, `Secao`, `FaixaDeNumeros`, `Chamada`, `Explica`, `Movimento` e o cabeçalho
com menu que abre no telefone (um `<details>`, sem JavaScript). `Ranking`, `Proporcao`, `Calendario`
e `CadeiaDeEntrega` ficam, no estilo discreto: barras simples, sem grade, sem interação. O painel de
curadoria usa as mesmas peças, com cara de ferramenta. As fotos da capa saem. A decisão não inclui
novos dados ou rotas de API, modo escuro nem gráficos interativos.

## Alternativas consideradas

- **Manter o ADR-0017 e só ajustar:** os problemas eram a escala dos verbos e os campos de tela
  inteira, que são a ideia do ADR-0017; ajustá-los é trocá-lo.
- **Um portal popular, com faixa vermelha e títulos gritados:** passa a imagem oposta à de uma
  plataforma que quer ser lida como referência, e o vermelho colide com a neutralidade.
- **Gráficos interativos (passar o mouse, filtrar):** o dono escolheu o nível discreto; interação
  pede JavaScript e esconde o número exato.
- **Biblioteca de animação ou de componentes:** o movimento cabe em CSS e num script curto, e o menu,
  num `<details>`.

## Consequências

- **Positivas:** um visual que o leitor já sabe ler; cada número diz o que é, de quando é e de onde
  veio; sem JavaScript ou com movimento reduzido, nada fica escondido; as regras de neutralidade e de
  prova ficam num só lugar.
- **Negativas / custos:** a identidade fica mais parecida com a de outros jornais e depende mais da
  qualidade do texto e do dado do que de um traço próprio; o ADR-0017 vira histórico; o roteiro de
  conferência do tour roda só localmente (puppeteer fora do repositório) até o teste de ponta a ponta
  do ADR-0004 existir.
- **O que precisa acontecer a partir de agora:** toda página nova usa `@prometeu/ui`; cores, tamanhos e
  fontes fora dos tokens são recusados em revisão; toda seção de dado termina com fonte e período;
  nenhum título de seção volta ao pretérito; "sim" e "não" nunca em vermelho e verde nem em cor de
  partido; o painel e o site passam pelo inspetor de direção de arte (1440, 768 e 390 px) antes de
  entrar.
