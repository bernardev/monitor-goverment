"""Bronze em armazenamento de objetos S3-compatível (RustFS no ambiente local)."""

from __future__ import annotations

from typing import TYPE_CHECKING
from urllib.parse import quote

import boto3
from botocore.exceptions import ClientError

from prometeu_dados.bronze import RespostaBruta

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client


class ArmazemS3:
    def __init__(self, balde: str, endpoint: str, chave_de_acesso: str, segredo: str) -> None:
        self._balde = balde
        self._s3: S3Client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=chave_de_acesso,
            aws_secret_access_key=segredo,
            region_name="us-east-1",
        )

    def preparar(self) -> None:
        """Cria o balde se ainda não existir."""
        try:
            self._s3.head_bucket(Bucket=self._balde)
        except ClientError:
            self._s3.create_bucket(Bucket=self._balde)

    def guardar(self, resposta: RespostaBruta) -> None:
        chave = str(resposta.caminho_no_bronze())
        if self._existe(chave):
            return
        self._s3.put_object(
            Bucket=self._balde,
            Key=chave,
            Body=resposta.conteudo,
            ContentType=resposta.tipo_de_conteudo or "application/octet-stream",
            # Metadados S3 só aceitam ASCII; a URL vai codificada.
            Metadata={
                "fonte": resposta.fonte,
                "url": quote(resposta.url, safe=":/?&=%"),
                "coletado-em": resposta.coletado_em.isoformat(),
            },
        )

    def _existe(self, chave: str) -> bool:
        try:
            self._s3.head_object(Bucket=self._balde, Key=chave)
        except ClientError as erro:
            if erro.response.get("Error", {}).get("Code") in {"404", "NoSuchKey", "NotFound"}:
                return False
            raise
        return True
