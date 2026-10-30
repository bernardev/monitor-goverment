import type { BancoDoContexto } from '@prometeu/infraestrutura';
import { CodigoIbge, type DomainError, Result } from '@prometeu/shared-kernel';
import { eq } from 'drizzle-orm';

import type {
  SincronizarAgentePublico,
  SincronizarAgentePublicoInput,
} from '../application/sincronizar-agente-publico.js';
import { type ExercicioNoSenado, senadoExercicios, senadoSenador } from './prata-do-senado.js';
import type { FalhaDeImportacao, ResumoDaImportacao } from './resumo-da-importacao.js';

type Periodo = SincronizarAgentePublicoInput['mandatos'][number];

/** Como o Senado escreve "sem partido" (senador desfiliado). */
const SEM_PARTIDO = 'S/Partido';

/**
 * Camada anticorrupção do Senado (ADR-0005): traduz senadores e exercícios da prata para a linguagem
 * deste contexto. O lote é o de `senado_senador`; os exercícios estão em `senado_exercicios`, gravados
 * na mesma transação.
 *
 * Quem foi deputado e virou senador fica, por enquanto, como outra pessoa: as fontes não têm um
 * identificador em comum, e juntar pelo nome confundiria homônimos.
 */
export class ImportadorDeSenadoresDoSenado {
  constructor(
    private readonly banco: BancoDoContexto,
    private readonly sincronizar: SincronizarAgentePublico,
  ) {}

  async importar(loteId: string): Promise<ResumoDaImportacao> {
    const linhas = await this.banco.executor
      .select({ senador: senadoSenador, exercicios: senadoExercicios.exercicios })
      .from(senadoSenador)
      .leftJoin(senadoExercicios, eq(senadoExercicios.codigo, senadoSenador.codigo))
      .where(eq(senadoSenador.loteId, loteId))
      .orderBy(senadoSenador.codigo);

    let pessoasNovas = 0;
    const falhas: FalhaDeImportacao[] = [];
    for (const { senador, exercicios } of linhas) {
      const mandatos = periodos(exercicios ?? []);
      const resultado = mandatos.ok
        ? await this.sincronizar.execute(paraEntrada(senador, mandatos.value))
        : mandatos;
      if (resultado.ok) {
        if (resultado.value.pessoaNova) pessoasNovas += 1;
      } else {
        falhas.push({
          codigoNaFonte: String(senador.codigo),
          erro: resultado.error.code,
          mensagem: resultado.error.message,
        });
      }
    }
    return { loteId, lidos: linhas.length, pessoasNovas, falhas };
  }
}

function paraEntrada(
  senador: typeof senadoSenador.$inferSelect,
  mandatos: Periodo[],
): SincronizarAgentePublicoInput {
  return {
    identificador: { fonte: 'senado', codigo: String(senador.codigo) },
    nome: senador.nome,
    siglaPartido: senador.siglaPartido === SEM_PARTIDO ? null : senador.siglaPartido,
    urlDaFoto: senador.urlFoto,
    mandatos,
    origem: {
      fonte: senador.origemFonte,
      url: senador.origemUrl,
      coletadaEm: senador.origemColetadaEm,
      sha256: senador.origemSha256,
      caminho: senador.origemCaminho,
      tipoDeConteudo: senador.origemTipoDeConteudo,
    },
  };
}

/**
 * Cada exercício vira um mandato, do primeiro ao último instante dos dias informados (Brasília); o
 * que está em curso vai até o fim do mandato. O Senado às vezes encerra um exercício e abre o seguinte
 * da mesma pessoa no mesmo dia: os dois são o mesmo período no cargo, sem interrupção, e viram um só.
 */
function periodos(exercicios: readonly ExercicioNoSenado[]): Result<Periodo[], DomainError> {
  const juntos: Periodo[] = [];
  const ordenados = [...exercicios].sort((a, b) => a.inicio.localeCompare(b.inicio));
  for (const exercicio of ordenados) {
    const uf = CodigoIbge.daUf(exercicio.uf);
    if (!uf.ok) return uf;
    const atual: Periodo = {
      cargo: 'senador',
      circunscricao: uf.value.valor,
      inicio: new Date(`${exercicio.inicio}T00:00:00.000-03:00`),
      fim: new Date(`${exercicio.fim ?? exercicio.fim_do_mandato}T23:59:59.999-03:00`),
    };
    const anterior = juntos.at(-1);
    if (
      anterior?.fim &&
      anterior.circunscricao === atual.circunscricao &&
      atual.inicio <= anterior.fim
    ) {
      juntos[juntos.length - 1] = {
        ...anterior,
        fim: atual.fim && atual.fim > anterior.fim ? atual.fim : anterior.fim,
      };
    } else {
      juntos.push(atual);
    }
  }
  return Result.ok(juntos);
}
