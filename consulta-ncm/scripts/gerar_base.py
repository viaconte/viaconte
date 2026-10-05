#!/usr/bin/env python3
"""Gera data/base.js a partir do dataset @sinete/ibs-cbs-dados.

O dataset reúne a tabela CST/cClassTrib da IT 2025.002 (Portal NF-e) e os
vínculos NCM x anexos da LC 214/2025 extraídos da Calculadora da RFB.

Uso:
    npm pack @sinete/ibs-cbs-dados && tar xzf sinete-ibs-cbs-dados-*.tgz
    python3 scripts/gerar_base.py package/src/data
"""
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def carregar(pasta, nome):
    return json.loads((pasta / f"{nome}.json").read_text(encoding="utf-8"))


def vig(v):
    return [v["inicio"], v["fim"]]


def reducao(registro, tributo):
    # Redução vigente mais recente do tributo (as tabelas atuais têm uma por tributo).
    valores = [r for r in registro["reducoes"] if r["tributo"] == tributo]
    return valores[-1]["pRed"] if valores else "0"


def vinculos(registros):
    return [
        {
            "c": a["cClassTrib"],
            "p": a["prefixo"],
            "i": a["itemDoAnexo"],
            "v": vig(a["vigencia"]),
            "e": [{"p": e["prefixo"], "v": vig(e["vigencia"])} for e in a["excecoes"]],
        }
        for a in registros
    ]


def main(pasta):
    pasta = Path(pasta)
    manifest = carregar(pasta, "manifest")

    cst = {
        c["codigo"]: c["descricao"]
        for c in carregar(pasta, "cst")
        if c["familia"] == "CBS_IBS"
    }

    class_trib = {}
    for x in carregar(pasta, "classTrib"):
        if x["familia"] != "CBS_IBS":
            continue
        class_trib[x["codigo"]] = {
            "cst": x["cst"],
            "nome": x["nome"] or x["descricao"],
            "descricao": x["descricao"],
            "redCBS": reducao(x, "CBS"),
            "redIBS": reducao(x, "IBSUF"),
            "tipoAliquota": x["tipoDeAliquota"],
            "lc214": x["legal"].get("lc214"),
            "url": x["legal"].get("url"),
            "nomenclatura": x.get("nomenclatura"),
            "v": vig(x["vigencia"]),
        }

    aplic = carregar(pasta, "aplicabilidadeNcm")
    anexos = {
        f'{a["anexo"]}/{a["item"]}': a["texto"]
        for a in carregar(pasta, "anexos")
    }

    base = {
        "versao": manifest["versaoDosDados"],
        "conhecidoEm": manifest["conhecidoEm"],
        "fontes": [
            {"titulo": f["titulo"], "versao": f["versao"], "url": f["url"]}
            for f in manifest["fontes"]
        ],
        "cst": cst,
        "classTrib": class_trib,
        "vinculos": vinculos(a for a in aplic if a["familia"] == "CBS_IBS"),
        "vinculosIS": vinculos(a for a in aplic if a["familia"] == "IS"),
        "anexos": anexos,
    }

    destino = RAIZ / "data" / "base.js"
    corpo = json.dumps(base, ensure_ascii=False, separators=(",", ":"))
    destino.write_text(
        "// Gerado por scripts/gerar_base.py. Não edite à mão.\n"
        f"window.BASE_REFORMA = {corpo};\n",
        encoding="utf-8",
    )
    print(
        f"{destino}: {len(class_trib)} cClassTrib, {len(base['vinculos'])} vínculos NCM, "
        f"{len(base['vinculosIS'])} vínculos IS, {len(anexos)} itens de anexo"
    )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
