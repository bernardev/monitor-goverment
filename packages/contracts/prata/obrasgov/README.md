# Prata do Obrasgov.br (v1.0.0)

Obras pagas com emendas parlamentares, da
[API pública de dados abertos do Obrasgov.br](https://api-publica.obrasgov.gestao.gov.br/obras/docs),
o cadastro federal de projetos de investimento (obras e projetos) mantido pelo MGI. Sem chave.

- **Conector:** `prometeu_dados.conectores.obrasgov.ConectorObrasDoObrasGov`
- **Atualização:** semanal, segunda às 6h (horário de Brasília). A coleta leva dezenas de minutos, e a
  execução física de uma obra muda devagar. Toda execução regrava todas as linhas.
- **Evento:** um `LoteIngerido` por tabela, com `fonte = obrasgov`, todos gravados na mesma transação.
- **Consumidor:** Obras, a partir do lote de `obrasgov_projeto`; lê as outras tabelas por obra.

**A ligação com a emenda está no empenho.** Parte dos empenhos de cada obra traz, no campo do autor da
emenda, o código completo da emenda no Portal da Transparência (`202360110003`, às vezes como número
decimal: `202360110003.0`). O conector percorre todos os empenhos, guarda os que trazem código de
emenda de orçamento a partir de 2023 e busca, um a um, só os projetos ligados a eles: o cadastro tem
mais de 150 mil projetos, e cada página dele custa segundos. Execução física, histórico e localização
vêm inteiros, por página, de todas as obras.

A API pagina com no máximo 200 itens. Resposta que não é JSON, sem a lista `data`, com identificador de
projeto, UF, CNPJ, código IBGE, data, valor ou ponto fora do formato faz o conector falhar.

Tabelas:

- [`obrasgov_empenho_de_emenda`](obrasgov_empenho_de_emenda.v1.0.0.md)
- [`obrasgov_projeto`](obrasgov_projeto.v1.0.0.md)
- [`obrasgov_execucao_fisica`](obrasgov_execucao_fisica.v1.0.0.md)
- [`obrasgov_situacao`](obrasgov_situacao.v1.0.0.md)
- [`obrasgov_localizacao`](obrasgov_localizacao.v1.0.0.md)

Valores em reais da fonte (`481104.37`) viram centavos inteiros; mais de duas casas é erro. Datas e
instantes (`2022-08-15T00:00:00`) viram o dia. Todas as tabelas têm as
[colunas de origem](../colunas-de-origem.md).
