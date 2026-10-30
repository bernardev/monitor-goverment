import { lookup as lookupComRetorno, type LookupAddress } from 'node:dns';
import { lookup } from 'node:dns/promises';
import { BlockList, isIP, type LookupFunction } from 'node:net';

import { DomainError, Result } from '@prometeu/shared-kernel';
import { Agent, fetch as fetchDoUndici } from 'undici';

import type { BaixadorDeDocumentos, DocumentoBaixado } from '../application/capturar-documento.js';

/**
 * Faixas que nunca são buscadas: rede interna, loopback, link-local (inclui o endereço de metadados das
 * nuvens, 169.254.169.254) e afins. Sem isso, "capture esta URL" vira porta de entrada para a rede
 * interna (SSRF).
 */
const PROIBIDOS = new BlockList();
for (const [rede, prefixo] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 3],
] as const) {
  PROIBIDOS.addSubnet(rede, prefixo, 'ipv4');
}
for (const [rede, prefixo] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  PROIBIDOS.addSubnet(rede, prefixo, 'ipv6');
}

/**
 * IPv4 escrito como IPv6 (`::ffff:127.0.0.1`, `::ffff:7f00:1`, `0:0:0:0:0:ffff:7f00:1`) é conferido pelo
 * IPv4 que carrega. O IPv6 é normalizado antes, porque o parser de URL reescreve a forma decimal em hexa.
 */
function ipv4Embutido(ipv6: string): string | undefined {
  const normalizado = new URL(`http://[${ipv6}]`).hostname.slice(1, -1);
  const grupos = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(normalizado);
  if (!grupos?.[1] || !grupos[2]) return undefined;
  const [alto, baixo] = [Number.parseInt(grupos[1], 16), Number.parseInt(grupos[2], 16)];
  return [alto >> 8, alto & 255, baixo >> 8, baixo & 255].join('.');
}

export function enderecoPublico(ip: string): boolean {
  const familia = isIP(ip);
  if (familia === 0) return false;
  if (familia === 6) {
    const embutido = ipv4Embutido(ip);
    if (embutido !== undefined) return enderecoPublico(embutido);
  }
  return !PROIBIDOS.check(ip, familia === 4 ? 'ipv4' : 'ipv6');
}

class EnderecoInterno extends Error {}

function causadoPorEnderecoInterno(erro: unknown): boolean {
  for (let atual = erro; atual instanceof Error; atual = atual.cause) {
    if (atual instanceof EnderecoInterno) return true;
  }
  return false;
}

/**
 * Resolução feita na hora de abrir a conexão, conferida de novo. Sem isso, um DNS malicioso responde um
 * IP público na conferência e um interno na conexão (DNS rebinding).
 */
const lookupConferido: LookupFunction = (host, opcoes, retorno) => {
  lookupComRetorno(host, { ...opcoes, all: true }, (erro, enderecos: LookupAddress[]) => {
    if (erro) {
      retorno(erro, '', 0);
      return;
    }
    if (enderecos.length === 0 || !enderecos.every((e) => enderecoPublico(e.address))) {
      retorno(new EnderecoInterno(`${host} aponta para uma rede interna.`), '', 0);
      return;
    }
    const [primeiro] = enderecos;
    if (opcoes.all) (retorno as (e: null, a: LookupAddress[]) => void)(null, enderecos);
    else if (primeiro) retorno(null, primeiro.address, primeiro.family);
  });
};

const agenteConferido = new Agent({ connect: { lookup: lookupConferido } });

/** O que o baixador usa de uma resposta HTTP; o fetch do Node e o do undici atendem. */
export interface RespostaDaFonte {
  readonly status: number;
  readonly ok: boolean;
  readonly headers: { get(nome: string): string | null };
  readonly body: ReadableStream<Uint8Array> | null;
}

export type Buscar = (
  url: string,
  opcoes: { redirect: 'manual'; signal: AbortSignal; headers: Record<string, string> },
) => Promise<RespostaDaFonte>;

/** Toda conexão passa pelo agente que confere o IP. */
const buscarConferido: Buscar = (url, opcoes) =>
  fetchDoUndici(url, { ...opcoes, dispatcher: agenteConferido });

/** Tipos que a curadoria guarda como prova: documentos e páginas. */
const TIPOS_ACEITOS = [
  'application/pdf',
  'text/html',
  'text/plain',
  'application/json',
  'application/xml',
  'text/xml',
  'image/png',
  'image/jpeg',
  'image/webp',
];

export interface OpcoesDoBaixador {
  readonly tamanhoMaximoEmBytes?: number;
  readonly tempoLimiteEmMs?: number;
  readonly redirecionamentosMaximos?: number;
  /** Resolução de nomes; trocável nos testes. */
  readonly resolver?: (host: string) => Promise<string[]>;
  readonly buscar?: Buscar;
}

