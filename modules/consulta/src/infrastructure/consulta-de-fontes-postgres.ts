import type { SituacaoDaFonte } from '@prometeu/contracts';
import type { BancoDoContexto } from '@prometeu/infraestrutura';

import type { ConsultaDeFontes, Relogio } from '../application/portas.js';
import { coleta } from './esquema.js';

const HORA = 3_600_000;

/**
 * As fontes que a plataforma de dados coleta e a agenda de cada uma (data-platform, definicoes.py).
 * A folga cobre uma coleta lenta ou uma fonte fora do ar por algumas horas sem marcar atraso.
 */
const FONTES: readonly {
  fonte: string;
  nome: string;
  periodicidade: SituacaoDaFonte['periodicidade'];
}[] = [
  { fonte: 'camara', nome: 'Câmara dos Deputados', periodicidade: 'diaria' },
  { fonte: 'senado', nome: 'Senado Federal', periodicidade: 'diaria' },
  { fonte: 'portal_transparencia', nome: 'Portal da Transparência', periodicidade: 'diaria' },
  { fonte: 'obrasgov', nome: 'Obrasgov.br', periodicidade: 'semanal' },
];
const PRAZO = { diaria: 24 * HORA, semanal: 7 * 24 * HORA } as const;
const FOLGA = 12 * HORA;

export class ConsultaDeFontesPostgres implements ConsultaDeFontes {
  constructor(
    private readonly banco: BancoDoContexto,
    private readonly relogio: Relogio,
  ) {}

  async situacao(): Promise<SituacaoDaFonte[]> {
    const linhas = await this.banco.drizzle
      .select()
      .from(coleta)
      .orderBy(coleta.fonte, coleta.tabela);
    const agora = this.relogio.agora().getTime();
    return FONTES.map(({ fonte, nome, periodicidade }) => {
      const tabelas = linhas.filter((l) => l.fonte === fonte);
      const ultima = Math.max(...tabelas.map((t) => t.ocorridoEm.getTime()));
      const coletada = tabelas.length > 0;
      return {
        fonte,
        nome,
        periodicidade,
        ultimaColetaEm: coletada ? new Date(ultima).toISOString() : null,
        situacao: !coletada
          ? 'nunca_coletada'
          : agora - ultima <= PRAZO[periodicidade] + FOLGA
            ? 'em_dia'
            : 'atrasada',
        tabelas: tabelas.map((t) => ({
          tabela: t.tabela,
          ultimaColetaEm: t.ocorridoEm.toISOString(),
          registros: t.registros,
          versaoDoContrato: t.versaoDoContrato,
        })),
      };
    });
  }
}
