# ADR-0016: Capturas registradas pelo Acervo durante a importação

- **Status:** Aceito
- **Data:** 2026-10-30

## Contexto

O [ADR-0009](0009-proveniencia-obrigatoria.md) exige que todo fato aponte para uma `Captura` do Acervo. A
plataforma de dados guarda a resposta bruta no bronze, endereçada pelo hash SHA-256, mas não conhece o
domínio. Quem importa um fato da prata precisa do `CapturaId` antes de gravar o agregado.

## Decisão

- Toda linha prata carrega a origem: fonte, URL, data da coleta, hash e caminho no bronze da resposta que a
  produziu.
- O importador do contexto dono do fato pede ao Acervo, **de forma síncrona e pela API pública do módulo**
  (serviço de host aberto, como prevê o mapa de contextos), o registro da captura. O registro é
  **idempotente pelo hash**: a mesma resposta bruta devolve sempre o mesmo `CapturaId`.
- O Acervo grava a captura no próprio schema e publica `CapturaRegistrada`. Consulta projeta as capturas
  para exibir a fonte de cada dado.
- As duas gravações (captura e fato) acontecem em transações separadas. A idempotência pelo hash torna a
  repetição segura se a segunda falhar.

## Alternativas consideradas

- **Acervo importa capturas por evento e os demais esperam:** dependência de ordem entre consumidores e
  repetições até a captura existir.
- **Usar o hash como identificador da captura em todos os contextos:** dispensaria a chamada, mas trocaria o
  padrão de identificadores (UUIDv7) e amarraria os contextos ao formato do bronze.

## Consequências

- **Positivas:** o fato já nasce com proveniência; um único dono para capturas.
- **Negativas / custos:** chamada síncrona entre módulos no caminho da importação; se o Acervo virar serviço
  separado, a chamada vira rede.
