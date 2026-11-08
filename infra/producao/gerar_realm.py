"""Deriva o realm de produção do realm local: endereços reais, segredos novos, sem contas de teste."""

import json
import os
import sys

origem, destino = sys.argv[1:3]
with open(origem, encoding="utf-8") as arquivo:
    realm = json.load(arquivo)

clientes = {
    "site": (os.environ["DOMINIO_SITE"], os.environ["SEGREDO_DO_CLIENTE_SITE"]),
    "curadoria": (os.environ["DOMINIO_PAINEL"], os.environ["SEGREDO_DO_CLIENTE_PAINEL"]),
}
# O cliente de linha de comando pega token com usuário e senha: só existe no ambiente local.
realm["clients"] = [c for c in realm["clients"] if c["clientId"] != "ferramentas-locais"]
for cliente in realm["clients"]:
    if cliente["clientId"] in clientes:
        dominio, segredo = clientes[cliente["clientId"]]
        cliente["secret"] = segredo
        cliente["redirectUris"] = [f"https://{dominio}/*"]
        cliente["webOrigins"] = [f"https://{dominio}"]
        cliente["attributes"]["post.logout.redirect.uris"] = f"https://{dominio}/*"

senhas = {
    "curadora": os.environ["SENHA_CURADORA"],
    "revisor": os.environ["SENHA_REVISOR"],
    "editora": os.environ["SENHA_EDITORA"],
}
realm["users"] = [u for u in realm["users"] if u["username"] in senhas]
for usuario in realm["users"]:
    usuario["credentials"][0]["value"] = senhas[usuario["username"]]

with open(destino, "w", encoding="utf-8") as arquivo:
    json.dump(realm, arquivo, ensure_ascii=False, indent=2)
