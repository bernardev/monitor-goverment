# Visual de jornal de referência: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou
> superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam caixas
> (`- [ ]`) para acompanhar.

**Objetivo:** trocar a identidade "Prometeu no pretérito" (ADR-0017) por um visual de jornal de
referência no site e no painel, com período e fonte em cada número e explicações para leigos.

**Arquitetura:**

- `packages/ui` ganha os tokens novos, as peças de jornal (Chapéu, Seção, Faixa de números,
  Chamada, Explica), um componente cliente de movimento e os gráficos restilizados. As peças antigas
  (`Capitulo`, `Campo`, `Cifra`) saem.
- Cada página dos dois apps migra para as peças novas, uma tarefa por grupo de páginas.
- Tudo acontece no branch `feat/visual-jornal` e só entra na `main` no fim.

**Tecnologia:** Next.js 16 (App Router), React 19, CSS puro em `packages/ui/src/estilos.css`,
`next/font/google`, Vitest.

**Especificação:** [`docs/superpowers/specs/2026-11-02-visual-jornal-design.md`](../specs/2026-11-02-visual-jornal-design.md).
Leia antes de qualquer tarefa. Os esboços aprovados estão em
`.superpowers/brainstorm/1559-1793585900/content/`, fora do Git; a referência é
`parlamentar-v2.html`.

## Restrições globais

- **Sem dependências novas.** Fontes por `next/font/google`, animação em CSS e um script curto.
- **Fontes:**
  - títulos: Source Serif 4, pesos 600 e 700, variável CSS `--fonte-titulo`;
  - texto: Inter, pesos 400, 500, 600 e 700, variável CSS `--fonte-texto`.
- **Cores (tokens em `:root`):**
  - `--branco: #ffffff`, `--superficie: #f4f5f7`;
  - `--tinta: #111111`, `--tinta-2: #555555`, `--nota: #6b6b6b`;
  - `--fio: #e3e3e3`, `--fio-forte: #111111`;
  - `--azul: #0b3d6b`, `--azul-claro: #9fb3c8`, `--cinza-claro: #cccccc`, `--contorno: #999999`.
- **Tamanhos (desktop / ≤640 px):**
  - título da página: 40 / 30 px;
  - título de seção: 22 / 20 px;
  - chamada manchete: 30 / 24 px;
  - número-chave: 30 / 26 px;
  - texto: 17 px; nota e fonte: 13 px;
  - chapéu: 12 px, caixa alta, `letter-spacing: 0.07em`.
- **Largura:** página com até 1200 px; parágrafos com até 720 px.
- **Movimento:**
  - entrada com opacidade 0→1 e 8 px de subida, em 0,5 s;
  - barras com `scaleX` 0→1, em 1 s;
  - números contam em 0,9 s, uma vez, ao entrar na tela;
  - nada roda com `prefers-reduced-motion: reduce`, e sem JavaScript tudo aparece pronto.
- **Neutralidade:**
  - votos: sim `--azul`, não `--azul-claro`, abstenção e sem voto `--cinza-claro`;
  - sempre com o rótulo escrito; nunca vermelho e verde nem cor de partido.
- **Prova:** toda seção de dado termina com a fonte (componente `Fonte` de
  `apps/web/app/_componentes/fonte.tsx`) e o período.
- **Período das emendas:** `INICIO_DA_COBERTURA_DE_EMENDAS = 2023`. O texto é "desde o orçamento de
  2023, até a coleta de dd/mm/aaaa".
- **Sem verbos:** nenhum título de seção no pretérito ("Votou.", "Compareceu."). O nome **Prometeu**
  fica.
- `packages/ui` continua só de apresentação: a regra `ui-so-apresentacao` do dependency-cruiser segue
  passando.
