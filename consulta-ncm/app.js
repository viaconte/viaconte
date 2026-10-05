(function () {
  'use strict';

  var base = window.BASE_REFORMA;
  var consulta = ConsultaNcm.criar(base);
  var form = document.getElementById('form');
  var campoNcm = document.getElementById('ncm');
  var campoData = document.getElementById('data');
  var saida = document.getElementById('resultado');

  // Códigos que só valem para um destinatário ou operação específica.
  var CONDICIONAL = /administra[çc][ãa]o p[úu]blica|órgãos|diferimento|seguran[çc]a da informa/i;

  campoData.value = new Date().toISOString().slice(0, 10);
  document.getElementById('fonte').textContent =
    'Base de dados ' + base.versao + ': ' +
    base.fontes.map(function (f) { return f.titulo + ' (' + f.versao + ')'; }).join('; ') + '.';

  campoNcm.addEventListener('input', function () {
    var d = ConsultaNcm.normalizarNcm(campoNcm.value).slice(0, 8);
    var partes = [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)].filter(Boolean);
    campoNcm.value = partes.join('.');
  });

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var ncm = ConsultaNcm.normalizarNcm(campoNcm.value);
    history.replaceState(null, '', '#' + ncm);
    mostrar(consulta.consultar(ncm, campoData.value));
  });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function reducao(r) {
    if (r.reducaoCBS === r.reducaoIBS) return 'Redução de ' + r.reducaoCBS + '% (CBS e IBS)';
    return 'Redução CBS ' + r.reducaoCBS + '% · IBS ' + r.reducaoIBS + '%';
  }

  function cartao(r, extra) {
    var itens = r.itensAnexo.map(function (i) {
      return '<li><strong>Anexo ' + esc(i.item.replace('/', ', item ')) + ':</strong> ' + esc(i.texto) + '</li>';
    }).join('');
    var lei = r.lc214
      ? (r.url ? '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">LC 214/2025, ' + esc(r.lc214) + '</a>'
               : 'LC 214/2025, ' + esc(r.lc214))
      : '';
    return (
      '<article class="cartao' + (extra ? ' ' + extra : '') + '">' +
        '<div class="codigos">' +
          '<div><span>CST</span><strong>' + esc(r.cst) + '</strong></div>' +
          '<div><span>cClassTrib</span><strong>' + esc(r.cClassTrib) + '</strong></div>' +
          '<button type="button" class="copiar" data-copiar="' + esc(r.cst + ' / ' + r.cClassTrib) + '">Copiar</button>' +
        '</div>' +
        '<h3>' + esc(r.nome) + '</h3>' +
        '<p class="meta">' + esc(r.descricaoCst) + ' · ' + esc(reducao(r)) + (lei ? ' · ' + lei : '') + '</p>' +
        (itens ? '<details><summary>Enquadramento no anexo</summary><ul>' + itens + '</ul></details>' : '') +
      '</article>'
    );
  }

  function mostrar(res) {
    if (!res.ok) {
      saida.innerHTML = '<p class="erro">' + esc(res.erro) + '</p>';
      return;
    }

    var html = '<h2>NCM ' + esc(res.ncmFormatada) + '</h2>';

    if (res.tributacaoIntegral) {
      html += '<p class="aviso">Esta NCM não consta nos anexos de redução da LC 214/2025: regra geral de tributação integral' +
        (res.alertas.length ? ', salvo se enquadrada na situação indicada abaixo' : '') + '.</p>';
      if (res.excluidaEm.length) {
        html += '<p class="aviso">A NCM aparece como <strong>exceção</strong> em ' +
          res.excluidaEm.map(function (c) { return 'cClassTrib ' + esc(c); }).join(', ') + '.</p>';
      }
      html += cartao(res.resultados[0], 'principal');
    } else {
      var gerais = res.resultados.filter(function (r) { return !CONDICIONAL.test(r.nome); });
      var condicionais = res.resultados.filter(function (r) { return CONDICIONAL.test(r.nome); });
      if (res.resultados.length > 1) {
        html += '<p class="aviso">A NCM se enquadra em mais de um tratamento. Escolha conforme a operação e a descrição do produto no anexo.</p>';
      }
      html += gerais.map(function (r) { return cartao(r, 'principal'); }).join('');
      if (condicionais.length) {
        html += '<h3 class="secao">Situações específicas (destinatário ou operação)</h3>' +
          condicionais.map(function (r) { return cartao(r); }).join('');
      }
    }

    res.alertas.forEach(function (a) {
      html += '<div class="alerta"><h3>' + esc(a.titulo) + '</h3><p>' + esc(a.texto) + '</p>' +
        a.sugestoes.map(function (r) { return cartao(r); }).join('') + '</div>';
    });

    if (res.impostoSeletivo) {
      html += '<p class="alerta-is">Produto sujeito também ao <strong>Imposto Seletivo (IS)</strong> nesta data.</p>';
    } else if (res.impostoSeletivoFuturo) {
      html += '<p class="alerta-is">Produto sujeito ao <strong>Imposto Seletivo (IS)</strong> a partir de 2027.</p>';
    }

    saida.innerHTML = html;
  }

  saida.addEventListener('click', function (ev) {
    var botao = ev.target.closest('[data-copiar]');
    if (!botao || !navigator.clipboard) return;
    navigator.clipboard.writeText(botao.getAttribute('data-copiar')).then(function () {
      botao.textContent = 'Copiado';
      setTimeout(function () { botao.textContent = 'Copiar'; }, 1500);
    });
  });

  function consultarHash() {
    var ncm = ConsultaNcm.normalizarNcm(location.hash);
    if (!ncm || ncm === ConsultaNcm.normalizarNcm(campoNcm.value) && saida.innerHTML) return;
    campoNcm.value = ncm;
    campoNcm.dispatchEvent(new Event('input'));
    mostrar(consulta.consultar(ncm, campoData.value));
  }

  window.addEventListener('hashchange', consultarHash);
  consultarHash();
})();
