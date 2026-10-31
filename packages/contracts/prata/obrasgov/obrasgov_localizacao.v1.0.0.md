# `ingestao.obrasgov_localizacao` v1.0.0

Os municípios onde cada obra fica. Fonte: `/geometria`, todas as páginas. Ver o [README](README.md) da
fonte.

- **Chave natural:** `(id_geometria, codigo_municipio_ibge)`, com nulos iguais entre si
  (`NULLS NOT DISTINCT`)

A mesma geometria (uma estrada, uma adutora) pode atravessar vários municípios: vem uma linha por
município. Código IBGE fora de sete dígitos faz o conector falhar.

| Coluna                  | Tipo      | Nulo | Regra de normalização                                     |
| ----------------------- | --------- | ---- | --------------------------------------------------------- |
| `id_geometria`          | `bigint`  | não  | `id_geometria`.                                           |
| `id_projeto`            | `text`    | não  | `id_projeto_investimento`.                                |
| `uf`                    | `char(2)` | sim  | `sg_uf`, sigla.                                           |
| `municipio`             | `text`    | sim  | `no_municipio`, como a fonte escreve (`Sapucaia do Sul`). |
| `codigo_municipio_ibge` | `char(7)` | sim  | `cod_ibge`.                                               |
| `origem`                | `text`    | sim  | `origem_geometria` (`Par de Lat/Long`, `Shapefile`).      |