- **Commits:**
  - em pt-BR, no padrão Conventional Commits;
  - autor e committer `bernardev <ebernardes.dev@gmail.com>`, por `GIT_AUTHOR_*` e
    `GIT_COMMITTER_*`;
  - sem linhas de coautoria;
  - `git add` com caminhos explícitos (nunca `.superpowers/`, `CLAUDE.md` nem `.claude/`).
- **Ambiente:**
  - antes de qualquer comando `pnpm`, rodar `. /c/Users/Pichau/AppData/Local/Temp/pf/env.sh`;
  - Docker, API (:3000), site (:3001) e painel (:3002) rodando, para as conferências no navegador;
  - para ver uma mudança no site, `pnpm --filter @prometeu/web build` e reiniciar o `next start`.

## Foco da revisão

1. **Sem JavaScript, número com contagem** mostra o valor final, porque o HTML do servidor já traz o
   texto pronto. Teste: `textoDaContagem(c, 1)` é igual ao texto renderizado (tarefa 2).
2. **`prefers-reduced-motion: reduce`:** nenhum número conta, nenhuma barra cresce, nada fica
   invisível. Conferência no navegador com a emulação de movimento reduzido (tarefas 2 e 10).
3. **Parlamentar, cidade ou emenda sem dado** (sem frequência, sem emendas, sem obra): a faixa mostra
   "—" com o rótulo e o período, sem contagem e sem quebrar o layout. Teste em
   `numerosDoParlamentar` (tarefa 3) e conferência numa cidade sem obras (tarefa 4).
4. **Fonte sem data de coleta** (`coletadaEm: null`): o período das emendas omite "até a coleta de" e
   não mostra "Invalid Date". Teste em `periodoDasEmendas` (tarefa 3).
5. **Telefone a 390 px:**
   - o menu abre e fecha sem JavaScript;
   - nenhum título passa de duas linhas;
   - nenhuma rolagem horizontal;
   - o tour diz "abra o menu" nos passos da navegação.

   Conferência com `inspect.mjs` e com o roteiro do tour (tarefas 8 e 10).

---

### Tarefa 1: tokens, fontes e base

**Arquivos:**

- Modificar: `packages/ui/src/estilos.css`
  - reescrever a seção de tokens e a base (corpo, títulos, links, `.botao`, `.botao--secundario`,
    `.botao--texto`, formulários, `.nota`, `.oculto`, foco visível);
  - remover os tokens de campo (`--papel`, `--areia` etc.) e as regras `[data-campo]`;
  - manter, por ora, as regras de componentes que as páginas ainda usam (as tarefas seguintes trocam).
- Modificar: `apps/web/app/layout.tsx` e `apps/curadoria/app/layout.tsx`
  - trocar `Schibsted_Grotesk` por `Source_Serif_4` (variável `--fonte-titulo`) e `Inter` (variável
    `--fonte-texto`), as duas no `className` do `<html>`;
  - tirar `data-campo` do `<body>`.

**Interfaces:**

- Produz:
  - tokens CSS da seção Restrições globais;
  - `--fonte-titulo` e `--fonte-texto`;
  - os seletores base `.botao`, `.botao--secundario`, `.botao--texto`, `.nota` e `.oculto`, com os
    mesmos nomes de hoje.

- [ ] **Passo 1:** Escrever os tokens e a base no topo de `estilos.css`.
  - `body`: fundo `--branco`, cor `--tinta`, fonte `--fonte-texto` a 17 px.
  - `h1` e `h2`: `--fonte-titulo`.
  - links: azul sublinhado.
  - `.botao`: fundo `--azul`, texto branco, raio 4 px.
  - `:focus-visible`: contorno de 3 px em `--azul`.
- [ ] **Passo 2:** Trocar as fontes nos dois layouts e tirar `data-campo` do `<body>`.
- [ ] **Passo 3:** Rodar `pnpm --filter @prometeu/web build` e `pnpm --filter @prometeu/curadoria build`.
      O esperado é sucesso.
- [ ] **Passo 4:** Commit `feat(ui): tokens e fontes do visual de jornal`.

