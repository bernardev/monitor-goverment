# ADR-0009: Proveniência obrigatória: toda informação aponta para uma captura

- **Status:** Aceito
- **Data:** 2026-10-28

## Contexto

O produto expõe fatos sobre agentes públicos. Credibilidade e segurança jurídica (difamação, direito de
resposta) dependem de provar, a qualquer momento, de onde veio cada informação, mesmo que a fonte original
seja apagada ou alterada (posts apagados, páginas que mudam).

## Decisão

- Todo fato publicado (promessa, vínculo, veredito, ausência, emenda, obra) referencia ao menos uma
  **Captura** do contexto Acervo: cópia imutável com URL, data/hora, hash SHA-256 e, quando aplicável,
  localização interna (página, intervalo de tempo do vídeo, seletor HTML).
- Capturas de páginas web também são enviadas a um arquivo público (Internet Archive) quando possível,
  para verificação independente.
- Vídeos de debates: guardamos o vídeo (ou a referência ao original), a **transcrição segmentada com tempo**
  e o hash do arquivo. A promessa aponta para o segmento exato.
- A interface sempre mostra "Fonte" com link para o original e para a captura.
- Capturas nunca são apagadas, exceto por ordem judicial, registrada como evento auditável.

## Consequências

- **Positivas:** cada afirmação é verificável; defesa jurídica sólida; diferencial de confiança.
- **Negativas:** custo de armazenamento (aceitável; armazenamento de objetos é barato) e cuidado com
  direitos autorais de vídeos (guardar trechos ou referências quando necessário).
