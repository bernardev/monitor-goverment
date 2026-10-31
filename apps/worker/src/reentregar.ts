// Comando de operação: reentrega eventos a um consumidor (ADR-0007, ADR-0015).
//
//   node apps/worker/dist/reentregar.js <consumidor> [evento...] [--origem ingestao] [--tipo T]
//
// Exemplos: importar de novo um lote depois de corrigir o importador,
//   node apps/worker/dist/reentregar.js obras.importar_obras_do_obrasgov 01a1925d-6b7f-...
// ou alimentar desde o começo uma projeção nova com todos os lotes já ingeridos,
//   node apps/worker/dist/reentregar.js consulta.projetar_coletas --tipo LoteIngerido
//
// O worker precisa estar rodando para o relay publicar de novo. O schema do consumidor é o prefixo do
// nome dele (`obras.importar_...` está em `obras`).
import { parseArgs } from 'node:util';

import {
  BancoDoContexto,
  inboxDoSchema,
  outboxDoSchema,
  reentregar,
  urlDoBanco,
} from '@prometeu/infraestrutura';

const SCHEMAS = new Set([
  'ingestao',
  'acervo',
  'agentes_publicos',
  'atividade_legislativa',
  'compromissos',
  'consulta',
  'financas_publicas',
  'obras',
]);

async function principal(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { origem: { type: 'string', default: 'ingestao' }, tipo: { type: 'string' } },
  });
  const [consumidor, ...eventos] = positionals;
  const destino = consumidor?.split('.')[0];
  if (consumidor === undefined || destino === undefined || !SCHEMAS.has(destino)) {
    throw new Error('Informe o consumidor, como obras.importar_obras_do_obrasgov.');
  }
  if (!SCHEMAS.has(values.origem)) throw new Error(`Origem desconhecida: ${values.origem}.`);
  if (eventos.length === 0 && values.tipo === undefined) {
    throw new Error(
      'Sem eventos, informe --tipo: reentregar a outbox inteira é raro de propósito.',
    );
  }

  const origem = BancoDoContexto.conectar(values.origem, urlDoBanco(values.origem));
  const bancoDoDestino = BancoDoContexto.conectar(destino, urlDoBanco(destino));
  try {
    const resultado = await reentregar(
      { banco: origem, outbox: outboxDoSchema(values.origem) },
      { banco: bancoDoDestino, inbox: inboxDoSchema(destino), consumidor },
      { ...(eventos.length > 0 ? { eventos } : {}), ...(values.tipo ? { tipo: values.tipo } : {}) },
    );
    process.stdout.write(
      `${String(resultado.republicados)} eventos voltam à fila de ${values.origem}; ` +
        `${String(resultado.esquecidos)} estavam na inbox de ${consumidor}.\n`,
    );
  } finally {
    await Promise.all([origem.fechar(), bancoDoDestino.fechar()]);
  }
}

principal().catch((erro: unknown) => {
  process.stderr.write(`${erro instanceof Error ? erro.message : String(erro)}\n`);
  process.exitCode = 1;
});