### Tarefa 2: peças de jornal e movimento em `packages/ui`

**Arquivos:**

- Criar: `packages/ui/src/jornal.tsx` (Chapeu, Secao, FaixaDeNumeros, Chamada, Explica)
- Criar: `packages/ui/src/movimento.tsx` (`'use client'`; Movimento)
- Modificar: `packages/ui/src/medidas.ts` (textoDaContagem, atributosDaContagem) e
  `packages/ui/src/medidas.test.ts`
- Modificar: `packages/ui/src/cabecalho.tsx` (sem troca de cor; menu do telefone em `<details>`)
- Modificar: `packages/ui/src/graficos.tsx` (Calendario com legenda estruturada; Proporcao, Ranking e
  CadeiaDeEntrega no estilo "Discreto" com `data-surge`)
- Modificar: `packages/ui/src/index.ts` e `estilos.css` (estilos das peças)
- Modificar: `apps/web/app/layout.tsx` e `apps/curadoria/app/layout.tsx` (nova assinatura do `Cabecalho`, `<Movimento />`, rodapé)

**Interfaces:**

- Produz (exportado de `@prometeu/ui`):
  - `Chapeu({ children }: { children: ReactNode }): ReactNode` → `<p className="chapeu">`
  - `Secao({ id, titulo, periodo, fonte, children }: { id: string; titulo: string; periodo?: string; fonte?: ReactNode; children: ReactNode }): ReactNode`
    → `<section aria-labelledby>`, com `h2.secao__titulo`, `span.secao__periodo` à direita e
    `div.secao__fonte` no fim.
  - `interface Contagem { alvo: number; casas?: number; prefixo?: string; sufixo?: string }`
  - `interface NumeroChave { valor: string; rotulo: string; periodo: string; contagem?: Contagem }`
  - `FaixaDeNumeros({ itens }: { itens: readonly NumeroChave[] }): ReactNode`
    - de 2 a 4 itens;
    - cada valor sai como `<span {...atributosDaContagem(contagem)}>{valor}</span>`.
  - `Chamada({ chapeu, titulo, href, linhaFina, fonte, tamanho }: { chapeu: string; titulo: string; href: string; linhaFina?: ReactNode; fonte?: ReactNode; tamanho: 'manchete' | 'secundaria' | 'lista' }): ReactNode`
  - `Explica({ termo, children }: { termo: string; children: ReactNode }): ReactNode`
    → `<p className="explica"><strong>{termo}:</strong> {children}</p>`
  - `Movimento(): ReactNode`
    - componente cliente, montado uma vez em cada layout, e não renderiza nada visível;
    - observa `[data-surge]` (marca `data-visivel="1"` ao entrar na tela) e `[data-conta]` (conta de
      0 ao alvo com `textoDaContagem`);
    - não faz nada se `matchMedia('(prefers-reduced-motion: reduce)').matches`.
  - `textoDaContagem(c: Contagem, fracao: number): string`: valor em pt-BR com `casas` decimais
    (padrão 0), entre prefixo e sufixo, para `alvo * fracao`.
  - `atributosDaContagem(c?: Contagem): Record<string, string>`: `{}` sem contagem; senão,
    `data-conta`, `data-casas`, `data-prefixo` e `data-sufixo`.
  - `Calendario({ dias, rotulo, legenda }: { dias: readonly DiaMarcado<Marca>[]; rotulo: string; legenda: readonly Marca[] })`
    - a legenda vira amostras com texto (`Marca.descricao`), sempre visível;
    - o tipo `Tom` continua `'forte' | 'medio' | 'fraco' | 'vazio'`, mapeado no CSS: forte = azul,
      medio = azul-claro, fraco = cinza-claro, vazio = branco com contorno.
  - `Cabecalho({ marca, navegacao, acoes }: { marca: ReactNode; navegacao: ReactNode; acoes?: ReactNode }): ReactNode`
    - no desktop: a marca em serifa, `navegacao` entre fio fino e fio duplo, e `acoes` à direita;
    - abaixo de 640 px: a `navegacao` fica dentro de `<details className="cabecalho__menu">` com
      `<summary>Menu</summary>`, que abre sem JavaScript;
    - os `data-tour` dos links continuam nos layouts.
