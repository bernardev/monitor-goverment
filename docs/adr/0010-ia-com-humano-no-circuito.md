# ADR-0010: IA como assistente, com humano no circuito

- **Status:** Aceito
- **Data:** 2026-10-28

## Contexto

IA acelera tarefas que não escalam manualmente: extrair promessas de planos de governo e transcrições de
debates, sugerir vínculos entre promessas e proposições/ações orçamentárias, resumir projetos de lei em
linguagem simples. Mas erra, e um erro publicado sobre um político é um risco jurídico e de reputação.

## Decisão

- IA **sugere**, pessoa **decide**. Toda saída de IA vira uma `Sugestao` no contexto Editorial, com:
  modelo, versão, hash do prompt, entradas usadas e data. Nada é publicado sem aprovação humana.
- Os provedores ficam atrás de portas da camada de aplicação (`ExtratorDePromessas`, `SugestorDeVinculos`,
  `Resumidor`, `Transcritor`). Trocar de provedor é trocar o adaptador.
- Adaptador inicial de linguagem: **API da Anthropic (Claude)**. Transcrição: modelo de reconhecimento de
  fala com marcação de tempo por segmento.
- Conteúdo gerado por IA e exibido ao público (ex.: resumo de PL) é **rotulado** como tal e sempre linka a fonte.
- Prompts ficam versionados no repositório, com conjunto de avaliação (casos reais anotados) rodando no CI
  quando o prompt muda.

## Alternativas consideradas

- **Publicação automática da IA:** rápida, inaceitável para o nosso risco.
- **Nenhuma IA:** inviável para cobrir milhares de promessas e proposições.

## Consequências

- **Positivas:** escala com controle; auditoria de cada decisão.
- **Negativas:** a capacidade editorial humana vira o gargalo, e é aí que priorizamos o painel de curadoria.
