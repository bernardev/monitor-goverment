import { violacoesDoContrato } from '@prometeu/contracts/esquemas';
import { describe, expect, it } from 'vitest';

import { AGORA, umaCaptura, umaPessoa, umMandato, valor } from '../testes/construtores.js';
import { IdentificadorExterno } from './identificador-externo.js';
import { NomePublico } from './nome-publico.js';
import { Pessoa } from './pessoa.js';
import { SiglaPartidaria } from './sigla-partidaria.js';
import { UrlPublica } from './url-publica.js';

describe('eventos de Agentes Públicos respeitam os contratos publicados (packages/contracts/eventos)', () => {
  it('todos os tipos emitidos', () => {
    const registrada = Pessoa.registrar({
      nome: valor(NomePublico.criar('Ana Exemplo')),
      identificador: valor(IdentificadorExterno.criar('camara', '900001')),
      filiacao: undefined,
      foto: valor(UrlPublica.criar('https://camara.leg.br/f.jpg')),
      captura: umaCaptura(),
      agora: AGORA,
    });
    const pessoa = umaPessoa();
    pessoa.atualizarNome(valor(NomePublico.criar('Ana Nova')), umaCaptura(), AGORA);
    pessoa.atualizarFiliacao(valor(SiglaPartidaria.criar('PMO')), umaCaptura(), AGORA);
    pessoa.atualizarFiliacao(undefined, umaCaptura(), AGORA);
    pessoa.atualizarFoto(
      valor(UrlPublica.criar('https://camara.leg.br/f.jpg')),
      umaCaptura(),
      AGORA,
    );
    pessoa.atualizarFoto(undefined, umaCaptura(), AGORA);
    valor(pessoa.registrarMandato(umMandato(), AGORA));
    valor(
      pessoa.sincronizarMandatos([umMandato({ fim: new Date('2026-03-31T21:00:00.000Z') })], AGORA),
    );

    const eventos = [...registrada.pullDomainEvents(), ...pessoa.pullDomainEvents()];
    expect(new Set(eventos.map((e) => e.tipo))).toEqual(
      new Set([
        'PessoaRegistrada',
        'NomePublicoAlterado',
        'FiliacaoPartidariaAlterada',
        'FotoOficialAlterada',
        'MandatoRegistrado',
        'PeriodoDoMandatoRetificado',
      ]),
    );
    for (const evento of eventos) {
      expect(violacoesDoContrato(evento.tipo, evento.versao, evento.dados), evento.tipo).toEqual(
        [],
      );
    }
  });
});