- O CSS do movimento só esconde `[data-surge]` dentro de `html.movimento` (classe que o `Movimento`
  põe no `<html>`). Sem JavaScript, nada se esconde.

- [ ] **Passo 1: escrever os testes que falham** em `medidas.test.ts`

```ts
describe('textoDaContagem', () => {
  it('no fim da contagem mostra o valor final formatado', () => {
    expect(textoDaContagem({ alvo: 73.3, casas: 1, prefixo: 'R$ ', sufixo: ' milhões' }, 1)).toBe(
      'R$ 73,3 milhões',
    );
    expect(textoDaContagem({ alvo: 25131 }, 1)).toBe('25.131');
  });
  it('no começo mostra zero e no meio arredonda', () => {
    expect(textoDaContagem({ alvo: 81, sufixo: '%' }, 0)).toBe('0%');
    expect(textoDaContagem({ alvo: 12 }, 0.5)).toBe('6');
  });
});
describe('atributosDaContagem', () => {
  it('sem contagem não marca nada', () => {
    expect(atributosDaContagem(undefined)).toEqual({});
  });
  it('com contagem leva o alvo e o formato', () => {
    expect(atributosDaContagem({ alvo: 5, sufixo: ' de 12' })).toEqual({
      'data-conta': '5',
      'data-casas': '0',
      'data-prefixo': '',
      'data-sufixo': ' de 12',
    });
  });
});
```

- [ ] **Passo 2:** Rodar `pnpm --filter @prometeu/ui test`. O esperado é FALHA, porque as funções
      ainda não existem.
- [ ] **Passo 3:** Implementar `textoDaContagem` e `atributosDaContagem` em `medidas.ts`, com
      `Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })`.
- [ ] **Passo 4:** Rodar `pnpm --filter @prometeu/ui test`. O esperado é PASSA.
- [ ] **Passo 5:** Escrever `jornal.tsx`, `movimento.tsx`, o novo `Cabecalho`, os gráficos
      restilizados e o CSS das peças.
  - Pôr `data-surge` em Secao, FaixaDeNumeros, Chamada e nas barras.
  - As barras crescem com `transform: scaleX` no CSS sob `html.movimento [data-surge]:not([data-visivel])`.
- [ ] **Passo 6:** Atualizar quem chama as peças que mudaram de assinatura.
  - `Calendario`, que hoje recebe `legenda` como ReactNode: basta um ajuste para compilar, porque a
    página dele muda na tarefa 3.
  - `Cabecalho`: nos dois layouts, passar `marca`, `navegacao` e `acoes`, e montar `<Movimento />`.
  - O rodapé do site (`.rodape`, em `apps/web/app/layout.tsx`) ganha o visual novo: fio forte em
    cima, marca em serifa, colunas de links e a frase de método. O fundo grafite de tela inteira sai.
- [ ] **Passo 7:** Rodar `pnpm verify`. O esperado é verde.
- [ ] **Passo 8:** Commit `feat(ui): peças de jornal, movimento e gráficos discretos`.

### Tarefa 3: página do parlamentar

**Arquivos:**

- Modificar: `apps/web/app/parlamentares/[pessoaId]/page.tsx` e `capitulos.tsx` (renomear para
  `secoes.tsx`; os componentes passam a usar `Secao`)
- Modificar: `apps/web/app/_componentes/formatacao.ts` e `formatacao.test.ts`
- Criar: `apps/web/app/_componentes/glossario.ts`

**Interfaces:**

- Consome: `Secao`, `FaixaDeNumeros`, `NumeroChave`, `Chapeu`, `Explica`, `Calendario` (da tarefa 2)
  e `Fonte`.
