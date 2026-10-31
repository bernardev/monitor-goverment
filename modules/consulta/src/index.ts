// Ponto de entrada público do módulo (ADR-0002). Outros módulos e apps só importam o que for
// exportado aqui: fachada de casos de uso e contratos. Nunca exporte entidades ou repositórios.
import { fileURLToPath } from 'node:url';

import type { BancoDoContexto, BarramentoDeEventos } from '@prometeu/infraestrutura';

import type {
  ConsultaDeEmendas,
  ConsultaDeFontes,
  ConsultaDeFrequencia,
  ConsultaDeMunicipios,
  ConsultaDeObras,
  ConsultaDeParlamentares,
  ConsultaDeProposicoes,
  ConsultaDeVotacoes,
  Relogio,
} from './application/portas.js';
import { ConsultaDeEmendasPostgres } from './infrastructure/consulta-de-emendas-postgres.js';
import { ConsultaDeFontesPostgres } from './infrastructure/consulta-de-fontes-postgres.js';
import { ConsultaDeFrequenciaPostgres } from './infrastructure/consulta-de-frequencia-postgres.js';
import { ConsultaDeMunicipiosPostgres } from './infrastructure/consulta-de-municipios-postgres.js';
import { ConsultaDeObrasPostgres } from './infrastructure/consulta-de-obras-postgres.js';
import { ConsultaDeParlamentaresPostgres } from './infrastructure/consulta-de-parlamentares-postgres.js';
import { ConsultaDeProposicoesPostgres } from './infrastructure/consulta-de-proposicoes-postgres.js';
import { ConsultaDeVotacoesPostgres } from './infrastructure/consulta-de-votacoes-postgres.js';
import { ProjetorDeColetas } from './infrastructure/projetor-de-coletas.js';
import { ProjetorDeConvenios } from './infrastructure/projetor-de-convenios.js';
import { ProjetorDeEmendas } from './infrastructure/projetor-de-emendas.js';
import { ProjetorDeFavorecidos } from './infrastructure/projetor-de-favorecidos.js';
import { ProjetorDeFrequencia } from './infrastructure/projetor-de-frequencia.js';
import { ProjetorDeMunicipios } from './infrastructure/projetor-de-municipios.js';
import { ProjetorDeObras } from './infrastructure/projetor-de-obras.js';
import { ProjetorDeParlamentares } from './infrastructure/projetor-de-parlamentares.js';
import { ProjetorDeProposicoes } from './infrastructure/projetor-de-proposicoes.js';
import { ProjetorDeVotacoes } from './infrastructure/projetor-de-votacoes.js';
import { assinarConsumidores } from './interface/consumidores.js';

export type {
  ConsultaDeEmendas,
  ConsultaDeFontes,
  ConsultaDeFrequencia,
  ConsultaDeMunicipios,
  ConsultaDeObras,
  ConsultaDeParlamentares,
  ConsultaDeProposicoes,
  ConsultaDeVotacoes,
  FiltroDeEmendas,
  FiltroDeObras,
  FiltroDeParlamentares,
  FiltroDeProposicoes,
  FiltroDeVotacoes,
  Paginacao,
  PeriodoEmDias,
  Relogio,
} from './application/portas.js';

export const SCHEMA_DA_CONSULTA = 'consulta';
export const MIGRACOES_DA_CONSULTA = fileURLToPath(new URL('../drizzle', import.meta.url));

export interface ModuloConsulta {
  readonly parlamentares: ConsultaDeParlamentares;
  readonly frequencia: ConsultaDeFrequencia;
  readonly votacoes: ConsultaDeVotacoes;
  readonly proposicoes: ConsultaDeProposicoes;
  readonly emendas: ConsultaDeEmendas;
  readonly obras: ConsultaDeObras;
  readonly fontes: ConsultaDeFontes;
  readonly municipios: ConsultaDeMunicipios;
  assinarConsumidores(barramento: BarramentoDeEventos): Promise<void>;
}

const RELOGIO_DO_SISTEMA: Relogio = { agora: () => new Date() };

export function montarConsulta(
  banco: BancoDoContexto,
  relogio: Relogio = RELOGIO_DO_SISTEMA,
): ModuloConsulta {
  const votacoes = new ConsultaDeVotacoesPostgres(banco);
  const obras = new ConsultaDeObrasPostgres(banco);
  return {
    parlamentares: new ConsultaDeParlamentaresPostgres(banco, relogio),
    frequencia: new ConsultaDeFrequenciaPostgres(banco),
    votacoes,
    proposicoes: new ConsultaDeProposicoesPostgres(banco, votacoes),
    emendas: new ConsultaDeEmendasPostgres(banco, obras),
    obras,
    fontes: new ConsultaDeFontesPostgres(banco, relogio),
    municipios: new ConsultaDeMunicipiosPostgres(banco),
    assinarConsumidores: (barramento) =>
      assinarConsumidores(barramento, banco, {
        parlamentares: new ProjetorDeParlamentares(banco),
        frequencia: new ProjetorDeFrequencia(banco),
        votacoes: new ProjetorDeVotacoes(banco),
        proposicoes: new ProjetorDeProposicoes(banco),
        emendas: new ProjetorDeEmendas(banco),
        favorecidos: new ProjetorDeFavorecidos(banco),
        convenios: new ProjetorDeConvenios(banco),
        obras: new ProjetorDeObras(banco),
        coletas: new ProjetorDeColetas(banco),
        municipios: new ProjetorDeMunicipios(banco),
      }),
  };
}
