/*
 * Consulta de CST e cClassTrib (IBS/CBS) por NCM.
 *
 * A aplicabilidade de um cClassTrib a uma NCM segue a tabela-verdade da
 * Calculadora da Reforma Tributária (RFB):
 *  - o vínculo cobre a NCM quando a NCM começa com o prefixo do vínculo;
 *  - uma exceção vigente que cobre a NCM a exclui, salvo se outro vínculo
 *    vigente que a cobre não tiver exceção (ou tiver uma fora de vigência).
 * NCM sem nenhum vínculo cai na regra geral: CST 000 / cClassTrib 000001.
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.ConsultaNcm = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CLASS_TRIB_PADRAO = '000001';

  // Tratamentos que não dependem de lista de NCM no anexo da LC 214/2025
  // (medicamentos por registro na Anvisa, combustíveis pelo regime monofásico).
  // São sinalizados por capítulo/posição apenas como indicação para conferência.
  var ALERTAS = [
    {
      prefixos: ['3001', '3002', '3003', '3004', '3005', '3006'],
      titulo: 'Possível medicamento',
      texto:
        'Medicamentos registrados na Anvisa têm redução de 60% (cClassTrib 200032, art. 133) ' +
        'ou de 100% quando listados no Anexo XIV (cClassTrib 200009, art. 146). ' +
        'O enquadramento depende do registro/princípio ativo, não só da NCM.',
      sugestoes: ['200032', '200009', '200053'],
    },
    {
      prefixos: ['2710', '2711', '2207', '3826'],
      titulo: 'Possível combustível (regime monofásico)',
      texto:
        'Combustíveis sujeitos ao regime monofásico (arts. 172 a 180) usam CST 620. ' +
        'Confira se o produto é combustível e a posição na cadeia (produtor, retenção ou já tributado).',
      sugestoes: ['620001', '620002', '620006'],
    },
  ];

  function normalizarNcm(entrada) {
    return String(entrada == null ? '' : entrada).replace(/\D/g, '');
  }

  function formatarNcm(ncm) {
    if (ncm.length !== 8) return ncm;
    return ncm.slice(0, 4) + '.' + ncm.slice(4, 6) + '.' + ncm.slice(6);
  }

  function vigente(v, data) {
    return v[0] <= data && (v[1] == null || data < v[1]);
  }

  function aplicavel(vinculos, ncm, data) {
    var cobrem = vinculos.filter(function (l) {
      return vigente(l.v, data) && ncm.indexOf(l.p) === 0;
    });
    if (cobrem.length === 0) return { aplica: false, casou: [] };
    var excluida = vinculos.some(function (l) {
      return ncm.indexOf(l.p) === 0 && l.e.some(function (e) {
        return ncm.indexOf(e.p) === 0 && vigente(e.v, data);
      });
    });
    var limpo = cobrem.some(function (l) {
      return l.e.length === 0 || l.e.some(function (e) { return !vigente(e.v, data); });
    });
    if (excluida && !limpo) return { aplica: false, casou: [], excluida: true };
    return { aplica: true, casou: cobrem };
  }

  function agrupar(vinculos) {
    var grupos = {};
    vinculos.forEach(function (l) {
      (grupos[l.c] = grupos[l.c] || []).push(l);
    });
    return grupos;
  }

  function detalhar(base, codigo, casou) {
    var ct = base.classTrib[codigo];
    var itens = [];
    (casou || []).forEach(function (l) {
      if (l.i && itens.indexOf(l.i) < 0) itens.push(l.i);
    });
    return {
      cClassTrib: codigo,
      cst: ct.cst,
      descricaoCst: base.cst[ct.cst] || '',
      nome: ct.nome,
      descricao: ct.descricao,
      reducaoCBS: ct.redCBS,
      reducaoIBS: ct.redIBS,
      lc214: ct.lc214,
      url: ct.url,
      prefixos: (casou || []).map(function (l) { return l.p; }).filter(function (p, i, a) {
        return a.indexOf(p) === i;
      }),
      itensAnexo: itens.map(function (i) {
        return { item: i, texto: base.anexos[i] || '' };
      }),
    };
  }

  function criar(base) {
    var grupos = agrupar(base.vinculos);
    var gruposIS = agrupar(base.vinculosIS || []);

    function consultar(entrada, data) {
      var ncm = normalizarNcm(entrada);
      data = data || new Date().toISOString().slice(0, 10);
      if (ncm.length !== 8) {
        return { ok: false, ncm: ncm, erro: 'Informe a NCM completa com 8 dígitos.' };
      }

      var resultados = [];
      var excluidaEm = [];
      Object.keys(grupos).sort().forEach(function (codigo) {
        var ct = base.classTrib[codigo];
        if (!ct || !vigente(ct.v, data)) return;
        var r = aplicavel(grupos[codigo], ncm, data);
        if (r.aplica) resultados.push(detalhar(base, codigo, r.casou));
        else if (r.excluida) excluidaEm.push(codigo);
      });

      var seletivo = Object.keys(gruposIS).some(function (codigo) {
        return aplicavel(gruposIS[codigo], ncm, data).aplica;
      });
      var seletivoFuturo = !seletivo && Object.keys(gruposIS).some(function (codigo) {
        return gruposIS[codigo].some(function (l) { return ncm.indexOf(l.p) === 0; });
      });

      var alertas = ALERTAS.filter(function (a) {
        return a.prefixos.some(function (p) { return ncm.indexOf(p) === 0; });
      }).map(function (a) {
        return {
          titulo: a.titulo,
          texto: a.texto,
          sugestoes: a.sugestoes.filter(function (c) { return base.classTrib[c]; }).map(function (c) {
            return detalhar(base, c, []);
          }),
        };
      });

      return {
        ok: true,
        ncm: ncm,
        ncmFormatada: formatarNcm(ncm),
        data: data,
        tributacaoIntegral: resultados.length === 0,
        resultados: resultados.length ? resultados : [detalhar(base, CLASS_TRIB_PADRAO, [])],
        excluidaEm: excluidaEm,
        impostoSeletivo: seletivo,
        impostoSeletivoFuturo: seletivoFuturo,
        alertas: alertas,
      };
    }

    return { consultar: consultar };
  }

  return { criar: criar, normalizarNcm: normalizarNcm, formatarNcm: formatarNcm };
});
