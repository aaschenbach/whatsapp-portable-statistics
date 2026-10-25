(function () {
  "use strict";
  var ST = window.ST, $ = function (id) { return document.getElementById(id); };
  var FMT = ST.FMT, sum = ST.sum;

  // ---------- tema ----------
  var TH = {
    light: { ink: "#0b0b0b", ink2: "#52514e", muted: "#898781", grid: "#e1e0d9", axis: "#c3c2b7", surface: "#fcfcfb",
      s: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"],
      ord: ["#86b6ef", "#6da7ec", "#5598e7", "#2a78d6", "#256abf", "#1c5cab", "#184f95"] },
    dark: { ink: "#f0efec", ink2: "#c3c2b7", muted: "#898781", grid: "#2c2c2a", axis: "#383835", surface: "#1a1a19",
      s: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
      ord: ["#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#1c5cab", "#184f95"] }
  };
  function mode() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t) return t;
    return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function colorOf(tok, th) { return tok === "muted" ? th.muted : th.s[+tok.slice(1) - 1]; }
  function alpha(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }
  function ordinal(n, th) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(th.ord[Math.round(i * (th.ord.length - 1) / Math.max(1, n - 1))]);
    return out;
  }

  // ---------- estado ----------
  var S = { preset: "90d", from: 0, to: 0, gran: "week", granAuto: true, cmp: "none", scope: "ind",
    cap: 86400, biz: false, bizFrom: 8, bizTo: 18, bizDays: [false, true, true, true, true, true, false], sla: 15,
    exSat: true, exSun: true, exHol: true, optHol: true, noAuto: true, closing: true, closed: false,
    tab: "overview", kinds: {}, tables: {}, heat: "recv" };
  var SAVED = ["gran", "granAuto", "cmp", "scope", "cap", "biz", "bizFrom", "bizTo", "bizDays", "sla", "exSat", "exSun", "exHol", "optHol", "noAuto", "closing", "closed"];
  var A, B, charts = [], VIEWS = {};
  var TABS = { overview: "Visão geral", contacts: "Contatos", recv: "Mensagens recebidas", sent: "Mensagens enviadas", resp: "Tempo de resposta", calls: "Ligações", perf: "Volume e performance" };
  var KIND_LABEL = { bar: "Barras", stack: "Empilhado", line: "Linhas", area: "Área", donut: "Rosca" };

  // ---------- especificações ----------
  function ser(name, tok, data, prev) {
    return { name: name, color: tok, data: data, prev: prev || null, total: sum(data), ptotal: prev ? sum(prev) : null };
  }
  function respSeries(a, b, pick) {
    return function (key) { return a.map(function (x) { return x[key]; }); };
  }
  function spec(o) {
    o.cmp = !!B; o.plabels = B ? o.plabels : null;
    if (o.labels === A.labels) {
      o.tlabels = A.tlabels;
      o.hasPartial = A.partial.some(Boolean) || !!(B && B.partial.some(Boolean));
      if (B) o.noDelta = A.partial.map(function (p, i) { return (p || B.partial[i]) && A.span[i] !== B.span[i]; });
    }
    return o;
  }
  var TS_KINDS = ["bar", "line", "area"];

  function catSeries(dir) {
    return ST.CATS.map(function (c, i) {
      return ser(c.n, i === 6 ? "muted" : "s" + (i + 1), A[dir][c.k], B ? B[dir][c.k] : null);
    });
  }
  function pick(list, key) { return list.map(function (x) { return x[key]; }); }
  function respSpec(id, title, sub, lst, all, plst, pall, good, withN) {
    var cur = pick(lst, "mean");
    return spec({
      id: id, title: title, sub: sub, labels: A.labels, plabels: B && B.tlabels, fmt: "dur", sum: false, stackable: false,
      kinds: TS_KINDS, def: "line", good: good, footLabel: "Geral",
      series: [
        { name: "Média", color: "s1", data: cur, prev: plst ? pick(plst, "mean") : null, total: all.mean, ptotal: pall ? pall.mean : null },
        { name: "Mediana", color: "s2", data: pick(lst, "med"), prev: plst ? pick(plst, "med") : null, total: all.med, ptotal: pall ? pall.med : null }
      ],
      extra: [
        { name: "P90", fmt: "dur", data: pick(lst, "p90"), foot: all.p90 },
        { name: "Respostas", fmt: "int", data: pick(lst, "n"), foot: all.n }
      ]
    });
  }
  function hourLabels() { var a = []; for (var h = 0; h < 24; h++) a.push(ST.pad(h) + "h"); return a; }

  function K(label, cur, prev, fmt, good, spark, hint) {
    return { label: label, cur: cur, prev: B ? prev : null, fmt: fmt, good: good, spark: spark || null, hint: hint || "" };
  }
  function pk(x, k, f) { return x ? f(x[k]) : null; }

  function buildViews() {
    var b = B, kp = {};
    function bsum(f) { return b ? f(b) : null; }
    var newIn = sum(A.newIn), newOut = sum(A.newOut), newAd = sum(A.newAd);
    kp.uniq = K("Contatos únicos ativos", A.uniq, bsum(function (x) { return x.uniq; }), "int", 0, A.active, "com mensagens no período");
    kp.base = K("Base acumulada de contatos", A.base, bsum(function (x) { return x.base; }), "int", 0, A.baseCum, "desde a 1ª mensagem do backup");
    kp.novos = K("Contatos novos", A.baseNew, bsum(function (x) { return x.baseNew; }), "int", 0, A.newC, "pela 1ª mensagem enviada/recebida");
    kp.novosIn = K("Novos iniciados pelo contato", newIn, bsum(function (x) { return sum(x.newIn); }), "int", 0, A.newIn);
    kp.novosOut = K("Novos iniciados por nós", newOut, bsum(function (x) { return sum(x.newOut); }), "int", 0, A.newOut);
    kp.novosAd = K("Novos via anúncio", newAd, bsum(function (x) { return sum(x.newAd); }), "int", 0, A.newAd, A.baseNew ? FMT.pct(newAd / A.baseNew * 100) + " dos novos" : "");
    if (A.hasOriData && A.oriLabels.length > 0) {
      var topOri = A.oriLabels.reduce(function (best, k) { return sum(A.newOri[k]) >= sum(A.newOri[best]) ? k : best; }, A.oriLabels[0]);
      var knownOri = sum(A.newOriKnown);
      kp.novosOriTop = K("Principal canal de origem", topOri, null, "text", 0, null, "canal com mais contatos novos identificados no período");
      kp.novosOriPct = K("Origem identificada", A.baseNew ? knownOri / A.baseNew * 100 : null, null, "pct", 0, null, FMT.int(knownOri) + " de " + FMT.int(A.baseNew) + " novos");
    }
    kp.recorrentes = K("Contatos recorrentes", A.recurring, bsum(function (x) { return x.recurring; }), "int", 0, A.activeRec, "ativos que já eram contatos antes do período");
    kp.recv = K("Mensagens recebidas", A.totRecv, bsum(function (x) { return x.totRecv; }), "int", 0, A.recv.tot);
    kp.sent = K("Mensagens enviadas", A.totSent, bsum(function (x) { return x.totSent; }), "int", 0, A.sent.tot);
    kp.ourMean = K("Nosso tempo médio de resposta", A.ourAll.mean, bsum(function (x) { return x.ourAll.mean; }), "dur", -1, pick(A.our, "mean"), FMT.int(A.ourAll.n) + " respostas");
    kp.ourMed = K("Nossa resposta (mediana)", A.ourAll.med, bsum(function (x) { return x.ourAll.med; }), "dur", -1, pick(A.our, "med"));
    kp.ourP90 = K("Nossa resposta (P90)", A.ourAll.p90, bsum(function (x) { return x.ourAll.p90; }), "dur", -1, null, "9 em cada 10 respostas são mais rápidas");
    kp.conMean = K("Tempo médio de resposta do contato", A.conAll.mean, bsum(function (x) { return x.conAll.mean; }), "dur", 0, pick(A.con, "mean"), FMT.int(A.conAll.n) + " respostas");
    kp.conMed = K("Resposta do contato (mediana)", A.conAll.med, bsum(function (x) { return x.conAll.med; }), "dur", 0, pick(A.con, "med"));
    kp.frt = K("1ª resposta a novos contatos", A.frtAll.mean, bsum(function (x) { return x.frtAll.mean; }), "dur", -1, pick(A.frt, "mean"), "média, contatos que nos procuraram");
    kp.sla = K("Respostas dentro da meta", A.slaPct, bsum(function (x) { return x.slaPct; }), "pct", 1, null, "meta: " + S.sla + " min");
    kp.unans = K("Conversas sem resposta nossa", A.unans, bsum(function (x) { return x.unans; }), "int", -1, null,
      "sem retorno há mais de 24 h" + (A.unansRecent ? " · +" + A.unansRecent + " recentes" : "") + (A.unansOoh ? " · " + A.unansOoh + " chegaram fora do horário" : ""));
    kp.closed = K("Encerradas pelo contato", A.closedN, bsum(function (x) { return x.closedN; }), "int", 0, null, "última mensagem foi agradecimento, despedida ou emoji");
    kp.noreply = K("Contatos sem retorno", A.noreply, bsum(function (x) { return x.noreply; }), "int", 0, null, "nossa última mensagem pedia retorno · " + A.noreplyRecent + " recentes não contadas");
    kp.recvOoh = K("Recebidas fora do horário", A.totRecvOoh, bsum(function (x) { return x.totRecvOoh; }), "int", 0, A.recvOoh, A.totRecv ? FMT.pct(A.totRecvOoh / A.totRecv * 100) + " das recebidas" : "");
    kp.recvOohPct = K("% recebidas fora do horário", A.totRecv ? A.totRecvOoh / A.totRecv * 100 : null, bsum(function (x) { return x.totRecv ? x.totRecvOoh / x.totRecv * 100 : null; }), "pct", 0);
    kp.sentOoh = K("Enviadas fora do horário", A.totSentOoh, bsum(function (x) { return x.totSentOoh; }), "int", 0, A.sentOoh, A.totSent ? FMT.pct(A.totSentOoh / A.totSent * 100) + " das enviadas" : "");
    kp.newOoh = K("Novos contatos fora do horário", A.totNewOoh, bsum(function (x) { return x.totNewOoh; }), "int", 0, A.newOoh, A.baseNew ? FMT.pct(A.totNewOoh / A.baseNew * 100) + " dos novos" : "");
    kp.ourInMean = K("Resposta a quem chegou em horário", A.ourInAll.mean, bsum(function (x) { return x.ourInAll.mean; }), "dur", -1, pick(A.ourIn, "mean"), FMT.int(A.ourInAll.n) + " respostas");
    kp.ourOutMean = K("Resposta a quem chegou fora do horário", A.ourOutAll.mean, bsum(function (x) { return x.ourOutAll.mean; }), "dur", -1, pick(A.ourOut, "mean"), "contado a partir da abertura · " + FMT.int(A.ourOutAll.n) + " respostas");
    var ratio = A.totRecv ? A.totSent / A.totRecv : null;
    kp.ratio = K("Enviadas por recebida", ratio, bsum(function (x) { return x.totRecv ? x.totSent / x.totRecv : null; }), "dec", 0);
    kp.perContact = K("Mensagens por contato ativo", A.uniq ? (A.totRecv + A.totSent) / A.uniq : null,
      bsum(function (x) { return x.uniq ? (x.totRecv + x.totSent) / x.uniq : null; }), "dec", 0);
    var C = A.calls;
    function bcs(f) { return b ? f(b.calls) : null; }
    kp.calls = K("Ligações", C.n, bcs(function (c) { return c.n; }), "int", 0, C.totB);
    kp.callsIn = K("Ligações recebidas", C.inN, bcs(function (c) { return c.inN; }), "int", 0, C.inAns.map(function (v, i) { return v + C.inMiss[i]; }));
    kp.callsOut = K("Ligações feitas", C.outN, bcs(function (c) { return c.outN; }), "int", 0, C.outAns.map(function (v, i) { return v + C.outNo[i]; }));
    kp.callsAns = K("Ligações atendidas", C.ans, bcs(function (c) { return c.ans; }), "int", 0, C.ansB, C.n ? FMT.pct(C.ans / C.n * 100) + " do total" : "");
    kp.callsMissed = K("Recebidas perdidas", C.missedIn, bcs(function (c) { return c.missedIn; }), "int", -1, C.inMiss, C.noAnsOut ? C.noAnsOut + " feitas sem resposta" : "");
    kp.callsRate = K("Atendimento das recebidas", C.inN ? (C.inN - C.missedIn) / C.inN * 100 : null, bcs(function (c) { return c.inN ? (c.inN - c.missedIn) / c.inN * 100 : null; }), "pct", 1);
    kp.callsDur = K("Duração média (atendidas)", C.durAvg, bcs(function (c) { return c.durAvg; }), "dur", 0, C.durAvgB);
    kp.callsDurTot = K("Tempo total em ligações", C.durSum, bcs(function (c) { return c.durSum; }), "dur", 0, C.durB);
    kp.callsRet = K("Retorno de perdidas (média)", C.retStats.mean, bcs(function (c) { return c.retStats.mean; }), "dur", -1, null, C.retN + " retornadas · " + C.unret + " sem retorno");
    kp.callsVideo = K("Chamadas de vídeo", C.video, bcs(function (c) { return c.video; }), "int", 0, C.videoB);
    kp.callsOoh = K("Ligações fora do horário", C.ooh, bcs(function (c) { return c.ooh; }), "int", 0, C.oohB, C.n ? FMT.pct(C.ooh / C.n * 100) + " do total" : "");
    function peak(arr, labels) {
      var m = 0; arr.forEach(function (v, i) { if (v > arr[m]) m = i; });
      return arr[m] ? labels[m] : "—";
    }
    var tot7 = A.dow.recv.map(function (v, i) { return v + A.dow.sent[i]; });
    var tot24 = A.hod.recv.map(function (v, i) { return v + A.hod.sent[i]; });
    kp.peakDow = K("Dia mais movimentado", peak(tot7, ST.DOW), null, "text", 0);
    kp.peakHour = K("Hora mais movimentada", peak(tot24, hourLabels()), null, "text", 0);
    CATS_KPI(kp);
    Object.keys(kp).forEach(function (key) { kp[key].id = key; });

    var pl = b && b.tlabels;
    var bMsgsRecv = b ? b.recv.tot : null, bMsgsSent = b ? b.sent.tot : null;
    var V = {};

    V.overview = { kpis: [kp.uniq, kp.novos, kp.recv, kp.sent, kp.ourMean, kp.conMean, kp.sla, kp.unans], blocks: [
      spec({ id: "ov_msgs", title: "Mensagens recebidas e enviadas", sub: "Volume total no período", labels: A.labels, plabels: pl, fmt: "int", sum: true, stackable: true,
        kinds: ["bar", "stack", "line", "area"], def: "bar", good: 0,
        series: [ser("Recebidas", "s1", A.recv.tot, bMsgsRecv), ser("Enviadas", "s2", A.sent.tot, bMsgsSent)] }),
      spec({ id: "ov_new", title: "Contatos novos", sub: "Primeira mensagem enviada ou recebida", labels: A.labels, plabels: pl, fmt: "int", sum: true, stackable: false,
        kinds: TS_KINDS, def: "bar", good: 0, series: [ser("Contatos novos", "s1", A.newC, b && b.newC)] }),
      spec({ id: "ov_rt", title: "Tempo médio de resposta", sub: "Nossa resposta ao contato e resposta do contato", labels: A.labels, plabels: pl, fmt: "dur", sum: false, stackable: false,
        kinds: TS_KINDS, def: "line", good: -1, footLabel: "Geral",
        series: [
          { name: "Nossa resposta", color: "s1", data: pick(A.our, "mean"), prev: b ? pick(b.our, "mean") : null, total: A.ourAll.mean, ptotal: b ? b.ourAll.mean : null },
          { name: "Resposta do contato", color: "s2", data: pick(A.con, "mean"), prev: b ? pick(b.con, "mean") : null, total: A.conAll.mean, ptotal: b ? b.conAll.mean : null }
        ] }),
      spec({ id: "ov_types", title: "Mensagens por tipo de mídia", sub: "Recebidas e enviadas no período", labels: ST.CATS.map(function (c) { return c.n; }), plabels: ST.CATS.map(function (c) { return c.n; }),
        fmt: "int", sum: true, stackable: true, cat: true, kinds: ["bar", "stack"], def: "bar", good: 0, labelHead: "Tipo",
        series: [
          ser("Recebidas", "s1", ST.CATS.map(function (c) { return sum(A.recv[c.k]); }), b && ST.CATS.map(function (c) { return sum(b.recv[c.k]); })),
          ser("Enviadas", "s2", ST.CATS.map(function (c) { return sum(A.sent[c.k]); }), b && ST.CATS.map(function (c) { return sum(b.sent[c.k]); }))
        ] })
    ] };

    var contactsKpis = [kp.uniq, kp.base, kp.novos, kp.recorrentes, kp.novosIn, kp.novosOut, kp.novosAd, kp.noreply];
    if (A.hasOriData) contactsKpis.splice(7, 0, kp.novosOriTop, kp.novosOriPct);
    var contactsBlocks = [
      spec({ id: "c_new", title: "Contatos novos por origem da conversa", sub: "Quem enviou a primeira mensagem", wide: true, labels: A.labels, plabels: pl, fmt: "int", sum: true, stackable: true,
        kinds: ["stack", "bar", "line", "area", "donut"], def: "stack", good: 0,
        series: [ser("Iniciados pelo contato", "s1", A.newIn, b && b.newIn), ser("Iniciados por nós", "s2", A.newOut, b && b.newOut)] }),
      spec({ id: "c_active", title: "Contatos ativos: novos e recorrentes", sub: "Contatos com ao menos uma mensagem em cada intervalo", labels: A.labels, plabels: pl, fmt: "int", sum: false, stackable: true, foot: false,
        kinds: ["stack", "bar", "line", "area"], def: "stack", good: 0,
        series: [ser("Novos", "s1", A.activeNew, b && b.activeNew), ser("Recorrentes", "s2", A.activeRec, b && b.activeRec)] }),
      spec({ id: "c_ad", title: "Novos contatos: anúncio x orgânico", sub: "Anúncio = conversa iniciada por anúncio (Click-to-WhatsApp)", labels: A.labels, plabels: pl, fmt: "int", sum: true, stackable: true,
        kinds: ["stack", "bar", "line", "area", "donut"], def: "stack", good: 0,
        series: [ser("Via anúncio", "s3", A.newAd, b && b.newAd), ser("Orgânico", "s4", A.newC.map(function (v, i) { return v - A.newAd[i]; }), b && b.newC.map(function (v, i) { return v - b.newAd[i]; }))] })
    ];
    if (A.hasOriData) {
      contactsBlocks.push(spec({ id: "c_ori", title: "Contatos novos por canal de origem", sub: "Canal identificado na primeira mensagem recebida", wide: true, labels: A.labels, plabels: pl, fmt: "int", sum: true, stackable: true,
        kinds: ["stack", "bar", "line", "area", "donut"], def: "stack", good: 0,
        series: A.oriLabels.map(function (k, i) {
          return ser(k, "s" + ((i % 7) + 1), A.newOri[k], b && b.newOri && b.newOri[k]);
        }).concat([ser("Não identificado", "muted", A.newOriUnkn, b && b.newOriUnkn)]) }));
    }
    contactsBlocks.push(
      spec({ id: "c_base", title: "Base acumulada de contatos", sub: "Total de contatos únicos ao final de cada intervalo", labels: A.labels, plabels: pl, fmt: "int", sum: false, stackable: false, foot: false,
        kinds: ["line", "area", "bar"], def: "area", good: 0, series: [ser("Base acumulada", "s1", A.baseCum, b && b.baseCum)] }),
      spec({ id: "c_depth", title: "Profundidade das conversas", sub: "Contatos ativos por quantidade de mensagens trocadas no período", labels: ST.DEPTH.map(function (d) { return d[0]; }), plabels: ST.DEPTH.map(function (d) { return d[0]; }),
        fmt: "int", sum: true, stackable: true, cat: true, kinds: ["bar", "donut"], def: "bar", good: 0, labelHead: "Mensagens na conversa",
        series: [ser("Contatos", "s1", A.depth, b && b.depth)] })
    );
    V.contacts = { kpis: contactsKpis, blocks: contactsBlocks };

    function msgsView(dir, word) {
      var P = dir === "recv" ? "Mensagens recebidas" : "Mensagens enviadas";
      var kl = dir === "recv" ? [kp.recv] : [kp.sent];
      ST.CATS.forEach(function (c) { kl.push(kp["cat_" + dir + "_" + c.k]); });
      return { kpis: kl, blocks: [
        spec({ id: dir + "_types", title: P + " por tipo de mídia", sub: "Texto, imagem, documento, áudio, vídeo e outros", wide: true, labels: A.labels, plabels: pl, fmt: "int", sum: true, stackable: true,
          kinds: ["stack", "bar", "line", "area", "donut"], def: "stack", good: 0, series: catSeries(dir) }),
        spec({ id: dir + "_total", title: "Total de " + word, sub: "Todas as mídias somadas", labels: A.labels, plabels: pl, fmt: "int", sum: true, stackable: false,
          kinds: TS_KINDS, def: "bar", good: 0, series: [ser("Total", "s1", A[dir].tot, b && b[dir].tot)] }),
        spec({ id: dir + "_dow", title: P + " por dia da semana", sub: "Soma do período", labels: ST.DOW, plabels: ST.DOW, fmt: "int", sum: true, stackable: false, cat: true,
          kinds: ["bar", "line", "area"], def: "bar", good: 0, labelHead: "Dia", series: [ser("Mensagens", "s1", A.dow[dir], b && b.dow[dir])] })
      ] };
    }
    V.recv = msgsView("recv", "mensagens recebidas");
    V.sent = msgsView("sent", "mensagens enviadas");

    V.resp = { kpis: [kp.ourMean, kp.ourMed, kp.ourP90, kp.sla, kp.conMean, kp.conMed, kp.frt, kp.ourInMean, kp.ourOutMean, kp.unans, kp.closed, kp.noreply], blocks: [
      respSpec("r_our", "Tempo de resposta para o contato (nosso)", "Da primeira mensagem do contato sem resposta até a nossa resposta", A.our, A.ourAll, b && b.our, b && b.ourAll, -1),
      respSpec("r_con", "Tempo de resposta do contato", "Da nossa mensagem até o contato responder", A.con, A.conAll, b && b.con, b && b.conAll, 0),
      respSpec("r_frt", "Tempo até a 1ª resposta a novos contatos", "Somente conversas iniciadas pelo contato", A.frt, A.frtAll, b && b.frt, b && b.frtAll, -1),
      spec({ id: "r_ooh", title: "Nossa resposta conforme o momento da chegada", sub: "Só conta o horário de atendimento: quem escreveu fora do horário é medido a partir da abertura, sem penalizar noite, fim de semana e feriado",
        labels: A.labels, plabels: pl, fmt: "dur", sum: false, stackable: false, kinds: TS_KINDS, def: "line", good: -1, footLabel: "Geral",
        series: [
          { name: "Chegou em horário", color: "s1", data: pick(A.ourIn, "mean"), prev: b ? pick(b.ourIn, "mean") : null, total: A.ourInAll.mean, ptotal: b ? b.ourInAll.mean : null },
          { name: "Chegou fora do horário", color: "s2", data: pick(A.ourOut, "mean"), prev: b ? pick(b.ourOut, "mean") : null, total: A.ourOutAll.mean, ptotal: b ? b.ourOutAll.mean : null }
        ],
        extra: [{ name: "Respostas (em horário)", fmt: "int", data: pick(A.ourIn, "n"), foot: A.ourInAll.n }, { name: "Respostas (fora do horário)", fmt: "int", data: pick(A.ourOut, "n"), foot: A.ourOutAll.n }] }),
      spec({ id: "r_bins", title: "Distribuição por faixa de tempo", sub: "Quantidade de respostas em cada faixa", labels: ST.BINS.map(function (x) { return x[0]; }), plabels: ST.BINS.map(function (x) { return x[0]; }),
        fmt: "int", sum: true, stackable: true, cat: true, kinds: ["bar", "stack", "line"], def: "bar", good: 0, labelHead: "Faixa",
        series: [ser("Nossa resposta", "s1", A.binsOur, b && b.binsOur), ser("Resposta do contato", "s2", A.binsCon, b && b.binsCon)] })
    ] };

    function binsOf(raw, extra) {
      var r = ST.BINS.map(function () { return 0; });
      raw.forEach(function (v) { for (var k = 0; k < ST.BINS.length; k++) if (v <= ST.BINS[k][1]) { r[k]++; break; } });
      return r.concat([extra]);
    }
    var binLabels = ST.BINS.map(function (x) { return x[0]; }).concat(["Sem retorno"]);
    var bC = b && b.calls;
    V.calls = { kpis: [kp.calls, kp.callsIn, kp.callsOut, kp.callsAns, kp.callsMissed, kp.callsRate, kp.callsDur, kp.callsDurTot, kp.callsRet, kp.callsVideo, kp.callsOoh], blocks: [
      spec({ id: "k_status", title: "Ligações por situação", sub: "Recebidas e feitas, atendidas ou não", wide: true, labels: A.labels, plabels: pl, fmt: "int", sum: true, stackable: true,
        kinds: ["stack", "bar", "line", "area", "donut"], def: "stack", good: 0,
        series: [ser("Recebidas atendidas", "s1", C.inAns, bC && bC.inAns), ser("Recebidas perdidas", "s2", C.inMiss, bC && bC.inMiss),
          ser("Feitas atendidas", "s3", C.outAns, bC && bC.outAns), ser("Feitas sem resposta", "s4", C.outNo, bC && bC.outNo)] }),
      spec({ id: "k_type", title: "Voz x vídeo", sub: "Tipo de chamada", labels: A.labels, plabels: pl, fmt: "int", sum: true, stackable: true,
        kinds: ["stack", "bar", "line", "area", "donut"], def: "stack", good: 0,
        series: [ser("Voz", "s1", C.voiceB, bC && bC.voiceB), ser("Vídeo", "s5", C.videoB, bC && bC.videoB)] }),
      spec({ id: "k_dur", title: "Duração média das ligações atendidas", sub: "Tempo de conversa", labels: A.labels, plabels: pl, fmt: "dur", sum: false, stackable: false, footLabel: "Geral",
        kinds: ["bar", "line", "area"], def: "bar", good: 0,
        series: [{ name: "Duração média", color: "s1", data: C.durAvgB, prev: bC ? bC.durAvgB : null, total: C.durAvg, ptotal: bC ? bC.durAvg : null }],
        extra: [{ name: "Tempo total", fmt: "dur", data: C.durB, foot: C.durSum }, { name: "Atendidas", fmt: "int", data: C.ansB, foot: C.ans }] }),
      spec({ id: "k_ret", title: "Retorno de ligações perdidas", sub: "Tempo até a nossa próxima mensagem ou ligação para o mesmo contato", labels: binLabels, plabels: binLabels,
        fmt: "int", sum: true, stackable: true, cat: true, kinds: ["bar", "donut"], def: "bar", good: 0, labelHead: "Faixa",
        series: [ser("Perdidas", "s2", binsOf(C.ret, C.unret), bC && binsOf(bC.ret, bC.unret))] }),
      spec({ id: "k_ooh", title: "Ligações fora do horário de atendimento", sub: "Inclui noites, fins de semana e feriados", labels: A.labels, plabels: pl, fmt: "int", sum: true, stackable: false,
        kinds: TS_KINDS, def: "bar", good: 0, series: [ser("Fora do horário", "s2", C.oohB, bC && bC.oohB)] })
    ] };

    V.perf = { kpis: [kp.ratio, kp.perContact, kp.recvOoh, kp.recvOohPct, kp.sentOoh, kp.newOoh, kp.sla, kp.unans, kp.closed, kp.noreply, kp.peakDow, kp.peakHour], blocks: [
      { id: "p_heat", type: "heat", title: "Mapa de calor: dia da semana x hora", sub: "Onde está a demanda e onde está a equipe", heat: A.heat, wide: true },
      spec({ id: "p_hod", title: "Mensagens por hora do dia", sub: "Soma do período", wide: true, labels: hourLabels(), plabels: hourLabels(), fmt: "int", sum: true, stackable: false, cat: true,
        kinds: ["bar", "line", "area"], def: "bar", good: 0, labelHead: "Hora",
        series: [ser("Recebidas", "s1", A.hod.recv, b && b.hod.recv), ser("Enviadas", "s2", A.hod.sent, b && b.hod.sent)] }),
      spec({ id: "p_dow", title: "Mensagens por dia da semana", sub: "Soma do período", labels: ST.DOW, plabels: ST.DOW, fmt: "int", sum: true, stackable: false, cat: true,
        kinds: ["bar", "line", "area"], def: "bar", good: 0, labelHead: "Dia",
        series: [ser("Recebidas", "s1", A.dow.recv, b && b.dow.recv), ser("Enviadas", "s2", A.dow.sent, b && b.dow.sent)] }),
      spec({ id: "p_oohr", title: "Recebidas dentro e fora do horário", sub: "Fora do horário = noites, fins de semana, feriados e fora da janela configurada", labels: A.labels, plabels: pl, fmt: "int", sum: true, stackable: true,
        kinds: ["stack", "bar", "line", "area", "donut"], def: "stack", good: 0,
        series: [ser("Em horário", "s1", A.recv.tot.map(function (v, i) { return v - A.recvOoh[i]; }), b && b.recv.tot.map(function (v, i) { return v - b.recvOoh[i]; })),
          ser("Fora do horário", "s2", A.recvOoh, b && b.recvOoh)] }),
      spec({ id: "p_oohs", title: "Enviadas dentro e fora do horário", sub: "Mensagens nossas fora da janela de atendimento", labels: A.labels, plabels: pl, fmt: "int", sum: true, stackable: true,
        kinds: ["stack", "bar", "line", "area", "donut"], def: "stack", good: 0,
        series: [ser("Em horário", "s1", A.sent.tot.map(function (v, i) { return v - A.sentOoh[i]; }), b && b.sent.tot.map(function (v, i) { return v - b.sentOoh[i]; })),
          ser("Fora do horário", "s2", A.sentOoh, b && b.sentOoh)] }),
      spec({ id: "p_ratio", title: "Equilíbrio entre enviadas e recebidas", sub: "Volume em cada intervalo", labels: A.labels, plabels: pl, fmt: "int", sum: true, stackable: true,
        kinds: ["stack", "bar", "line", "area"], def: "stack", good: 0,
        series: [ser("Recebidas", "s1", A.recv.tot, bMsgsRecv), ser("Enviadas", "s2", A.sent.tot, bMsgsSent)] })
    ] };
    return V;

    function CATS_KPI(kp) {
      ST.CATS.forEach(function (c) {
        ["recv", "sent"].forEach(function (d) {
          var cur = sum(A[d][c.k]), tot = d === "recv" ? A.totRecv : A.totSent;
          kp["cat_" + d + "_" + c.k] = K(c.n, cur, B ? sum(B[d][c.k]) : null, "int", 0, A[d][c.k], tot ? FMT.pct(cur / tot * 100) + " do total" : "");
        });
      });
    }
  }

  // ---------- gráficos ----------
  function mkChart(canvas, sp, kind, th, animate) {
    var L = sp.labels, n = L.length, fmt = FMT[sp.fmt], ds = [], cfg;
    function padTo(a) { var r = []; for (var i = 0; i < n; i++) r.push(a && a[i] != null ? a[i] : null); return r; }
    var plug = animate ? [] : [{ id: "bg", beforeDraw: function (c) { c.ctx.save(); c.ctx.fillStyle = "#fff"; c.ctx.fillRect(0, 0, c.width, c.height); c.ctx.restore(); } }];
    var common = { responsive: true, maintainAspectRatio: false, animation: animate ? { duration: 300 } : false,
      interaction: { mode: "index", intersect: false }, devicePixelRatio: animate ? undefined : 1.5 };
    if (kind === "donut") {
      var labels, data, colors;
      if (sp.cat) { labels = L; data = sp.series[0].data; colors = ordinal(L.length, th); }
      else { labels = sp.series.map(function (s) { return s.name; }); data = sp.series.map(function (s) { return s.total; }); colors = sp.series.map(function (s) { return colorOf(s.color, th); }); }
      var totalD = sum(data);
      return new Chart(canvas, { type: "doughnut", plugins: plug,
        data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderColor: th.surface, borderWidth: 2 }] },
        options: Object.assign({}, common, { cutout: "62%", interaction: { mode: "nearest", intersect: true },
          plugins: { legend: { position: "right", labels: { color: th.ink2, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: "rect" } },
            tooltip: { callbacks: { label: function (c) { return " " + c.label + ": " + fmt(c.parsed) + " (" + FMT.pct(totalD ? c.parsed / totalD * 100 : 0) + ")"; } } } } }) });
    }
    var isBar = kind === "bar" || kind === "stack";
    var stacked = (kind === "stack" || kind === "area") && sp.stackable;
    sp.series.forEach(function (s) {
      var c = colorOf(s.color, th);
      var d = { label: s.name, data: padTo(s.data), borderColor: c, backgroundColor: c, order: 2 };
      if (isBar) { d.type = "bar"; d.borderRadius = 3; d.borderSkipped = "bottom"; d.maxBarThickness = 34; d.borderColor = th.surface; d.borderWidth = stacked ? 1 : 0; }
      else { d.type = "line"; d.tension = 0.25; d.borderWidth = 2; d.pointRadius = n > 45 ? 0 : 3; d.pointHoverRadius = 5; d.pointBackgroundColor = c; d.pointBorderColor = th.surface;
        d.fill = kind === "area"; if (kind === "area") d.backgroundColor = alpha(c, 0.22); }
      ds.push(d);
    });
    if (sp.cmp) {
      var multiSum = sp.sum && sp.series.length > 1 && !sp.cat, list;
      if (multiSum) {
        var pt = []; for (var i = 0; i < n; i++) { var t = 0, any = false; sp.series.forEach(function (s) { if (s.prev && s.prev[i] != null) { t += s.prev[i]; any = true; } }); pt.push(any ? t : null); }
        list = [{ name: "Total (anterior)", data: pt, c: th.muted }];
      } else list = sp.series.map(function (s) { return { name: s.name + " (anterior)", data: padTo(s.prev), c: alpha(colorOf(s.color, th), 0.65) }; });
      list.forEach(function (p) {
        var d = { type: "line", label: p.name, data: padTo(p.data), borderColor: p.c, backgroundColor: p.c, borderDash: [5, 4], borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
          tension: 0.25, fill: false, order: 1, stack: "prev", isPrev: true };
        if (sp.cat) { d.showLine = false; d.pointRadius = 5; d.pointHoverRadius = 7; d.pointStyle = "rectRot"; d.backgroundColor = th.surface; d.borderWidth = 2; }
        ds.push(d);
      });
    }
    var yTick = function (v) { return sp.fmt === "dur" ? FMT.dur(v) : (v % 1 ? "" : FMT.int(v)); };
    cfg = { type: isBar ? "bar" : "line", plugins: plug, data: { labels: L, datasets: ds },
      options: Object.assign({}, common, {
        scales: {
          x: { stacked: stacked, grid: { display: false }, border: { color: th.axis }, ticks: { color: th.muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 14 } },
          y: { stacked: stacked, beginAtZero: true, grid: { color: th.grid }, border: { display: false }, ticks: { color: th.muted, callback: yTick, maxTicksLimit: 7 } }
        },
        plugins: {
          legend: { display: ds.length > 1, position: "top", align: "start", labels: { color: th.ink2, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: "rect",
            filter: function (item, data) { return !data.datasets[item.datasetIndex].isPrev; } } },
          tooltip: { callbacks: { label: function (c) {
            var extra = c.dataset.isPrev && sp.plabels ? " [" + (sp.plabels[c.dataIndex] || "—") + "]" : "";
            return " " + c.dataset.label + ": " + fmt(c.parsed.y) + extra;
          } } }
        } }) };
    return new Chart(canvas, cfg);
  }

  // ---------- componentes ----------
  function infoBtn(id) {
    return window.GLOSS && GLOSS.entry(id) ? '&nbsp;<button class="info" type="button" data-id="' + esc(id) + '" aria-label="Explicação" title="O que é isto?">i</button>' : "";
  }
  var pop = null;
  function hidePop() { if (pop) { pop.remove(); pop = null; } }
  function showPop(btn) {
    var wasSame = pop && pop._btn === btn;
    hidePop();
    if (wasSame) return;
    var e = GLOSS.entry(btn.dataset.id);
    if (!e) return;
    pop = el("div", "pop");
    pop.setAttribute("role", "dialog");
    pop.innerHTML = "<b>" + esc(e.t) + "</b><p>" + esc(GLOSS.fill(e.s, S)) + '</p><a href="ajuda.html#' + esc(e.id) + '" target="_blank" rel="noopener">Saiba mais</a>';
    pop._btn = btn;
    document.body.appendChild(pop);
    var r = btn.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    var left = Math.max(8, Math.min(r.left - 8, window.innerWidth - w - 8));
    var top = r.bottom + 8; if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8);
    pop.style.left = left + "px"; pop.style.top = top + "px";
  }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function deltaHtml(v, good) {
    if (v == null) return '<span class="dnone">—</span>';
    var arrow = v > 0.05 ? "▲" : v < -0.05 ? "▼" : "▬";
    var cls = good === 0 || Math.abs(v) <= 0.05 ? "dnone" : ((v > 0) === (good > 0) ? (v > 0 ? "dpos-good" : "dneg-good") : (v > 0 ? "dpos-bad" : "dneg-bad"));
    return '<span class="' + cls + '">' + arrow + " " + (v > 0 ? "+" : "") + v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%</span>";
  }
  function cellText(v, kind, good) {
    if (kind === "delta") return deltaHtml(v, good);
    if (v == null) return "—";
    if (kind === "text") return esc(v);
    return FMT[kind] ? FMT[kind](v) : esc(v);
  }
  function tableHtml(t) {
    var h = "<table class='t'><thead><tr>" + t.head.map(function (c) { return "<th>" + esc(c.h) + "</th>"; }).join("") + "</tr></thead><tbody>";
    t.rows.forEach(function (r) { h += "<tr>" + r.map(function (v, i) { return "<td>" + cellText(v, t.head[i].kind, t.head[i].good) + "</td>"; }).join("") + "</tr>"; });
    h += "</tbody>";
    if (t.foot) h += "<tfoot><tr>" + t.foot.map(function (v, i) { return "<td>" + (i === 0 ? esc(v) : cellText(v, t.head[i].kind, t.head[i].good)) + "</td>"; }).join("") + "</tr></tfoot>";
    return h + "</table>";
  }

  function sparkSvg(data, th) {
    if (!data || data.length < 2) return "";
    var v = data.map(function (x) { return x == null ? null : x; }), vals = v.filter(function (x) { return x != null; });
    if (vals.length < 2) return "";
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), rng = mx - mn || 1, w = 200, h = 28, pts = [];
    v.forEach(function (x, i) { if (x != null) pts.push((i / (v.length - 1) * w).toFixed(1) + "," + (h - 3 - (x - mn) / rng * (h - 6)).toFixed(1)); });
    return '<svg viewBox="0 0 200 28" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts.join(" ") + '" fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>';
  }
  function kpiCard(k) {
    var c = el("div", "kpi");
    var val = typeof k.cur === "string" ? esc(k.cur) : (FMT[k.fmt] || FMT.int)(k.cur);
    var d = "";
    if (B && typeof k.cur !== "string") d = deltaHtml(ST.delta(k.cur, k.prev), k.good) + " <span>vs " + (k.prev == null ? "—" : (FMT[k.fmt] || FMT.int)(k.prev)) + "</span>";
    c.innerHTML = '<div class="kpi-l">' + esc(k.label) + infoBtn(k.id) + '</div><div class="kpi-v">' + val + '</div><div class="kpi-d">' + d + "</div>" +
      sparkSvg(k.spark) + (k.hint ? '<div class="kpi-h">' + esc(k.hint) + "</div>" : "");
    return c;
  }

  function seg(opts, cur, onPick) {
    var s = el("div", "seg");
    opts.forEach(function (o) {
      var b = el("button", o.v === cur ? "on" : "", esc(o.l)); b.type = "button";
      b.onclick = function () { onPick(o.v); }; s.appendChild(b);
    });
    return s;
  }

  var PARTIAL_NOTE = "* Intervalo parcial: não cobre o mês, semana ou trimestre inteiro. A variação só é calculada quando os dois lados cobrem o mesmo número de dias.";
  function blockCard(sp) {
    var card = el("div", "card" + (sp.wide ? " wide" : ""));
    if (sp.type === "heat") return heatCard(sp, card);
    var kind = S.kinds[sp.id] && sp.kinds.indexOf(S.kinds[sp.id]) >= 0 ? S.kinds[sp.id] : sp.def;
    var view = S.tables[sp.id] ? "table" : "chart";
    var head = el("div", "card-h"), tt = el("div");
    tt.innerHTML = "<h2>" + esc(sp.title) + infoBtn(sp.id) + '</h2><div class="card-sub">' + esc(sp.sub || "") + "</div>";
    head.appendChild(tt);
    var ctl = el("div"); ctl.style.cssText = "display:flex;gap:8px;flex-wrap:wrap";
    if (view === "chart" && sp.kinds.length > 1) ctl.appendChild(seg(sp.kinds.map(function (k) { return { v: k, l: KIND_LABEL[k] }; }), kind, function (k) { S.kinds[sp.id] = k; renderView(); }));
    ctl.appendChild(seg([{ v: "chart", l: "Gráfico" }, { v: "table", l: "Tabela" }], view, function (v) { S.tables[sp.id] = v === "table"; renderView(); }));
    head.appendChild(ctl); card.appendChild(head);
    if (view === "chart") {
      var box = el("div", "chart-box"), cv = el("canvas");
      box.appendChild(cv); card.appendChild(box);
      setTimeout(function () { charts.push(mkChart(cv, sp, kind, TH[mode()], true)); }, 0);
    } else {
      var w = el("div", "tbl-wrap"); w.innerHTML = tableHtml(ST.specToTable(sp)); card.appendChild(w);
    }
    if (sp.hasPartial) card.appendChild(el("div", "card-note", PARTIAL_NOTE));
    return card;
  }

  function heatCard(sp, card) {
    var th = TH[mode()], which = S.heat, view = S.tables[sp.id] ? "table" : "chart";
    var head = el("div", "card-h"), tt = el("div");
    tt.innerHTML = "<h2>" + esc(sp.title) + infoBtn(sp.id) + '</h2><div class="card-sub">' + esc(sp.sub) + "</div>";
    head.appendChild(tt);
    var ctl = el("div"); ctl.style.cssText = "display:flex;gap:8px;flex-wrap:wrap";
    ctl.appendChild(seg([{ v: "recv", l: "Recebidas" }, { v: "sent", l: "Enviadas" }], which, function (v) { S.heat = v; renderView(); }));
    ctl.appendChild(seg([{ v: "chart", l: "Mapa" }, { v: "table", l: "Tabela" }], view, function (v) { S.tables[sp.id] = v === "table"; renderView(); }));
    head.appendChild(ctl); card.appendChild(head);
    var m = sp.heat[which];
    if (view === "table") {
      var tb = ST.heatTables(sp)[which === "recv" ? 0 : 1], w = el("div", "tbl-wrap"); w.innerHTML = tableHtml(tb); card.appendChild(w);
      return card;
    }
    var max = 0; m.forEach(function (r) { r.forEach(function (v) { if (v > max) max = v; }); });
    var wrap = el("div"); wrap.style.cssText = "overflow-x:auto"; var g = el("div", "heat"); g.style.minWidth = "760px";
    g.appendChild(el("div", "hl", ""));
    for (var h = 0; h < 24; h++) g.appendChild(el("div", "hl", ST.pad(h)));
    m.forEach(function (row, d) {
      g.appendChild(el("div", "hl", ST.DOW[d]));
      row.forEach(function (v, h2) {
        var c = el("div", "hc", v ? FMT.int(v) : ""), a = max ? v / max : 0;
        c.style.background = v ? alpha(th.s[0], 0.1 + 0.9 * a) : "transparent";
        c.style.color = a > 0.55 ? "#fff" : th.ink2;
        c.title = ST.DOW[d] + " " + ST.pad(h2) + "h: " + FMT.int(v) + " mensagens";
        g.appendChild(c);
      });
    });
    wrap.appendChild(g); card.appendChild(wrap);
    card.appendChild(el("div", "legend-scale", "<span>menos</span><i></i><span>mais mensagens (horário local, semana começa na segunda)</span>"));
    return card;
  }

  // ---------- render ----------
  function destroyCharts() { charts.forEach(function (c) { try { c.destroy(); } catch (e) {} }); charts = []; }

  function renderView() {
    destroyCharts();
    var root = $("view"); root.innerHTML = "";
    var V = VIEWS[S.tab];
    if (S.tab === "resp" && S.scope === "grp") root.appendChild(el("div", "note", "Tempos de resposta só são calculados para conversas individuais. Selecione \"Individuais\" ou \"Todas\"."));
    if (S.tab === "resp" && S.biz) root.appendChild(el("div", "note", "Contando apenas o horário comercial (seg–sex, " + S.bizFrom + "h às " + S.bizTo + "h)."));
    var k = el("div", "kpis"); V.kpis.forEach(function (x) { k.appendChild(kpiCard(x)); }); root.appendChild(k);
    var grid = el("div", "grid"); V.blocks.forEach(function (b) { grid.appendChild(blockCard(b)); }); root.appendChild(grid);
  }

  var lastStatus = null;
  function statusParts() {
    var d = GLOSS.DEFAULTS, V = GLOSS.values(S), DN = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
    var days = Math.round((S.effTo - S.effFrom + 1) / 86400000);
    var line1 = "Período: " + ST.fmtDate(S.effFrom) + " a " + ST.fmtDate(S.effTo) + " (" + days + " dias)";
    if (S.closed && closedAllowed().ok) {
      if (S.closedNone) line1 += " · nenhum intervalo fechado cabe no período pedido; exibindo com pontas parciais";
      else if (S.effFrom !== S.from || S.effTo !== S.to) line1 += " · ajustado a período fechado (pedido: " + ST.fmtDate(S.from) + " a " + ST.fmtDate(S.to) + ")";
    }
    if (B) line1 += " · comparando com " + ST.fmtDate(B.from) + " a " + ST.fmtDate(B.to) + " (linha tracejada / losangos nos gráficos)";
    line1 += " · " + { ind: "conversas individuais", grp: "grupos", all: "todas as conversas" }[S.scope];
    if (ST.failed) line1 += " · " + ST.failed + " arquivo(s) de conversa não carregado(s)";
    var chips = [];
    function chip(label, val, chg, tip) { chips.push({ t: label + ": " + val, chg: !!chg, tip: tip || "" }); }
    chip("Intervalos", S.closed && closedAllowed().ok ? "somente período fechado" : "com pontas parciais (*)", S.closed && closedAllowed().ok);
    chip("Dados do backup", ST.fmtDate(ST.minT) + " a " + ST.fmtDate(ST.maxT), false, "Contatos que já existiam antes do backup podem aparecer como novos perto da data inicial.");
    var bd = DN.filter(function (_, k) { return S.bizDays[k]; }).join(", ") || "nenhum dia";
    chip("Atendimento", S.bizFrom + " h às " + S.bizTo + " h (" + bd + ")", S.bizFrom !== d.bizFrom || S.bizTo !== d.bizTo || JSON.stringify(S.bizDays) !== JSON.stringify(d.bizDays));
    var ex = []; if (S.exSat) ex.push("sábados"); if (S.exSun) ex.push("domingos"); if (S.exHol) ex.push(S.optHol ? "feriados e pontos facultativos" : "feriados");
    chip("Dias desconsiderados", ex.join(", ") || "nenhum", S.exSat !== d.exSat || S.exSun !== d.exSun || S.exHol !== d.exHol || (S.exHol && S.optHol !== d.optHol));
    chip("Espera máxima", V.cap, S.cap !== d.cap);
    chip("Tempo de resposta", S.biz ? "só horário de atendimento" : "corrido", S.biz !== d.biz);
    chip("Meta", S.sla + " min", S.sla !== d.sla);
    chip("Automáticas", S.noAuto ? "desconsideradas" : "consideradas", S.noAuto !== d.noAuto);
    chip("Encerramentos", S.closing ? "não exigem resposta" : "exigem resposta", S.closing !== d.closing);
    return { line1: line1, chips: chips };
  }
  function statusPlain() { var p = lastStatus || statusParts(); return p.line1 + " · " + p.chips.map(function (c) { return c.t; }).join(" · "); }
  function status() {
    var p = lastStatus = statusParts();
    var ICON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="8" cy="8" r="6.5"/><path d="M8 7v4M8 5.5v.5" stroke-linecap="round"/></svg>';
    var chipsHtml = p.chips.map(function (c) {
      return '<span class="sd-chip' + (c.chg ? " chg" : "") + '"' + (c.tip ? ' title="' + esc(c.tip) + '"' : "") + ">" + esc(c.t) + "</span>";
    }).join("");
    $("status").innerHTML = '<div class="status-d">' + ICON +
      '<div><div class="sd-line1">' + esc(p.line1) + '</div>' +
      '<div class="sd-chips">' + chipsHtml +
      '<button type="button" class="link" data-adj="1">alterar ajustes</button></div></div></div>';
  }

  function refresh() {
    var o = respOpts();
    var allow = closedAllowed(), rng = [S.from, S.to], none = false;
    if (S.closed && allow.ok) {
      var c = ST.closeRange(S.from, S.to, S.gran);
      if (c) rng = c; else none = true;
    }
    S.effFrom = rng[0]; S.effTo = rng[1]; S.closedNone = none;
    syncClosed();
    A = ST.aggregate(S.effFrom, S.effTo, S.gran, S.scope, o);
    var cr = ST.compareRange(S.effFrom, S.effTo, S.cmp);
    B = cr ? ST.aggregate(cr[0], cr[1], S.gran, S.scope, o) : null;
    VIEWS = buildViews();
    status(); renderView();
  }
  function openAdj() { $("adjModal").hidden = false; }
  function closeAdj() { $("adjModal").hidden = true; }
  function closedAllowed() {
    if (S.gran === "day") return { ok: false, why: "Não se aplica ao agrupamento por dia: cada dia já é um intervalo completo." };
    if (S.preset === "custom") return { ok: false, why: "Não se aplica a período personalizado: as datas escolhidas são respeitadas exatamente." };
    return { ok: true, why: "Somente período fechado: ajusta o período para conter só intervalos completos (mês, semana, trimestre...) já encerrados, sem pontas parciais." };
  }
  function syncClosed() {
    var a = closedAllowed(), box = $("fClosed");
    box.disabled = !a.ok;
    box.checked = a.ok && S.closed;
    $("fClosedWrap").title = a.why;
    $("fClosedWrap").classList.toggle("off", !a.ok);
  }
  function respOpts() {
    return { cap: S.cap, biz: S.biz, bizFrom: S.bizFrom, bizTo: S.bizTo, bizDays: S.bizDays.slice(), sla: S.sla,
      exSat: S.exSat, exSun: S.exSun, exHol: S.exHol, optHol: S.optHol, noAuto: S.noAuto, closing: S.closing };
  }
  function saveSettings() {
    try { var o = {}; SAVED.forEach(function (k) { o[k] = S[k]; }); localStorage.setItem("stats-settings", JSON.stringify(o)); } catch (e) {}
  }
  function loadSettings() {
    try {
      var o = JSON.parse(localStorage.getItem("stats-settings") || "null");
      if (o) SAVED.forEach(function (k) { if (o[k] !== undefined && o[k] !== null) S[k] = o[k]; });
    } catch (e) {}
  }
  function syncControls() {
    $("fGran").value = S.gran; $("fCmp").value = S.cmp; $("fClosed").checked = S.closed; $("fScope").value = S.scope; $("fCap").value = String(S.cap);
    $("fBiz").checked = S.biz; $("fBizFrom").value = S.bizFrom; $("fBizTo").value = S.bizTo; $("fSla").value = S.sla;
    $("fExSat").checked = S.exSat; $("fExSun").checked = S.exSun; $("fExHol").checked = S.exHol; $("fOptHol").checked = S.optHol;
    $("fAuto").checked = S.noAuto; $("fClosing").checked = S.closing;
    Array.prototype.forEach.call($("bizDays").querySelectorAll("input"), function (i) { i.checked = !!S.bizDays[+i.dataset.d]; });
    $("autoNote").textContent = "Detectadas no backup: " + FMT.int(ST.autoStats.sent) + " mensagens automáticas enviadas (saudação e ausência)" +
      (ST.autoStats.recv ? " e " + FMT.int(ST.autoStats.recv) + " recebidas" : "") +
      ". Critério: texto repetido em várias conversas e enviado em segundos após a mensagem do contato. Conferido com o marcador interno do WhatsApp Business: precisão ~99%. Mensagens pré-preenchidas de anúncio são tratadas como mensagem real do contato.";
  }

  // ---------- filtros ----------
  function applyPreset(p) {
    // backup antigo (última mensagem há mais de 45 dias): os períodos relativos partem da última data dos dados
    var ref = Date.now();
    if (ST.maxT < ref - 45 * 86400000) ref = ST.maxT;
    var r = ST.presetRange(p, ref);
    if (r) { S.from = r[0]; S.to = r[1]; }
    $("fFrom").value = ST.inputDate(S.from); $("fTo").value = ST.inputDate(S.to);
    if (S.granAuto) { S.gran = ST.autoGran(S.from, S.to); $("fGran").value = S.gran; }
  }
  function bind() {
    $("fPreset").onchange = function () {
      S.preset = this.value;
      if (S.preset !== "custom") applyPreset(S.preset);
      refresh();
    };
    function dates() {
      var f = $("fFrom").value, t = $("fTo").value;
      if (!f || !t) return;
      S.from = ST.parseInputDate(f); S.to = ST.endOfDay(ST.parseInputDate(t));
      if (S.to < S.from) { var x = S.from; S.from = ST.startOfDay(S.to); S.to = ST.endOfDay(x); $("fFrom").value = ST.inputDate(S.from); $("fTo").value = ST.inputDate(S.to); }
      S.preset = "custom"; $("fPreset").value = "custom";
      if (S.granAuto) { S.gran = ST.autoGran(S.from, S.to); $("fGran").value = S.gran; }
      refresh();
    }
    $("fFrom").onchange = dates; $("fTo").onchange = dates;
    function chg(fn) { return function () { fn.call(this); saveSettings(); refresh(); }; }
    $("fGran").onchange = chg(function () { S.gran = this.value; S.granAuto = false; });
    $("fCmp").onchange = chg(function () { S.cmp = this.value; });
    $("fClosed").onchange = chg(function () { S.closed = this.checked; });
    $("fScope").onchange = chg(function () { S.scope = this.value; });
    $("fCap").onchange = chg(function () { S.cap = +this.value; });
    $("fBiz").onchange = chg(function () { S.biz = this.checked; });
    $("fExSat").onchange = chg(function () { S.exSat = this.checked; });
    $("fExSun").onchange = chg(function () { S.exSun = this.checked; });
    $("fExHol").onchange = chg(function () { S.exHol = this.checked; });
    $("fOptHol").onchange = chg(function () { S.optHol = this.checked; });
    $("fAuto").onchange = chg(function () { S.noAuto = this.checked; });
    $("fClosing").onchange = chg(function () { S.closing = this.checked; });
    $("bizDays").onchange = chg(function () {
      var arr = [false, false, false, false, false, false, false];
      Array.prototype.forEach.call($("bizDays").querySelectorAll("input"), function (i) { arr[+i.dataset.d] = i.checked; });
      S.bizDays = arr;
    });
    $("holBtn").onclick = function () {
      $("holBody").innerHTML = tableHtml(ST.holidayTable(respOpts()));
      $("holModal").hidden = false;
    };
    $("holClose").onclick = function () { $("holModal").hidden = true; };
    $("holModal").onclick = function (e) { if (e.target === this) this.hidden = true; };
    function num(id, key, mn, mx) {
      $(id).onchange = function () { var v = Math.min(mx, Math.max(mn, +this.value || mn)); this.value = v; S[key] = v; if (S.bizTo <= S.bizFrom) { S.bizTo = Math.min(24, S.bizFrom + 1); $("fBizTo").value = S.bizTo; } saveSettings(); refresh(); };
    }
    num("fBizFrom", "bizFrom", 0, 23); num("fBizTo", "bizTo", 1, 24); num("fSla", "sla", 1, 1440);
    $("status").onclick = function (e) { if (e.target.closest("[data-adj]")) { e.stopPropagation(); openAdj(); } };
    $("tabs").onclick = function (e) {
      var b = e.target.closest("button"); if (!b) return;
      S.tab = b.dataset.tab;
      Array.prototype.forEach.call(this.children, function (c) { c.classList.toggle("on", c === b); });
      renderView(); window.scrollTo(0, 0);
    };
    $("themeBtn").onclick = function () {
      var next = mode() === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("stats-theme", next); } catch (e) {}
      renderView();
    };
    $("exportBtn").onclick = function (e) { e.stopPropagation(); var m = $("exportMenu"); m.hidden = !m.hidden; };
    document.addEventListener("click", function (e) {
      var ib = e.target.closest(".info");
      if (ib) { e.stopPropagation(); showPop(ib); return; }
      if (!e.target.closest(".pop")) hidePop();
      if (!e.target.closest(".menu-wrap")) $("exportMenu").hidden = true;
    });
    $("exportMenu").onclick = function (e) {
      var b = e.target.closest("button"); if (!b) return;
      this.hidden = true; doExport(b.dataset.exp);
    };
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      hidePop();
      if (!$("holModal").hidden) $("holModal").hidden = true; else if (!$("adjModal").hidden) closeAdj();
    });
    $("adjBtn").onclick = openAdj;
    $("adjClose").onclick = closeAdj; $("adjDone").onclick = closeAdj;
    $("adjModal").onclick = function (e) { if (e.target === this) closeAdj(); };
    window.addEventListener("scroll", hidePop, { passive: true });
    try { var th = localStorage.getItem("stats-theme"); if (th) document.documentElement.setAttribute("data-theme", th); } catch (e) {}
    if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { if (!document.documentElement.getAttribute("data-theme")) renderView(); });
  }

  // ---------- exportação ----------
  function viewTables(key) {
    var V = VIEWS[key], out = [];
    var kt = ST.kpiTable(V.kpis); kt.name = TABS[key] + " – indicadores"; out.push(kt);
    V.blocks.forEach(function (b) { if (b.type === "heat") out = out.concat(ST.heatTables(b)); else out.push(ST.specToTable(b)); });
    return out;
  }
  function fileStamp() { var d = new Date(); return d.getFullYear() + ST.pad(d.getMonth() + 1) + ST.pad(d.getDate()); }

  function doExport(kind) {
    if (kind === "csv") ST.download(ST.toCSV(viewTables(S.tab)), "estatisticas-" + S.tab + "-" + fileStamp() + ".csv");
    else if (kind === "xlsx") {
      var all = [metaTable()], seen = {};
      var allKpis = []; Object.keys(VIEWS).forEach(function (k) { VIEWS[k].kpis.forEach(function (x) { if (!seen[x.label]) { seen[x.label] = 1; allKpis.push(x); } }); });
      var kt = ST.kpiTable(allKpis); kt.name = "Resumo"; all.push(kt);
      Object.keys(TABS).forEach(function (k) {
        VIEWS[k].blocks.forEach(function (b) { if (b.type === "heat") all = all.concat(ST.heatTables(b)); else all.push(ST.specToTable(b)); });
      });
      // remove duplicados por título (blocos repetidos em abas diferentes)
      all.push(ST.holidayTable(respOpts()));
      all.push(glossTable());
      var names = {}; all = all.filter(function (t) { var key = t.name + "|" + JSON.stringify(t.rows); if (names[key]) return false; names[key] = 1; return true; });
      ST.download(ST.toXLSX(all), "estatisticas-" + fileStamp() + ".xlsx");
    } else if (kind === "pdf") printReport();
  }
  function glossTable() {
    var rows = Object.keys(GLOSS).filter(function (k) { return GLOSS[k] && GLOSS[k].t; }).map(function (k) {
      var e = GLOSS[k], f = function (a) { return (a || []).map(function (x) { return GLOSS.fill(x, S); }).join(" "); };
      return [e.t, { c: "Conceito geral", k: "Indicador", b: "Gráfico" }[e.k], e.g, GLOSS.fill(e.s, S), f(e.h), f(e.d), f(e.w)];
    });
    return { name: "Glossário", head: ["Item", "Tipo", "Grupo", "O que mede", "Como é calculado", "Depende dos ajustes", "Atenção"].map(function (h) { return { h: h, kind: "text" }; }), rows: rows, foot: null };
  }
  function metaTable() {
    var rows = [["Período", ST.fmtDate(S.from) + " a " + ST.fmtDate(S.to)],
      ["Comparação", B ? ST.fmtDate(B.from) + " a " + ST.fmtDate(B.to) : "Sem comparação"],
      ["Agrupamento", { day: "Dia", week: "Semana", month: "Mês", quarter: "Trimestre", semester: "Semestre", year: "Ano" }[S.gran]],
      ["Conversas", { ind: "Individuais", grp: "Grupos", all: "Todas" }[S.scope]],
      ["Espera máxima considerada (h)", S.cap ? S.cap / 3600 : "Sem limite"],
      ["Horário de atendimento", S.bizFrom + "h às " + S.bizTo + "h (" + ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].filter(function (_, i) { return S.bizDays[i]; }).join(", ") + ")"],
      ["Tempo de resposta só no horário de atendimento", S.biz ? "Sim" : "Não"],
      ["Dias desconsiderados", [S.exSat && "sábados", S.exSun && "domingos", S.exHol && "feriados" + (S.optHol ? " e pontos facultativos" : "")].filter(Boolean).join(", ") || "Nenhum"],
      ["Mensagens automáticas desconsideradas", S.noAuto ? "Sim (detecção heurística, precisão ~99%)" : "Não"],
      ["Encerramentos (obrigada, ok, tchau) não exigem resposta", S.closing ? "Sim (heurística)" : "Não"],
      ["Meta de resposta (min)", S.sla],
      ["Privacidade", "Nomes e telefones não são incluídos"]];
    return { name: "Parâmetros", head: [{ h: "Parâmetro", kind: "text" }, { h: "Valor", kind: "text" }], rows: rows, foot: null };
  }

  function printReport() {
    var rep = $("report"), th = TH.light, html = "";
    html += "<h1>Estatísticas de Atendimento — WhatsApp Business</h1><div>" + esc(statusPlain()) + "</div><div>Gerado em " + ST.fmtDate(Date.now()) + " · nomes e telefones não são exibidos</div>";
    Object.keys(TABS).forEach(function (key, vi) {
      var V = VIEWS[key];
      html += "<h2 class='" + (vi ? "brk" : "") + "'>" + esc(TABS[key]) + "</h2><div class='rk'>";
      V.kpis.forEach(function (k) {
        var val = typeof k.cur === "string" ? esc(k.cur) : (FMT[k.fmt] || FMT.int)(k.cur);
        var d = B && typeof k.cur !== "string" ? deltaPlain(ST.delta(k.cur, k.prev)) + " (ant.: " + (k.prev == null ? "—" : (FMT[k.fmt] || FMT.int)(k.prev)) + ")" : "";
        html += "<div>" + esc(k.label) + "<b>" + val + "</b>" + d + "</div>";
      });
      html += "</div>";
      V.blocks.forEach(function (b) {
        html += "<h3>" + esc(b.title) + "</h3>";
        if (b.type === "heat") { ST.heatTables(b).forEach(function (t) { html += "<div>" + esc(t.name) + "</div>" + tableHtml(t); }); return; }
        var cv = document.createElement("canvas"); cv.width = 1100; cv.height = 340;
        cv.style.cssText = "position:fixed;left:-9999px;width:1100px;height:340px";
        document.body.appendChild(cv);
        var ch = mkChart(cv, b, b.def === "donut" ? "bar" : b.def, th, false);
        var img = cv.toDataURL("image/jpeg", 0.85); ch.destroy(); cv.remove();
        html += "<img alt='' src='" + img + "'>" + tableHtml(ST.specToTable(b)) + (b.hasPartial ? "<div>" + esc(PARTIAL_NOTE) + "</div>" : "");
      });
    });
    rep.innerHTML = html;
    var clear = function () { rep.innerHTML = ""; window.removeEventListener("afterprint", clear); };
    window.addEventListener("afterprint", clear);
    setTimeout(function () { window.print(); }, 150);
  }
  function deltaPlain(v) { return v == null ? "" : (v > 0 ? "▲ +" : v < 0 ? "▼ " : "▬ ") + v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%"; }

  // ---------- init ----------
  function init() {
    $("loading").hidden = true; $("app").hidden = false;
    loadSettings(); syncControls();
    bind();
    S.preset = "30d"; $("fPreset").value = "30d";
    applyPreset("30d");
    location.hash.slice(1).split(",").forEach(function (tk) {
      if (TABS[tk]) { S.tab = tk; Array.prototype.forEach.call($("tabs").children, function (c) { c.classList.toggle("on", c.dataset.tab === tk); }); }
      if (tk === "light" || tk === "dark") document.documentElement.setAttribute("data-theme", tk);
      if (tk === "adv") openAdj();
      if (tk === "fechado") S.closed = true;
      var m = /^([pgc])-(\w+)$/.exec(tk);
      if (m && m[1] === "p" && $("fPreset").querySelector('option[value="' + m[2] + '"]')) { S.preset = m[2]; $("fPreset").value = m[2]; if (m[2] !== "custom") applyPreset(m[2]); }
      if (m && m[1] === "g" && $("fGran").querySelector('option[value="' + m[2] + '"]')) { S.gran = m[2]; S.granAuto = false; $("fGran").value = m[2]; }
      if (m && m[1] === "c" && $("fCmp").querySelector('option[value="' + m[2] + '"]')) { S.cmp = m[2]; $("fCmp").value = m[2]; }
    });
    refresh();
  }
  var bar = $("loadBar"), txt = $("loadTxt");
  if (!window.STATS_DATA) {
    document.querySelector(".loading-title").textContent = "Nenhum dado carregado";
    bar.parentNode.hidden = true;
    txt.innerHTML = "Rode <b>preparar-dados.ps1</b> (Windows) ou <b>preparar-dados.sh</b> (Linux/macOS) e recarregue esta página.<br>As instruções estão no README.pt-BR.md.";
    return;
  }
  ST.load(function (d, n) { bar.style.width = (d / n * 100).toFixed(0) + "%"; txt.textContent = "Lendo conversas " + d + " de " + n; })
    .then(init)
    .catch(function (e) { txt.textContent = "Erro ao carregar os dados: " + e.message; });
})();
