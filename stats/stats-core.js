(function () {
  "use strict";
  var ST = window.ST = {};

  var MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  var DOW = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  var DOWFULL = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  ST.DOW = DOW;
  ST.CATS = [
    { k: "t", n: "Texto" }, { k: "i", n: "Imagem" }, { k: "d", n: "Documento" },
    { k: "a", n: "Áudio" }, { k: "v", n: "Vídeo" }, { k: "s", n: "Figurinha" }, { k: "o", n: "Outros" }
  ];

  var chats = ST.chats = [];
  ST.calls = [];
  ST.autoStats = { sent: 0, recv: 0 };

  // ---------- datas ----------
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  ST.pad = pad;
  function bucketStart(t, g) {
    var d = new Date(t), y = d.getFullYear(), m = d.getMonth();
    switch (g) {
      case "day": return new Date(y, m, d.getDate()).getTime();
      case "week": return new Date(y, m, d.getDate() - ((d.getDay() + 6) % 7)).getTime();
      case "month": return new Date(y, m, 1).getTime();
      case "quarter": return new Date(y, Math.floor(m / 3) * 3, 1).getTime();
      case "semester": return new Date(y, m < 6 ? 0 : 6, 1).getTime();
      default: return new Date(y, 0, 1).getTime();
    }
  }
  function nextBucket(t, g) {
    var d = new Date(t), y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
    switch (g) {
      case "day": return new Date(y, m, day + 1).getTime();
      case "week": return new Date(y, m, day + 7).getTime();
      case "month": return new Date(y, m + 1, 1).getTime();
      case "quarter": return new Date(y, m + 3, 1).getTime();
      case "semester": return new Date(y, m + 6, 1).getTime();
      default: return new Date(y + 1, 0, 1).getTime();
    }
  }
  function bucketLabel(t, g) {
    var d = new Date(t), yy = String(d.getFullYear()).slice(2), m = d.getMonth();
    switch (g) {
      case "day": return pad(d.getDate()) + "/" + pad(m + 1) + "/" + yy;
      case "week": return "Sem " + pad(d.getDate()) + "/" + pad(m + 1) + "/" + yy;
      case "month": return MES[m] + "/" + yy;
      case "quarter": return (Math.floor(m / 3) + 1) + "T/" + yy;
      case "semester": return (m < 6 ? 1 : 2) + "S/" + yy;
      default: return String(d.getFullYear());
    }
  }
  ST.startOfDay = function (t) { var d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  ST.endOfDay = function (t) { var d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - 1; };
  ST.fmtDate = function (t) { var d = new Date(t); return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear(); };
  ST.inputDate = function (t) { var d = new Date(t); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  ST.parseInputDate = function (s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]).getTime(); };

  // ---------- formatos ----------
  ST.fmtInt = function (v) { return v == null ? "—" : Math.round(v).toLocaleString("pt-BR"); };
  ST.fmtDec = function (v) { return v == null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }); };
  ST.fmtPct = function (v) { return v == null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%"; };
  ST.fmtDur = function (s) {
    if (s == null) return "—";
    if (s < 60) return Math.round(s) + " s";
    if (s < 3600) { var m = s / 60; return (m < 10 ? Math.round(m * 10) / 10 : Math.round(m)).toLocaleString("pt-BR") + " min"; }
    if (s < 86400) { var h = Math.floor(s / 3600), mi = Math.round((s - h * 3600) / 60); if (mi === 60) { h++; mi = 0; } return h + " h" + (mi ? " " + mi + " min" : ""); }
    var d = Math.floor(s / 86400), hh = Math.round((s - d * 86400) / 3600);
    if (hh === 24) { d++; hh = 0; }
    return d + " d" + (hh ? " " + hh + " h" : "");
  };
  ST.FMT = { int: ST.fmtInt, dur: ST.fmtDur, pct: ST.fmtPct, dec: ST.fmtDec };

  // ---------- feriados (São Paulo / SP / Brasil) ----------
  function easter(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
      l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
    return { m: mo - 1, d: da };
  }
  var holCache = {};
  function holidayList(y) {
    if (holCache[y]) return holCache[y];
    var list = [], e = easter(y);
    function add(m, d, name, type, esc) { list.push({ t: new Date(y, m, d).getTime(), name: name, type: type, esc: esc }); }
    function rel(n, name, type, esc) { var x = new Date(y, e.m, e.d + n); add(x.getMonth(), x.getDate(), name, type, esc); }
    add(0, 1, "Confraternização Universal", "feriado", "Nacional");
    add(0, 25, "Aniversário de São Paulo", "feriado", "Municipal (São Paulo)");
    rel(-48, "Carnaval (segunda-feira)", "facultativo", "Ponto facultativo");
    rel(-47, "Carnaval (terça-feira)", "facultativo", "Ponto facultativo");
    rel(-46, "Quarta-feira de Cinzas (até 14h)", "facultativo", "Ponto facultativo");
    rel(-2, "Sexta-feira Santa", "feriado", "Nacional");
    add(3, 21, "Tiradentes", "feriado", "Nacional");
    add(4, 1, "Dia do Trabalho", "feriado", "Nacional");
    rel(60, "Corpus Christi", "facultativo", "Ponto facultativo");
    add(6, 9, "Revolução Constitucionalista", "feriado", "Estadual (SP)");
    add(8, 7, "Independência do Brasil", "feriado", "Nacional");
    add(9, 12, "Nossa Senhora Aparecida", "feriado", "Nacional");
    add(10, 2, "Finados", "feriado", "Nacional");
    add(10, 15, "Proclamação da República", "feriado", "Nacional");
    add(10, 20, "Consciência Negra", "feriado", y >= 2024 ? "Nacional" : "Municipal (São Paulo)");
    add(11, 25, "Natal", "feriado", "Nacional");
    list.sort(function (a, b) { return a.t - b.t; });
    return (holCache[y] = list);
  }
  ST.holidayYears = function () {
    var a = new Date(ST.minT).getFullYear(), b = Math.max(new Date(ST.maxT).getFullYear(), new Date().getFullYear()), ys = [];
    for (var y = a; y <= b; y++) ys.push(y);
    return ys;
  };
  ST.holidays = function (years) {
    var out = [];
    years.forEach(function (y) { out = out.concat(holidayList(y)); });
    return out;
  };
  function holidayAt(y, mo, da, opt) {
    var l = holidayList(y);
    for (var i = 0; i < l.length; i++) {
      var d = new Date(l[i].t);
      if (d.getMonth() === mo && d.getDate() === da) return l[i].type === "feriado" || !!opt;
    }
    return false;
  }
  ST.dowFull = function (t) { return DOWFULL[new Date(t).getDay()]; };

  // ---------- contexto de dias / horário de atendimento ----------
  var ctxCache = {};
  ST.ctx = function (o) {
    var key = [o.exSat ? 1 : 0, o.exSun ? 1 : 0, o.exHol ? 1 : 0, o.optHol ? 1 : 0, o.bizDays.map(Number).join(""), o.bizFrom, o.bizTo].join("|");
    if (ctxCache.key === key) return ctxCache.val;
    var cache = new Map(), anyEx = !!(o.exSat || o.exSun || o.exHol);
    function flags(t) {
      var d = new Date(t), y = d.getFullYear(), mo = d.getMonth(), da = d.getDate(), k = y * 10000 + mo * 100 + da, f = cache.get(k);
      if (!f) {
        var dow = d.getDay(), hol = holidayAt(y, mo, da, o.optHol);
        f = { ex: !!((o.exSat && dow === 6) || (o.exSun && dow === 0) || (o.exHol && hol)), bd: !!o.bizDays[dow] && !hol };
        cache.set(k, f);
      }
      return f;
    }
    var ctx = {
      ex: function (t) { return anyEx && flags(t).ex; },
      inH: function (t) { var f = flags(t), h = new Date(t).getHours(); return f.bd && h >= o.bizFrom && h < o.bizTo; },
      valid: function (t0, t1, biz) {
        if (t1 <= t0) return 0;
        if (!biz && !anyEx) return (t1 - t0) / 1000;
        var d0 = new Date(t0), Y = d0.getFullYear(), M = d0.getMonth(), D = d0.getDate(), total = 0;
        for (var i = 0; ; i++) {
          var ds = new Date(Y, M, D + i).getTime();
          if (ds >= t1) break;
          var de = new Date(Y, M, D + i + 1).getTime(), f = flags(ds + 43200000);
          if (f.ex) continue;
          var a = ds, b = de;
          if (biz) {
            if (!f.bd) continue;
            a = new Date(Y, M, D + i, o.bizFrom).getTime();
            b = o.bizTo >= 24 ? de : new Date(Y, M, D + i, o.bizTo).getTime();
          }
          var lo = Math.max(a, t0), hi = Math.min(b, t1);
          if (hi > lo) total += (hi - lo) / 1000;
        }
        return total;
      }
    };
    ctxCache = { key: key, val: ctx };
    return ctx;
  };

  // ---------- carga ----------
  function finalize(failed) {
    chats.sort(function (a, b) { return a.first - b.first; });
    var byId = ST.chatById = new Map();
    chats.forEach(function (c) { byId.set(c.id, c); });
    ST.callsByChat = new Map();
    ST.calls.sort(function (a, b) { return a.t - b.t; });
    ST.calls.forEach(function (k) { var l = ST.callsByChat.get(k.id); if (!l) ST.callsByChat.set(k.id, l = []); l.push(k); });
    var sent = 0, recv = 0;
    chats.forEach(function (c) { if (!c.g) c.msgs.forEach(function (x) { if (x[5]) { if (x[1]) sent++; else recv++; } }); });
    ST.autoStats = { sent: sent, recv: recv };
    ST.minT = chats.length ? chats[0].first : Date.now();
    ST.maxT = 0;
    chats.forEach(function (c) { var l = c.msgs[c.msgs.length - 1][0]; if (l > ST.maxT) ST.maxT = l; });
    ST.calls.forEach(function (k) { if (k.t > ST.maxT) ST.maxT = k.t; if (k.t < ST.minT) ST.minT = k.t; });
    ST.failed = failed;
  }

  // Carrega o arquivo único gerado por scripts/anonimizar.py (dados/estatisticas.js).
  // v:1 — msg = [t, m(0 recebida/1 enviada), categoria, 0, encerramento, automática]
  // v:2 — igual v:1, mais campo ori por chat (canal de origem identificado na 1ª mensagem recebida)
  ST.load = function (onProgress) {
    return new Promise(function (resolve, reject) {
      var D = window.STATS_DATA;
      if (!D || (D.v !== 1 && D.v !== 2) || !D.chats) { reject(new Error("arquivo de dados ausente ou em formato desconhecido")); return; }
      var codes = D.cats;
      var origins = (D.v === 2 && Array.isArray(D.origins) && D.origins.length > 0) ? D.origins : null;
      ST.hasOrigins = !!origins;
      D.chats.forEach(function (c, ci) {
        var msgs, ad, oriLabel;
        if (D.v === 2) {
          if (!c[3].length) return;
          ad = !!c[1];
          oriLabel = (origins && c[2] >= 0) ? origins[c[2]] : null;
          msgs = c[3];
        } else {
          if (!c[2].length) return;
          ad = !!c[1];
          oriLabel = null;
          msgs = c[2];
        }
        var arr = msgs.map(function (r) { var f = r[1]; return [r[0], (f >> 5) & 1, codes.charAt(f & 7), 0, (f >> 3) & 1, (f >> 4) & 1]; });
        chats.push({ id: ci, g: c[0], msgs: arr, first: arr[0][0], fm: arr[0][1], ad: ad, ori: oriLabel });
      });
      D.calls.forEach(function (k) { ST.calls.push({ t: k[0], m: k[1], v: k[2], d: k[3], g: k[4], id: k[5] }); });
      window.STATS_DATA = null;
      onProgress(1, 1);
      finalize(0);
      resolve();
    });
  };

  // ---------- tempos de resposta ----------
  var respCache = {};
  var DAY24 = 86400000;

  // our/con: [t, secs, ci, secsHorarioAtendimento, chegouEmHorario]; frt idem
  // unans/noreply: [t, ci, emHorario]; closed: [t, ci]
  ST.responses = function (o) {
    var key = [o.cap, o.biz, o.bizFrom, o.bizTo, o.exSat, o.exSun, o.exHol, o.optHol, o.bizDays.map(Number).join(""), o.noAuto, o.closing].join("|");
    if (respCache.key === key) return respCache.val;
    var R = { our: [], con: [], frt: [], unans: [], noreply: [], closed: [] };
    var ctx = ST.ctx(o);
    function secs(t0, t1) { return ctx.valid(t0, t1, o.biz); }
    chats.forEach(function (c, ci) {
      if (c.g) return;
      var pend = null, pendIn = false, pendOut = null, started = -1, firstDone = false, lastIn = null;
      for (var i = 0; i < c.msgs.length; i++) {
        var x = c.msgs[i];
        if (o.noAuto && x[5]) continue;
        var t = x[0], cl = o.closing && x[4];
        if (started < 0) started = x[1] ? 1 : 0;
        if (x[1] === 0) {
          if (pendOut !== null) {
            var s1 = secs(pendOut, t);
            if (!ctx.ex(t) && (!o.cap || s1 <= o.cap)) R.con.push([t, s1, ci, ctx.valid(pendOut, t, true), false]);
            pendOut = null;
          }
          if (pend === null && !cl) { pend = t; pendIn = ctx.inH(t); }
          lastIn = { t: t, cl: !!cl };
        } else {
          if (pend !== null) {
            var s2 = secs(pend, t);
            if (!ctx.ex(t) && (!o.cap || s2 <= o.cap)) {
              var ev = [t, s2, ci, ctx.valid(pend, t, true), pendIn];
              R.our.push(ev);
              if (started === 0 && !firstDone) R.frt.push(ev);
            }
            firstDone = true; pend = null;
          }
          if (pendOut === null && !cl) pendOut = t;
          lastIn = null;
        }
      }
      if (pend !== null) R.unans.push([pend, ci, pendIn]);
      if (pendOut !== null) R.noreply.push([pendOut, ci]);
      if (pend === null && lastIn && lastIn.cl) R.closed.push([lastIn.t, ci]);
    });
    respCache = { key: key, val: R };
    return R;
  };

  // ---------- agregação ----------
  function stats(a) {
    var n = a.length;
    if (!n) return { n: 0, mean: null, med: null, p90: null };
    var s = a.slice().sort(function (x, y) { return x - y; }), sum = 0;
    for (var i = 0; i < n; i++) sum += s[i];
    function q(p) { var k = (n - 1) * p, f = Math.floor(k), c = Math.min(f + 1, n - 1); return s[f] + (s[c] - s[f]) * (k - f); }
    return { n: n, mean: sum / n, med: q(0.5), p90: q(0.9) };
  }
  ST.stats = stats;

  var BINS = [
    ["Até 1 min", 60], ["1–5 min", 300], ["5–15 min", 900], ["15–60 min", 3600],
    ["1–4 h", 14400], ["4–24 h", 86400], ["Mais de 24 h", Infinity]
  ];
  ST.BINS = BINS;
  var DEPTH = [["1 msg", 1], ["2–5", 5], ["6–20", 20], ["21–100", 100], ["Mais de 100", Infinity]];
  ST.DEPTH = DEPTH;

  function zeros(n) { var a = new Array(n); for (var i = 0; i < n; i++) a[i] = 0; return a; }
  function catArrays(n) { var o = { tot: zeros(n) }; ST.CATS.forEach(function (c) { o[c.k] = zeros(n); }); return o; }
  function matrix(r, c) { var m = []; for (var i = 0; i < r; i++) m.push(zeros(c)); return m; }

  ST.aggregate = function (from, to, g, scope, o) {
    var starts = [], s = bucketStart(from, g);
    while (s <= to) { starts.push(s); s = nextBucket(s, g); }
    var nb = starts.length, map = new Map(), ctx = ST.ctx(o);
    starts.forEach(function (v, i) { map.set(v, i); });
    function idx(t) { return map.get(bucketStart(t, g)); }
    // intervalos das pontas podem cobrir só parte do mês/semana/etc.
    var partial = [], span = [], tlabels = [], labels = [];
    starts.forEach(function (v) {
      var nx = nextBucket(v, g), lo = Math.max(v, from), hi = Math.min(nx - 1, to), p = lo > v || hi < nx - 1;
      var dl = new Date(lo), dh = new Date(hi), same = dl.getMonth() === dh.getMonth() && dl.getFullYear() === dh.getFullYear();
      var rl = same ? pad(dl.getDate()) + "–" + pad(dh.getDate()) : pad(dl.getDate()) + "/" + pad(dl.getMonth() + 1) + "–" + pad(dh.getDate()) + "/" + pad(dh.getMonth() + 1);
      partial.push(p);
      span.push(Math.round((ST.startOfDay(hi) - ST.startOfDay(lo)) / 86400000) + 1);
      tlabels.push(bucketLabel(v, g) + (p ? " (" + rl + ")" : ""));
      labels.push(bucketLabel(v, g) + (p ? "*" : ""));
    });
    var A = {
      from: from, to: to, g: g, starts: starts, nb: nb,
      labels: labels, tlabels: tlabels, partial: partial, span: span,
      recv: catArrays(nb), sent: catArrays(nb),
      recvOoh: zeros(nb), sentOoh: zeros(nb), newOoh: zeros(nb),
      newC: zeros(nb), newIn: zeros(nb), newOut: zeros(nb), newAd: zeros(nb), active: zeros(nb), activeNew: zeros(nb), activeRec: zeros(nb), recurring: 0,
      heat: { recv: matrix(7, 24), sent: matrix(7, 24) },
      depth: zeros(DEPTH.length), uniq: 0, base0: 0, baseNew: 0
    };
    // origens de contato (só presentes quando dados gerados com --origens)
    var oriLabels = [];
    if (ST.hasOrigins) {
      chats.forEach(function (c) { if (!c.g && c.ori && oriLabels.indexOf(c.ori) < 0) oriLabels.push(c.ori); });
    }
    A.oriLabels = oriLabels;
    A.newOri = {};
    oriLabels.forEach(function (k) { A.newOri[k] = zeros(nb); });
    A.newOriKnown = zeros(nb);
    A.newOriUnkn = zeros(nb);
    A.hasOriData = ST.hasOrigins;
    var inScope = function (c) { return scope === "all" || (scope === "ind" ? !c.g : !!c.g); };
    function keep(x) { return !(o.noAuto && x[5]) && !ctx.ex(x[0]); }

    chats.forEach(function (c) {
      if (!inScope(c)) return;
      var ms = c.msgs, fi = -1, i;
      // contato novo é novo na data real da 1ª mensagem; só automáticas desconsideradas são ignoradas, dias desconsiderados não
      for (i = 0; i < ms.length; i++) if (!(o.noAuto && ms[i][5])) { fi = i; break; }
      if (fi < 0) return;
      var first = ms[fi][0], fm = ms[fi][1], fb = -1;
      if (first < from) A.base0++;
      else if (first <= to) {
        var b = fb = idx(first);
        A.newC[b]++; A.baseNew++;
        if (fm === 0) A.newIn[b]++; else A.newOut[b]++;
        if (c.ad) A.newAd[b]++;
        if (ST.hasOrigins) {
          if (c.ori) { A.newOri[c.ori][b]++; A.newOriKnown[b]++; }
          else        { A.newOriUnkn[b]++; }
        }
        if (!ctx.inH(first)) A.newOoh[b]++;
      }
      var lastB = -1, cnt = 0;
      for (i = fi; i < ms.length; i++) {
        var mm = ms[i], t = mm[0];
        if (t < from) continue;
        if (t > to) break;
        if (!keep(mm)) continue;
        var bi = idx(t), side = mm[1] ? A.sent : A.recv;
        side[mm[2]][bi]++; side.tot[bi]++;
        var d = new Date(t);
        A.heat[mm[1] ? "sent" : "recv"][(d.getDay() + 6) % 7][d.getHours()]++;
        if (!ctx.inH(t)) { if (mm[1]) A.sentOoh[bi]++; else A.recvOoh[bi]++; }
        if (bi !== lastB) { A.active[bi]++; if (bi === fb) A.activeNew[bi]++; else A.activeRec[bi]++; lastB = bi; }
        cnt++;
      }
      if (cnt) {
        A.uniq++;
        if (first < from) A.recurring++;
        for (var k = 0; k < DEPTH.length; k++) if (cnt <= DEPTH[k][1]) { A.depth[k]++; break; }
      }
    });

    var cum = A.base0; A.baseCum = A.newC.map(function (v) { cum += v; return cum; });
    A.base = A.baseCum.length ? A.baseCum[A.baseCum.length - 1] : A.base0;

    // respostas (somente conversas individuais)
    var R = ST.responses(o), useResp = scope !== "grp";
    function bucketize(list, pickFn, filt) {
      var per = []; for (var i = 0; i < nb; i++) per.push([]);
      var all = [];
      if (useResp) list.forEach(function (e) {
        if (e[0] < from || e[0] > to || (filt && !filt(e))) return;
        var v = pickFn(e); per[idx(e[0])].push(v); all.push(v);
      });
      return { per: per.map(stats), all: stats(all), raw: all };
    }
    function sec(e) { return e[1]; }
    function bsec(e) { return e[3]; }
    var our = bucketize(R.our, sec), con = bucketize(R.con, sec), frt = bucketize(R.frt, sec);
    A.our = our.per; A.ourAll = our.all; A.con = con.per; A.conAll = con.all;
    A.frt = frt.per; A.frtAll = frt.all;
    var ourIn = bucketize(R.our, bsec, function (e) { return e[4]; });
    var ourOut = bucketize(R.our, bsec, function (e) { return !e[4]; });
    A.ourIn = ourIn.per; A.ourInAll = ourIn.all; A.ourOut = ourOut.per; A.ourOutAll = ourOut.all;
    function bins(raw) {
      var b = zeros(BINS.length);
      raw.forEach(function (v) { for (var k = 0; k < BINS.length; k++) if (v <= BINS[k][1]) { b[k]++; break; } });
      return b;
    }
    A.binsOur = bins(our.raw); A.binsCon = bins(con.raw);
    var slaSec = o.sla * 60, ok = 0;
    our.raw.forEach(function (v) { if (v <= slaSec) ok++; });
    A.slaPct = our.raw.length ? ok / our.raw.length * 100 : null;

    // pendências (apenas as com mais de 24 h contam como "sem resposta")
    A.unans = 0; A.unansRecent = 0; A.noreply = 0; A.noreplyRecent = 0; A.closedN = 0; A.unansOoh = 0;
    if (useResp) {
      R.unans.forEach(function (e) {
        if (e[0] < from || e[0] > to || ctx.ex(e[0])) return;
        if (ST.maxT - e[0] >= DAY24) { A.unans++; if (!e[2]) A.unansOoh++; } else A.unansRecent++;
      });
      R.noreply.forEach(function (e) {
        if (e[0] < from || e[0] > to || ctx.ex(e[0])) return;
        if (ST.maxT - e[0] >= DAY24) A.noreply++; else A.noreplyRecent++;
      });
      R.closed.forEach(function (e) { if (e[0] >= from && e[0] <= to && !ctx.ex(e[0])) A.closedN++; });
    }

    // dia da semana / hora
    A.dow = { recv: zeros(7), sent: zeros(7) }; A.hod = { recv: zeros(24), sent: zeros(24) };
    ["recv", "sent"].forEach(function (k) {
      for (var r = 0; r < 7; r++) for (var h = 0; h < 24; h++) { A.dow[k][r] += A.heat[k][r][h]; A.hod[k][h] += A.heat[k][r][h]; }
    });
    var tr = 0, ts = 0, orr = 0, ors = 0;
    A.recv.tot.forEach(function (v) { tr += v; }); A.sent.tot.forEach(function (v) { ts += v; });
    A.recvOoh.forEach(function (v) { orr += v; }); A.sentOoh.forEach(function (v) { ors += v; });
    A.totRecv = tr; A.totSent = ts; A.totRecvOoh = orr; A.totSentOoh = ors;
    A.totNewOoh = 0; A.newOoh.forEach(function (v) { A.totNewOoh += v; });

    // ligações
    var C = A.calls = {
      n: 0, inN: 0, outN: 0, ans: 0, missedIn: 0, noAnsOut: 0, video: 0, voice: 0, durSum: 0, ooh: 0,
      inAns: zeros(nb), inMiss: zeros(nb), outAns: zeros(nb), outNo: zeros(nb), videoB: zeros(nb), voiceB: zeros(nb),
      durB: zeros(nb), ansB: zeros(nb), totB: zeros(nb), oohB: zeros(nb), ret: [], retN: 0, unret: 0
    };
    ST.calls.forEach(function (k) {
      if (k.t < from || k.t > to || ctx.ex(k.t)) return;
      if (!(scope === "all" || (scope === "ind" ? !k.g : !!k.g))) return;
      var bi = idx(k.t), answered = k.d > 0;
      C.n++; C.totB[bi]++;
      if (k.m) { C.outN++; if (answered) C.outAns[bi]++; else { C.outNo[bi]++; C.noAnsOut++; } }
      else { C.inN++; if (answered) C.inAns[bi]++; else { C.inMiss[bi]++; C.missedIn++; } }
      if (answered) { C.ans++; C.ansB[bi]++; C.durSum += k.d; C.durB[bi] += k.d; }
      if (k.v) { C.video++; C.videoB[bi]++; } else { C.voice++; C.voiceB[bi]++; }
      if (!ctx.inH(k.t)) { C.ooh++; C.oohB[bi]++; }
      if (!k.m && !answered && !k.g) {
        // tempo até a nossa próxima iniciativa (mensagem ou ligação) para o mesmo contato
        var next = null, ch = ST.chatById.get(k.id), j;
        if (ch) for (j = 0; j < ch.msgs.length; j++) { var x = ch.msgs[j]; if (x[0] > k.t && x[1] === 1 && !(o.noAuto && x[5])) { next = x[0]; break; } }
        var cl = ST.callsByChat.get(k.id) || [];
        for (j = 0; j < cl.length; j++) if (cl[j].t > k.t && cl[j].m === 1) { if (next === null || cl[j].t < next) next = cl[j].t; break; }
        if (next !== null) {
          var sv = ctx.valid(k.t, next, o.biz);
          if (!o.cap || sv <= o.cap) C.ret.push(sv); else C.unret++;
        } else C.unret++;
      }
    });
    C.retN = C.ret.length; C.retStats = stats(C.ret);
    C.durAvg = C.ans ? C.durSum / C.ans : null;
    C.durAvgB = C.durB.map(function (v, i) { return C.ansB[i] ? v / C.ansB[i] : null; });
    return A;
  };

  ST.holidayTable = function (o) {
    var rows = ST.holidays(ST.holidayYears()).map(function (h) {
      var used = h.type === "feriado" ? !!o.exHol : (!!o.exHol && !!o.optHol);
      return [ST.fmtDate(h.t), DOWFULL[new Date(h.t).getDay()], h.name, h.type === "feriado" ? "Feriado" : "Ponto facultativo", h.esc,
        h.type === "feriado" || o.optHol ? "Fora do horário de atendimento" + (used ? "; dia desconsiderado" : "") : "Dia normal"];
    });
    return { name: "Feriados (SP)", head: [{ h: "Data", kind: "text" }, { h: "Dia", kind: "text" }, { h: "Nome", kind: "text" }, { h: "Tipo", kind: "text" }, { h: "Âmbito", kind: "text" }, { h: "Tratamento atual", kind: "text" }], rows: rows, foot: null };
  };

  // ---------- períodos ----------
  ST.presetRange = function (p, now) {
    var d = new Date(now), y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
    var today = new Date(y, m, day).getTime(), end = ST.endOfDay(today);
    switch (p) {
      case "today": return [today, end];
      case "7d": return [new Date(y, m, day - 6).getTime(), end];
      case "30d": return [new Date(y, m, day - 29).getTime(), end];
      case "90d": return [new Date(y, m, day - 89).getTime(), end];
      case "mtd": return [new Date(y, m, 1).getTime(), end];
      case "lastm": return [new Date(y, m - 1, 1).getTime(), new Date(y, m, 1).getTime() - 1];
      case "qtd": return [new Date(y, Math.floor(m / 3) * 3, 1).getTime(), end];
      case "std": return [new Date(y, m < 6 ? 0 : 6, 1).getTime(), end];
      case "ytd": return [new Date(y, 0, 1).getTime(), end];
      case "all": return [ST.startOfDay(ST.minT), end];
    }
    return null;
  };

  ST.autoGran = function (from, to) {
    var days = (to - from) / 86400000;
    if (days <= 35) return "day";
    if (days <= 150) return "week";
    if (days <= 800) return "month";
    return "quarter";
  };

  // Ajusta o período para conter apenas intervalos completos (mês, semana, trimestre...) já encerrados.
  ST.closeRange = function (from, to, g) {
    if (g === "day") return [from, to];
    var s = bucketStart(from, g);
    if (s < from) s = nextBucket(s, g);
    var lim = Math.min(to, Date.now()), cur = bucketStart(lim, g);
    var last = nextBucket(cur, g) - 1 <= lim ? cur : bucketStart(cur - 1, g);
    if (last < s) return null;
    return [s, nextBucket(last, g) - 1];
  };

  ST.compareRange = function (from, to, mode) {
    if (mode === "none") return null;
    var f = new Date(from), t = new Date(to);
    if (mode === "yoy") {
      return [new Date(f.getFullYear() - 1, f.getMonth(), f.getDate()).getTime(),
        ST.endOfDay(new Date(t.getFullYear() - 1, t.getMonth(), t.getDate()).getTime())];
    }
    var lastDayOfMonth = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    if (f.getDate() === 1 && t.getDate() === lastDayOfMonth) {
      var k = (t.getFullYear() - f.getFullYear()) * 12 + (t.getMonth() - f.getMonth()) + 1;
      return [new Date(f.getFullYear(), f.getMonth() - k, 1).getTime(),
        new Date(f.getFullYear(), f.getMonth(), 1).getTime() - 1];
    }
    if (f.getDate() === 1 && f.getMonth() === 0 && f.getFullYear() === t.getFullYear()) {
      return [new Date(f.getFullYear() - 1, 0, 1).getTime(),
        ST.endOfDay(new Date(t.getFullYear() - 1, t.getMonth(), t.getDate()).getTime())];
    }
    if (f.getDate() === 1 && f.getMonth() === t.getMonth() && f.getFullYear() === t.getFullYear()) {
      var pm = new Date(f.getFullYear(), f.getMonth() - 1, 1), pl = new Date(f.getFullYear(), f.getMonth(), 0).getDate();
      return [pm.getTime(), ST.endOfDay(new Date(pm.getFullYear(), pm.getMonth(), Math.min(t.getDate(), pl)).getTime())];
    }
    var len = to - from + 1;
    return [from - len, from - 1];
  };
})();
