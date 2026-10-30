import { DomainError, Result, ValueObject } from '@prometeu/shared-kernel';

/**
 * Categorias de justificativa previstas nos regimentos (Câmara: Ato da Mesa 66/2010; Senado: RISF,
 * art. 13). `outro` guarda uma justificativa aceita pela casa que ainda não tem categoria aqui.
 */
export const CATEGORIAS_DE_MOTIVO = [
  'licenca_saude',
  'licenca_gestante',
  'licenca_paternidade',
  'licenca_particular',
  'missao_autorizada',
  'atividade_parlamentar',
  'decisao_da_mesa',
  'outro',
] as const;
export type CategoriaDoMotivo = (typeof CATEGORIAS_DE_MOTIVO)[number];

/**
 * Por que a casa aceitou a ausência. A categoria permite comparar casas diferentes; a descrição
 * guarda as palavras da fonte, para quem quiser conferir.
 */
export class MotivoDaAusencia extends ValueObject<{
  categoria: CategoriaDoMotivo;
  descricaoNaFonte: string;
}> {
  static criar(categoria: string, descricaoNaFonte: string): Result<MotivoDaAusencia, DomainError> {
    const conhecida = CATEGORIAS_DE_MOTIVO.find((c) => c === categoria);
    if (conhecida === undefined) {
      return Result.fail(
        new DomainError('motivo.categoria_desconhecida', `Categoria desconhecida: "${categoria}"`),
      );
    }
    const descricao = descricaoNaFonte.replace(/\s+/g, ' ').trim();
    if (descricao.length === 0) {
      return Result.fail(
        new DomainError('motivo.sem_descricao', 'O motivo precisa das palavras da fonte.'),
      );
    }
    return Result.ok(new MotivoDaAusencia({ categoria: conhecida, descricaoNaFonte: descricao }));
  }

  get categoria(): CategoriaDoMotivo {
    return this.props.categoria;
  }

  get descricaoNaFonte(): string {
    return this.props.descricaoNaFonte;
  }
}