- Produz:
  - `INICIO_DA_COBERTURA_DE_EMENDAS = 2023`, em `formatacao.ts`;
  - `periodoDasEmendas(coletadaEm: string | null): string`, em `formatacao.ts`;
  - `GLOSSARIO: Readonly<Record<'emenda' | 'empenhado' | 'pago' | 'sessao' | 'faltaJustificada' | 'votacaoNominal' | 'favorecido' | 'situacaoDaObra', string>>`
    em `glossario.ts`, com os textos-base da especificação, palavra por palavra;
  - `numerosDoParlamentar(dados: { frequencia?: FrequenciaDoParlamentar; emendas?: EmendasDoParlamentar }): NumeroChave[]`
    em `secoes.tsx`, para a faixa.

- [ ] **Passo 1: escrever os testes que falham** em `formatacao.test.ts`

```ts
describe('periodoDasEmendas', () => {
  it('diz desde quando e até a coleta', () => {
    expect(periodoDasEmendas('2026-10-30T19:46:00Z')).toBe(
      'desde o orçamento de 2023, até a coleta de 30/10/2026',
    );
  });
  it('sem data de coleta, diz só desde quando', () => {
    expect(periodoDasEmendas(null)).toBe('desde o orçamento de 2023');
  });
});
```

E em `secoes.test.ts` (novo, ao lado de `secoes.tsx`):

```ts
it('sem frequência e sem emendas, a faixa mostra traço, sem contagem', () => {
  const itens = numerosDoParlamentar({});
  expect(itens.every((n) => n.valor === '—' && n.contagem === undefined)).toBe(true);
  expect(itens.every((n) => n.periodo.length > 0)).toBe(true);
});
it('com dados, os quatro números da referência', () => {
  // frequencia: 5 presenças em 12 dias com sessão, 6 justificadas, 1 sem; período 2026-08-04 a 2026-11-01
  // emendas: 37, empenhado 10_890_000_000 centavos, pago 8_860_000_000 centavos
  expect(numerosDoParlamentar(dadosDeExemplo).map((n) => n.valor)).toEqual([
    '5 de 12',
    '6',
    '37',
    '81%',
  ]);
});
```

- [ ] **Passo 2:** Rodar `pnpm --filter @prometeu/web test`. O esperado é FALHA.
- [ ] **Passo 3:** Implementar `INICIO_DA_COBERTURA_DE_EMENDAS`, `periodoDasEmendas`, `GLOSSARIO` e
      `numerosDoParlamentar`.
  - **Rótulos e períodos:** os de `parlamentar-v2.html`.
  - **Presença:** "dias de sessão em que esteve presente".
  - **Faltas:** "faltas justificadas (e N sem justificativa)".
  - **Emendas:** "emendas indicadas, R$ X".
  - **Percentual:** "do valor das emendas já pago".
- [ ] **Passo 4:** Rodar `pnpm --filter @prometeu/web test`. O esperado é PASSA.
- [ ] **Passo 5:** Refazer a página.
  - **Cabeçalho:** foto, `Chapeu` com o cargo, `h1` com o nome, partido-UF e `Acompanhar`.
  - Logo abaixo, a `FaixaDeNumeros`.
  - **Seções:** "Promessas", "Presença nas sessões", "Votações", "Projetos apresentados", "Emendas" e
    "Obras pagas com as emendas", cada uma com período e `Fonte`.
  - `Explica` na primeira ocorrência de emenda, empenhado, sessão e falta justificada.
  - O sumário do topo aponta para os `id` das seções.
- [ ] **Passo 6:** Conferir no site real.
  - Fazer o build e reiniciar o site.
  - Rodar `node ~/.claude/skills/design-taste-frontend/scripts/inspect.mjs http://localhost:3001/parlamentares/01a18ca8-1076-78bd-90db-b9bd7be7ac76`.
  - O esperado é nenhum FAIL e nenhum título com mais de duas linhas, a 1440, 768 e 390 px.
  - Ler as capturas.
