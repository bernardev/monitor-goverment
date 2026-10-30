import {
  CreateBucketCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import type { ArmazemDeCapturas } from '../application/capturar-documento.js';

export interface ConfiguracaoDoS3 {
  readonly endpoint: string;
  readonly chaveDeAcesso: string;
  readonly segredo: string;
  readonly balde: string;
}

/** Capturas em armazenamento de objetos S3-compatível (RustFS no ambiente local). */
export class ArmazemS3 implements ArmazemDeCapturas {
  private readonly s3: S3Client;

  constructor(private readonly configuracao: ConfiguracaoDoS3) {
    this.s3 = new S3Client({
      endpoint: configuracao.endpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: configuracao.chaveDeAcesso,
        secretAccessKey: configuracao.segredo,
      },
    });
  }

  /** Cria o balde se ainda não existir. Chamado uma vez, na subida do processo. */
  async preparar(): Promise<void> {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.configuracao.balde }));
    } catch {
      await this.s3.send(new CreateBucketCommand({ Bucket: this.configuracao.balde }));
    }
  }

  /** Endereçado pelo hash: guardar de novo o mesmo conteúdo não muda nada. */
  async guardar(caminho: string, conteudo: Uint8Array, tipoDeConteudo: string): Promise<void> {
    if (await this.existe(caminho)) return;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.configuracao.balde,
        Key: caminho,
        Body: conteudo,
        ContentType: tipoDeConteudo,
      }),
    );
  }

  private async existe(caminho: string): Promise<boolean> {
    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.configuracao.balde, Key: caminho }));
      return true;
    } catch (erro) {
      if (erro instanceof Error && erro.name === 'NotFound') return false;
      throw erro;
    }
  }
}
