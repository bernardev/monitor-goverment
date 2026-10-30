# Contratos da camada prata

Cada tabela do schema `ingestao` é um contrato entre a plataforma de dados (Python) e os importadores
dos módulos (TypeScript). Ver [ADR-0005](../../../docs/adr/0005-plataforma-de-dados-python.md).

Cada contrato fica em `prata/<fonte>/<tabela>.vX.Y.Z.md` (ou `.schema.json`) e descreve colunas, tipos,
chave natural, frequência de atualização e regras de normalização.

Regras de versão:

- **patch:** documentação ou validação mais estrita sem mudança de formato;
- **minor:** coluna nova opcional (consumidores antigos continuam funcionando);
- **major:** remoção ou mudança de significado de coluna (exige nova tabela ou período de convivência).