- [ ] **Passo 7:** Rodar `pnpm verify`. O esperado é verde.
- [ ] **Passo 8:** Commit `feat(web): página do parlamentar como reportagem`.

### Tarefa 4: página da cidade

**Arquivos:**

- Modificar: `apps/web/app/municipios/[codigoIbge]/page.tsx`

**Interfaces:**

- Consome: as peças da tarefa 2, mais `periodoDasEmendas`, `GLOSSARIO` e `Fonte`.

- [ ] **Passo 1:** Refazer a página.
  - **Cabeçalho:** nome, UF e Acompanhar.
  - **Faixa:** pago, empenhado, número de emendas e número de obras, com o período de
    `periodoDasEmendas` da fonte das emendas.
  - **Seções:**
    - "Quem mandou o dinheiro" (Ranking);
    - "Obras pagas com emendas" (Proporcao e lista);
    - "Quem representa a cidade no Congresso";
    - as listas completas.
- [ ] **Passo 2:** Conferir, com `inspect.mjs`, Porto Alegre (`/municipios/4314902`) e uma cidade sem
      obras.
  - Para achar a cidade sem obras, rodar `docker exec prometeu-postgres-1 psql -U prometeu_admin -d prometeu -At -c "select codigo_ibge from consulta.municipio m where not exists (select 1 from consulta.obra o where m.codigo_ibge = any(o.municipios::text[])) limit 1"`.
  - O esperado é que a faixa mostre "0" ou "—", sem barra quebrada.
- [ ] **Passo 3:** Rodar `pnpm verify` e fazer o commit `feat(web): página da cidade como reportagem`.

### Tarefa 5: capa

**Arquivos:**

- Modificar: `apps/web/app/page.tsx`

**Interfaces:**

- Consome:
  - `Chamada`, `Chapeu`, `Secao` e `FaixaDeNumeros`;
  - do cliente da API: `listarVotacoes`, `listarObras({ situacao: 'paralisada' })`, `buscarObra`,
    `listarEmendas` e as contagens que a capa já busca hoje.

- [ ] **Passo 1:** Refazer a capa como primeira página.
  - **Topo:** data do dia por extenso.
  - **Manchete:** a votação mais recente, com o placar pelo `partesDoPlacar` e a chamada "veja como
    votou cada deputado".
  - **Secundária:** a maior obra paralisada com o motivo, o primeiro item de `interrupcoes` em
    `buscarObra`.
  - **Chamada de presença:** só texto.
  - **Coluna:** busca da cidade, Porto Alegre como exemplo e os totais com período.
  - **No fim:** "Por onde começar".
  - As fotos ficam ou saem; é escolha do builder, sem rosto em destaque.
- [ ] **Passo 2:** Conferir, com `inspect.mjs`, `http://localhost:3001/`. O esperado é nenhum FAIL a
      1440, 768 e 390 px.
- [ ] **Passo 3:** Rodar `pnpm verify` e fazer o commit `feat(web): capa como primeira página de jornal`.

### Tarefa 6: votação, proposição, emenda e obra

**Arquivos:**

- Modificar: `apps/web/app/votacoes/[votacaoId]/page.tsx`, `proposicoes/[proposicaoId]/page.tsx`,
  `emendas/[emendaId]/page.tsx`, `obras/[obraId]/page.tsx`
- Modificar: `apps/web/app/_componentes/topo.tsx` (cabeçalho de reportagem com `Chapeu`, `h1` e
  linha fina, no lugar do retrato de hoje), `placar.tsx` (tons da especificação),
  `favorecidos.tsx`, `emendas.tsx` e `obras.tsx`

