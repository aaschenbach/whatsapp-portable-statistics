(function () {
  "use strict";
  var GL = window.GLOSS, root = document.getElementById("help");
  var GROUPS = ["Conceitos gerais", "Contatos", "Mensagens", "Tempo de resposta", "Ligações", "Volume e performance"];
  var KIND = { c: "Conceito", k: "Indicador", b: "Gráfico" };

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  var st = null;
  try {
    var o = JSON.parse(localStorage.getItem("stats-settings") || "null");
    if (o && typeof o === "object") st = o;
    var th = localStorage.getItem("stats-theme");
    if (th === "light" || th === "dark") document.documentElement.setAttribute("data-theme", th);
  } catch (e) {}

  // título (minúsculo) -> id, para transformar referências entre aspas em links
  var byTitle = {};
  Object.keys(GL).forEach(function (k) { if (GL[k] && GL[k].t) byTitle[GL[k].t.toLowerCase()] = GL[k].id; });
  var currentId = null;
  function link(t) {
    return t.replace(/"([^"]{3,90})"/g, function (m, name) {
      var id = byTitle[name.toLowerCase()];
      return id && id !== currentId ? '<a class="xref" href="#' + id + '">"' + name + '"</a>' : m;
    });
  }
  function fill(t) { return GL.fill(link(esc(t)), st, true); }
  function list(items, cls) {
    if (!items || !items.length) return "";
    return "<ul>" + items.map(function (x) { return "<li" + (cls ? ' class="' + cls + '"' : "") + ">" + fill(x) + "</li>"; }).join("") + "</ul>";
  }

  var html = "<h1>Como os números são calculados</h1>" +
    '<p class="lead">Explicação de cada indicador e gráfico das Estatísticas de Atendimento, com as regras de cálculo e os pontos de atenção.</p>' +
    '<div class="banner">' + (st
      ? "Os trechos destacados refletem os ajustes salvos neste navegador."
      : "Os trechos destacados mostram os valores padrão. Quando você alterar os Ajustes no painel, esta página passa a refletir os valores salvos neste navegador.") + "</div>";

  html += '<nav class="toc">' + GROUPS.map(function (g, i) { return '<a href="#grp' + i + '">' + esc(g) + "</a>"; }).join("") + "</nav>";

  GROUPS.forEach(function (g, i) {
    html += '<h2 class="grp" id="grp' + i + '">' + esc(g) + "</h2>";
    Object.keys(GL).forEach(function (k) {
      var e = GL[k];
      if (!e || !e.t || e.g !== g) return;
      currentId = e.id;
      html += '<article id="' + esc(e.id) + '"><h3>' + esc(e.t) + '<span class="tag">' + KIND[e.k] + "</span></h3>" +
        '<p class="s">' + fill(e.s) + "</p>" +
        (e.h ? "<h4>Como é calculado</h4>" + list(e.h) : "") +
        (e.d ? "<h4>Depende dos ajustes</h4>" + list(e.d) : "") +
        (e.w ? "<h4>Atenção</h4>" + list(e.w, "warn") : "") + "</article>";
    });
  });
  root.innerHTML = html;

  if (location.hash) {
    var t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (t) t.scrollIntoView();
  }
})();
