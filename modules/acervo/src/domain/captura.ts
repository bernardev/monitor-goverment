import { AggregateRoot, DomainError, Result, criarEvento } from '@prometeu/shared-kernel';

import type { HashSha256 } from './hash-sha256.js';
import { CapturaId } from './identificadores.js';

const NOME_DE_FONTE = /^[a-z][a-z0-9_]*$/;

export interface DadosDaCaptura {
  /** Conector ou origem da coleta (`camara`, `curadoria`). */
  readonly fonte: string;
  readonly url: string;
  readonly coletadaEm: Date;
  readonly sha256: HashSha256;
  /** Chave do conteúdo no armazenamento de objetos. */
  readonly caminho: string;
  readonly tipoDeConteudo: string;
}

interface EstadoDaCaptura extends DadosDaCaptura {
  readonly registradaEm: Date;
}

/**
 * Cópia imutável do que uma fonte publicou, num instante, identificada pelo hash (ADR-0009). Todo fato
 * exibido pelo produto aponta para uma captura. Capturas não mudam e não são apagadas.
 */
export class Captura extends AggregateRoot<CapturaId> {
  private constructor(
    id: CapturaId,
    private readonly estado: EstadoDaCaptura,
  ) {
    super(id);
  }

  static registrar(dados: DadosDaCaptura, agora: Date): Result<Captura, DomainError> {
    const fonte = dados.fonte.trim();
    if (!NOME_DE_FONTE.test(fonte)) {
      return Result.fail(
        new DomainError('captura.fonte_invalida', `Nome de fonte inválido: "${dados.fonte}"`),
      );
    }
    if (!ehUrlPublica(dados.url)) {
      return Result.fail(
        new DomainError(
          'captura.url_invalida',
          `A captura precisa de uma URL http(s): "${dados.url}"`,
        ),
      );
    }
    if (Number.isNaN(dados.coletadaEm.getTime())) {
      return Result.fail(new DomainError('captura.data_invalida', 'Data de coleta inválida.'));
    }
    if (dados.coletadaEm > agora) {
      return Result.fail(
        new DomainError('captura.coleta_no_futuro', 'A data de coleta está no futuro.'),
      );
    }
    if (dados.caminho.trim().length === 0) {
      return Result.fail(
        new DomainError(
          'captura.sem_caminho',
          'A captura precisa apontar para o conteúdo guardado.',
        ),
      );
    }

    const captura = new Captura(CapturaId.gerar(), {
      ...dados,
      fonte,
      coletadaEm: new Date(dados.coletadaEm),
      registradaEm: new Date(agora),
    });
    captura.addDomainEvent(
      criarEvento({
        tipo: 'CapturaRegistrada',
        idDoAgregado: captura.id.valor,
        dados: {
          sha256: dados.sha256.valor,
          fonte,
          url: dados.url,
          coletadaEm: dados.coletadaEm.toISOString(),
          tipoDeConteudo: dados.tipoDeConteudo,
        },
        ocorridoEm: agora,
      }),
    );
    return Result.ok(captura);
  }

  /** Recria a captura a partir do que o repositório guardou, sem regras nem eventos. */
  static reconstituir(id: CapturaId, estado: EstadoDaCaptura): Captura {
    return new Captura(id, estado);
  }

  get fonte(): string {
    return this.estado.fonte;
  }

  get url(): string {
    return this.estado.url;
  }

  get coletadaEm(): Date {
    return new Date(this.estado.coletadaEm);
  }

  get sha256(): HashSha256 {
    return this.estado.sha256;
  }

  get caminho(): string {
    return this.estado.caminho;
  }

  get tipoDeConteudo(): string {
    return this.estado.tipoDeConteudo;
  }

  get registradaEm(): Date {
    return new Date(this.estado.registradaEm);
  }
}

function ehUrlPublica(texto: string): boolean {
  if (!URL.canParse(texto)) return false;
  const { protocol } = new URL(texto);
  return protocol === 'https:' || protocol === 'http:';
}