- [ ] **Passo 1:** Refazer as quatro páginas com as seções de cada uma.
  - **Votação:** "Placar", "Como votou cada um" e "Quem não votou".
  - **Emenda:** "Quanto foi reservado e pago", "Para onde foi", "Quem recebeu" e "Virou obra".
  - **Obra:** "Andamento", "Paradas, se houve" e "Quanto foi pago".
  - **Proposição:** "Situação" e "Tramitação".
  - Usar `Explica` para votação nominal, favorecido e situação da obra.
- [ ] **Passo 2:** Conferir com `inspect.mjs` estas páginas:
  - `/votacoes/01a192ad-cd35-7772-9b9d-d8f2de5f0127`;
  - `/emendas/01a18f04-7044-702b-b4cb-9bf5a970a62e`;
  - `/obras/01a1925e-6548-7061-ab96-c696d1292288`;
  - uma proposição da lista.

  O esperado é nenhum FAIL.

- [ ] **Passo 3:** Rodar `pnpm verify` e fazer o commit `feat(web): páginas de detalhe como reportagem`.

### Tarefa 7: listas, busca, fontes, 404 e erro

**Arquivos:**

- Modificar: `apps/web/app/_componentes/pagina-de-lista.tsx`
  - `PaginaDeLista` perde a prop `campo` e vira cabeçalho de editoria: `Chapeu`, `h1` com serifa,
    descrição e filtros em linha.
  - Contagem e lista com fios, e a `Paginacao` restilizada.
- Modificar:
  - as páginas de lista: `parlamentares/page.tsx`, `votacoes/page.tsx`, `proposicoes/page.tsx`,
    `emendas/page.tsx`, `obras/page.tsx`, `municipios/page.tsx`;
  - `busca/page.tsx` e `fontes/page.tsx`;
  - `not-found.tsx` e `error.tsx`, com uma mensagem curta, sem verbo gigante.

- [ ] **Passo 1:** Refazer `PaginaDeLista` e tirar `campo=` de todos os chamadores (`grep -rn "campo=" apps/web/app`).
- [ ] **Passo 2:** Refazer 404 e erro.
  - Título "Não achamos esta página" com a busca.
  - Título "Não conseguimos carregar esta página" com o botão de tentar de novo.
- [ ] **Passo 3:** Conferir, com `inspect.mjs`, `/parlamentares`, `/emendas?ano=2025`, `/busca?q=porto` e
      `/nao-existe`. O esperado é nenhum FAIL.
- [ ] **Passo 4:** Rodar `pnpm verify` e fazer o commit `feat(web): listas, busca e avisos no visual de jornal`.

### Tarefa 8: Minha conta e tour

**Arquivos:**

- Modificar: `apps/web/app/conta/page.tsx` (seções com `Secao`)
- Modificar: `apps/web/app/_componentes/tour.tsx` (texto do telefone)
- Modificar: `estilos.css` (cartão do tour em branco com fio; contorno do foco em `--azul`)

- [ ] **Passo 1:** Ajustar a conta e o estilo do tour.
  - Na `tour.tsx`, a nota do telefone passa a ser "No telefone, abra o menu ☰ para chegar aqui." O
    gatilho continua o mesmo: passo com `alvo` e item escondido.
- [ ] **Passo 2:** Rodar o roteiro local do tour.
  - Comando: `node "C:/Users/Pichau/AppData/Local/Temp/claude/C--Users-Pichau-AppData-Roaming-Claude-scratch-workspaces-812f6190-1825-4ff1-9281-825788624371-0b2e52d4-4032-4588-be79-24f6cb96b53f-scratch-2026-10-28-6595f6/b526544f-6ab8-4030-a3ff-d79e4cf0ab81/scratchpad/tour-e2e.mjs" <pasta-de-saida>`, com o site reconstruído.
  - O esperado é 20 linhas OK e nenhuma FALHA.
  - Se o roteiro não estiver mais lá, conferir à mão: login de cidadã, os nove passos, Esc, não
    reabrir e "Ver o tour de novo", no computador e a 390 px.