const resolverPorDns = async (host: string): Promise<string[]> =>
  (await lookup(host, { all: true, order: 'verbatim' })).map((r) => r.address);

const falha = (codigo: string, mensagem: string) => Result.fail(new DomainError(codigo, mensagem));

export class BaixadorHttp implements BaixadorDeDocumentos {
  private readonly tamanhoMaximo: number;
  private readonly tempoLimite: number;
  private readonly redirecionamentosMaximos: number;
  private readonly resolver: (host: string) => Promise<string[]>;
  private readonly buscar: Buscar;

  constructor(opcoes: OpcoesDoBaixador = {}) {
    this.tamanhoMaximo = opcoes.tamanhoMaximoEmBytes ?? 50 * 1024 * 1024;
    this.tempoLimite = opcoes.tempoLimiteEmMs ?? 30_000;
    this.redirecionamentosMaximos = opcoes.redirecionamentosMaximos ?? 5;
    this.resolver = opcoes.resolver ?? resolverPorDns;
    this.buscar = opcoes.buscar ?? buscarConferido;
  }

  async baixar(endereco: string): Promise<Result<DocumentoBaixado, DomainError>> {
    let atual = endereco;
    for (let salto = 0; salto <= this.redirecionamentosMaximos; salto++) {
      const permitido = await this.conferir(atual);
      if (!permitido.ok) return permitido;

      let resposta: RespostaDaFonte;
      try {
        resposta = await this.buscar(permitido.value.toString(), {
          redirect: 'manual',
          signal: AbortSignal.timeout(this.tempoLimite),
          headers: {
            'User-Agent': 'prometeu-acervo/0.1 (+https://github.com/bernardev/monitor-goverment)',
          },
        });
      } catch (erro) {
        if (causadoPorEnderecoInterno(erro)) {
          return falha('captura.endereco_interno', 'Esse endereço aponta para uma rede interna.');
        }
        return falha('captura.fonte_indisponivel', `Não foi possível acessar ${atual}.`);
      }

      const destino = resposta.headers.get('location');
      if (resposta.status >= 300 && resposta.status < 400 && destino) {
        // Cada salto é conferido de novo: um redirecionamento não pode levar para a rede interna.
        atual = new URL(destino, permitido.value).toString();
        continue;
      }
      if (!resposta.ok) {
        return falha('captura.fonte_indisponivel', `A fonte respondeu ${resposta.status}.`);
      }
      return this.lerConteudo(permitido.value.toString(), resposta);
    }
    return falha('captura.redirecionamentos_demais', 'A fonte redirecionou vezes demais.');
  }

  private async conferir(endereco: string): Promise<Result<URL, DomainError>> {
    if (!URL.canParse(endereco)) return falha('captura.url_invalida', 'Endereço inválido.');
    const url = new URL(endereco);
    if (url.protocol !== 'https:') {
      return falha('captura.url_invalida', 'Só capturamos endereços https.');
    }
    if (url.username || url.password) {
      return falha('captura.url_invalida', 'O endereço não pode conter usuário e senha.');
    }
    const host = url.hostname.replace(/^\[|\]$/g, '');
    let ips: string[];
    try {
      ips = isIP(host) ? [host] : await this.resolver(host);
    } catch {
      return falha('captura.fonte_indisponivel', `Não foi possível encontrar ${url.hostname}.`);
    }
    if (ips.length === 0 || !ips.every(enderecoPublico)) {
      return falha('captura.endereco_interno', 'Esse endereço aponta para uma rede interna.');
    }
    return Result.ok(url);
  }

  private async lerConteudo(
    url: string,
    resposta: RespostaDaFonte,
  ): Promise<Result<DocumentoBaixado, DomainError>> {
    const tipoDeConteudo = (resposta.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? '';
    if (!TIPOS_ACEITOS.includes(tipoDeConteudo.toLowerCase())) {
      return falha(
        'captura.tipo_nao_aceito',
        `Tipo de conteúdo não aceito: ${tipoDeConteudo || 'desconhecido'}.`,
      );
    }
    const declarado = Number(resposta.headers.get('content-length') ?? 0);
    if (declarado > this.tamanhoMaximo) {
      return falha('captura.grande_demais', 'O documento passa do tamanho máximo.');
    }

    const partes: Uint8Array[] = [];
    let total = 0;
    const leitor = resposta.body?.getReader();
    if (!leitor) return falha('captura.vazia', 'A fonte não devolveu conteúdo.');
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      total += value.byteLength;
      if (total > this.tamanhoMaximo) {
        await leitor.cancel();
        return falha('captura.grande_demais', 'O documento passa do tamanho máximo.');
      }
      partes.push(value);
    }
    if (total === 0) return falha('captura.vazia', 'A fonte não devolveu conteúdo.');
    return Result.ok({ url, conteudo: Buffer.concat(partes), tipoDeConteudo });
  }
}
