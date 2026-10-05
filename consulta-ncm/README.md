# Consulta NCM · Reforma Tributária

Digite uma NCM e veja o **CST** e o **cClassTrib** do IBS/CBS (LC 214/2025) que se aplicam a ela.

## Como usar

Abra o `index.html` no navegador (funciona direto do arquivo, sem servidor) ou publique a pasta no GitHub Pages.
Também dá para abrir com a NCM na URL: `index.html#10063021`.

Para cada NCM a consulta mostra:

- os cClassTrib dos anexos da LC 214/2025 em que a NCM se enquadra (cesta básica, redução de 60%, hortícolas,
  insumos agropecuários, dispositivos médicos etc.), com CST, percentual de redução, artigo da lei e o texto do
  item do anexo;
- **CST 000 / cClassTrib 000001** (tributação integral) quando a NCM não consta em nenhum anexo;
- tratamentos que só valem para um destinatário ou operação (administração pública, diferimento) separados dos demais;
- avisos de medicamentos (capítulo 30) e combustíveis (monofásico), cujo enquadramento não depende só da NCM;
- se o produto é alcançado pelo Imposto Seletivo.

A data do fato gerador filtra a vigência dos códigos e dos vínculos.

## Dados

`data/base.js` é gerado a partir do pacote [`@sinete/ibs-cbs-dados`](https://www.npmjs.com/package/@sinete/ibs-cbs-dados)
(Apache-2.0), que reúne a tabela de CST/cClassTrib da IT 2025.002 (Portal NF-e) e os vínculos NCM × anexos extraídos
da Calculadora da Reforma Tributária da RFB. A regra de aplicabilidade (prefixo de NCM com exceções) reproduz a da
Calculadora.

Para atualizar:

```sh
npm pack @sinete/ibs-cbs-dados
tar xzf sinete-ibs-cbs-dados-*.tgz
python3 scripts/gerar_base.py package/src/data
npm test
```

## Testes

```sh
npm test
```

> Resultado indicativo. O enquadramento final depende da operação, do destinatário e da descrição do produto nos
> anexos da LC 214/2025.
