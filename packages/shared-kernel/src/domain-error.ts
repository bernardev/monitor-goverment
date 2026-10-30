/**
 * Violação de regra de negócio. Trafega dentro de `Result.fail`, nunca é lançada.
 *
 * `code` é estável e pode ser usado pela interface e pela API pública para traduzir a mensagem;
 * `message` é para pessoas desenvolvedoras e logs.
 */
export class DomainError {
  constructor(
    readonly code: string,
    readonly message: string,
    readonly details: Readonly<Record<string, unknown>> = {},
  ) {}
}