- [ ] **Passo 3:** Rodar `pnpm verify` e fazer o commit `feat(web): conta e tour no visual de jornal`.

### Tarefa 9: painel da curadoria

**Arquivos:**

- Modificar: `apps/curadoria/app/page.tsx`, `promessas/[promessaId]/page.tsx`,
  `promessas/nova/page.tsx`, `_componentes/formularios.tsx` e `globais.css`

**Interfaces:**

- Consome: `Secao`, `Chapeu`, `CadeiaDeEntrega` e `Movimento` (montado no layout da curadoria, sem
  números contando).

- [ ] **Passo 1:** Montar a lista de promessas como tabela com fios e a página da promessa com
      `Secao`: "Fontes", "Vínculos com fatos", "Fatos do autor que podem comprovar a promessa", "Fatos que
      mudaram", "Histórico de vereditos" e "Propor veredito". Os formulários ganham borda fina e o botão
      principal azul.
- [ ] **Passo 2:** Conferir com `inspect.mjs`, pelo proxy com cookie.
  - Para logar, rodar `LOGIN=curadora:desenvolvimento node .../scratchpad/captura.mjs <saida> painel=http://localhost:3002/ promessa=http://localhost:3002/promessas/<id>`.
  - Ler as capturas. O esperado é tudo legível, sem sobreposição.
- [ ] **Passo 3:** Rodar `pnpm verify` e fazer o commit `feat(curadoria): painel no visual de jornal`.

### Tarefa 10: limpeza, ADR e entrega

**Arquivos:**

- Apagar: `packages/ui/src/capitulo.tsx`; tirar de `index.ts` `Capitulo`, `Campo` e `Cifra`.
- Modificar: `estilos.css`, removendo todas as regras que nenhuma página usa mais (`.capitulo`,
  `.verbo`, `.cifra`, `[data-campo]`, `.retrato`, `.tela-numero`, `.mosaico`, `.surge` antigo etc.).
- Criar: `docs/adr/0018-identidade-visual-jornal.md` (decisão, cores, tipografia, neutralidade,
  prova, movimento e explicações para leigos, a partir da especificação).
- Modificar:
  - `docs/adr/0017-identidade-visual.md`: o status vira "Substituído por ADR-0018";
  - `docs/adr/README.md`: incluir o 0018;
  - `docs/roadmap.md`: uma nota em "Antes da etapa 6: identidade visual";
  - `packages/ui/package.json`: a descrição passa a apontar para o ADR-0018.

- [ ] **Passo 1:** Remover as peças e o CSS antigos e criar e atualizar os ADRs e o roadmap.
- [ ] **Passo 2:** Procurar restos com `grep -rnE "Capitulo|verbo=|data-campo|Schibsted|<Cifra" apps packages --include=*.ts --include=*.tsx --include=*.css`.
      O esperado é nenhuma linha.
- [ ] **Passo 3:** Conferência final.
  - `pnpm verify` e `pnpm build` verdes.
  - `inspect.mjs` sem FAIL na capa, no parlamentar, na cidade, na votação, na emenda, na obra, em
    `/parlamentares`, em `/conta` e nas duas páginas do painel.
  - O roteiro do tour com 20 OK.
  - No navegador, com movimento reduzido (DevTools → Rendering → `prefers-reduced-motion: reduce`):
    nenhum número conta e tudo aparece.
  - Com o JavaScript desligado, a capa e o parlamentar mostram todos os números finais.
- [ ] **Passo 4:** Commit `feat(ui): remove o visual antigo e registra o ADR-0018`.
- [ ] **Passo 5:** Entregar.
  - Fazer o push do branch.
  - Fazer o merge fast-forward em `main` e o push da `main`.
  - Acompanhar o CI do commit com `curl -s -A prometeu "https://api.github.com/repos/bernardev/monitor-goverment/actions/runs?head_sha=<sha>"`.
    O esperado é `completed success`.
