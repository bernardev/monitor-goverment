import { DomainError, Result, ValueObject } from '@prometeu/shared-kernel';

import type { CandidaturaId, MandatoId, PessoaId } from './identificadores.js';

interface PropsDoAutor {
  pessoa: PessoaId;
  candidatura: CandidaturaId | undefined;
  mandato: MandatoId | undefined;
}

/**
 * Quem prometeu e em que papel. Promessa de campanha pertence a uma candidatura; promessa feita no
 * exercício do cargo pertence a um mandato. Uma das duas é obrigatória: é ela que diz de quem cobrar.
 */
export class AutorDaPromessa extends ValueObject<PropsDoAutor> {
  private constructor(props: PropsDoAutor) {
    super(props);
  }

  static criar(dados: {
    pessoa: PessoaId;
    candidatura?: CandidaturaId | undefined;
    mandato?: MandatoId | undefined;
  }): Result<AutorDaPromessa, DomainError> {
    if (!dados.candidatura && !dados.mandato) {
      return Result.fail(
        new DomainError(
          'autor.sem_candidatura_nem_mandato',
          'A promessa precisa estar ligada a uma candidatura ou a um mandato.',
        ),
      );
    }
    return Result.ok(
      new AutorDaPromessa({
        pessoa: dados.pessoa,
        candidatura: dados.candidatura,
        mandato: dados.mandato,
      }),
    );
  }

  get pessoa(): PessoaId {
    return this.props.pessoa;
  }

  get candidatura(): CandidaturaId | undefined {
    return this.props.candidatura;
  }

  get mandato(): MandatoId | undefined {
    return this.props.mandato;
  }
}
