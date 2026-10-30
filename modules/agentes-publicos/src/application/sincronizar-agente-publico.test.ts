import { describe, expect, it } from 'vitest';

import { AGORA, erro, umaEntrada, umaOrigem, valor } from '../testes/construtores.js';
import { CapturasEmMemoria, PessoaRepositoryEmMemoria, RelogioFixo } from '../testes/fakes.js';
import { SincronizarAgentePublico } from './sincronizar-agente-publico.js';

function cenario() {
  const pessoas = new PessoaRepositoryEmMemoria();
  const capturas = new CapturasEmMemoria();
  const sincronizar = new SincronizarAgentePublico(pessoas, capturas, new RelogioFixo(AGORA));
  return { pessoas, capturas, sincronizar };
}

describe('SincronizarAgentePublico', () => {
  it('cria a pessoa e o mandato na primeira vez, com captura registrada', async () => {
    const { pessoas, capturas, sincronizar } = cenario();

    const saida = valor(await sincronizar.execute(umaEntrada()));

    expect(saida.pessoaNova).toBe(true);
    expect(pessoas.eventos).toEqual(['PessoaRegistrada', 'MandatoRegistrado']);
    expect(capturas.porHash.size).toBe(1);
  });

  it('repetir o mesmo retrato não gera eventos nem pessoa nova', async () => {
    const { pessoas, sincronizar } = cenario();
    const primeira = valor(await sincronizar.execute(umaEntrada()));

    const segunda = valor(await sincronizar.execute(umaEntrada()));

    expect(segunda).toEqual({ ...primeira, pessoaNova: false });
    expect(pessoas.quantidade).toBe(1);
    expect(pessoas.eventos).toEqual(['PessoaRegistrada', 'MandatoRegistrado']);
  });

  it('um novo retrato registra só o que mudou, com a nova captura', async () => {
    const { pessoas, capturas, sincronizar } = cenario();
    await sincronizar.execute(umaEntrada());

    await sincronizar.execute(
      umaEntrada({ siglaPartido: null, origem: umaOrigem('b'.repeat(64)) }),
    );

    expect(pessoas.eventos.at(-1)).toBe('FiliacaoPartidariaAlterada');
    expect(capturas.porHash.size).toBe(2);
  });

  it.each([
    [{ identificador: { fonte: 'camara', codigo: '' } }, 'identificador.codigo_vazio'],
    [{ nome: '' }, 'pessoa.nome_vazio'],
    [{ urlDaFoto: 'foto.jpg' }, 'url.invalida'],
    [{ mandato: { ...umaEntrada().mandato, cargo: 'rei' } }, 'entrada.opcao_invalida'],
    [{ mandato: { ...umaEntrada().mandato, circunscricao: '99' } }, 'codigo_ibge.invalido'],
    [
      { mandato: { ...umaEntrada().mandato, fim: new Date('2020-01-01') } },
      'periodo.fim_antes_do_inicio',
    ],
  ])('recusa entrada inválida sem gravar nada (%#)', async (sobrescrever, codigo) => {
    const { pessoas, sincronizar } = cenario();

    const resultado = await sincronizar.execute(umaEntrada(sobrescrever));

    expect(erro(resultado)).toBe(codigo);
    expect(pessoas.quantidade).toBe(0);
  });

  it('não grava a pessoa quando o mandato é recusado', async () => {
    const { pessoas, sincronizar } = cenario();
    await sincronizar.execute(umaEntrada());

    const resultado = await sincronizar.execute(
      umaEntrada({
        nome: 'Outro Nome',
        mandato: { ...umaEntrada().mandato, circunscricao: '33' },
      }),
    );

    expect(erro(resultado)).toBe('mandato.sobreposto');
    expect(pessoas.eventos).toEqual(['PessoaRegistrada', 'MandatoRegistrado']);
  });
});
