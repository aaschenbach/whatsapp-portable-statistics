(function () {
  "use strict";
  var ST = window.ST;

  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i] || 0; return s; }
  ST.sum = sum;
  function delta(cur, prev) {
    if (cur == null || prev == null || prev === 0) return null;
    return (cur - prev) / prev * 100;
  }
  ST.delta = delta;

  // Converte uma especificação de bloco em tabela neutra (valores brutos).
  ST.specToTable = function (sp) {
    var cmp = sp.cmp, n = sp.labels.length, cols = [];
    var multiSum = sp.sum && sp.series.length > 1;
    function at(a, i) { return a && a[i] != null ? a[i] : null; }
    sp.series.forEach(function (s) {
      cols.push({ h: s.name, kind: sp.fmt, get: function (i) { return at(s.data, i); }, foot: s.total });
    });
    var tot = null, ptot = null;
    if (multiSum) {
      tot = sp.series[0].data.map(function (_, i) { return sum(sp.series.map(function (s) { return s.data[i]; })); });
      if (cmp) ptot = sp.series[0].data.map(function (_, i) { return sum(sp.series.map(function (s) { return s.prev ? s.prev[i] : 0; })); });
      cols.push({ h: "Total", kind: sp.fmt, get: function (i) { return tot[i]; }, foot: sum(tot) });
    }
    (sp.extra || []).forEach(function (e) {
      cols.push({ h: e.name, kind: e.fmt, get: function (i) { return at(e.data, i); }, foot: e.foot == null ? null : e.foot });
    });
    if (cmp) {
      cols.push({ h: "Período anterior", kind: "text", get: function (i) { return sp.plabels && sp.plabels[i] ? sp.plabels[i] : "—"; }, foot: null });
      var comps = multiSum
        ? [{ h: "Total", cur: function (i) { return tot[i]; }, prev: function (i) { return ptot[i]; }, cf: sum(tot), pf: sum(ptot) }]
        : sp.series.map(function (s) {
          return { h: s.name, cur: function (i) { return at(s.data, i); }, prev: function (i) { return at(s.prev, i); }, cf: s.total, pf: s.ptotal };
        });
      comps.forEach(function (c) {
        cols.push({ h: c.h + " (anterior)", kind: sp.fmt, get: c.prev, foot: c.pf });
        cols.push({ h: "Variação (%)" + (comps.length > 1 ? " – " + c.h : ""), kind: "delta", good: sp.good,
          get: function (i) { return sp.noDelta && sp.noDelta[i] ? null : delta(c.cur(i), c.prev(i)); }, foot: delta(c.cf, c.pf) });
      });
    }
    var rows = [];
    var rowLabels = sp.tlabels || sp.labels;
    for (var i = 0; i < n; i++) {
      var r = [rowLabels[i]];
      cols.forEach(function (c) { r.push(c.get(i)); });
      rows.push(r);
    }
    var foot = null;
    if (sp.foot !== false) {
      foot = [sp.footLabel || (sp.sum ? "Total" : "Geral")];
      cols.forEach(function (c) { foot.push(c.foot == null ? null : c.foot); });
    }
    return {
      name: sp.title,
      head: [{ h: sp.labelHead || "Período", kind: "text" }].concat(cols.map(function (c) { return { h: c.h, kind: c.kind, good: c.good }; })),
      rows: rows, foot: foot
    };
  };

  ST.heatTables = function (sp) {
    var out = [];
    [["recv", "recebidas"], ["sent", "enviadas"]].forEach(function (p) {
      var head = [{ h: "Dia / hora", kind: "text" }];
      for (var h = 0; h < 24; h++) head.push({ h: ST.pad(h) + "h", kind: "int" });
      out.push({ name: sp.title + " – " + p[1], head: head, foot: null,
        rows: sp.heat[p[0]].map(function (row, d) { return [ST.DOW[d]].concat(row); }) });
    });
    return out;
  };

  ST.kpiTable = function (kpis) {
    var rows = kpis.filter(function (k) { return typeof k.cur !== "string"; }).map(function (k) {
      var f = 1, u = "";
      if (k.fmt === "dur") { f = 1 / 60; u = " (min)"; } else if (k.fmt === "pct") u = " (%)";
      function c(v) { return v == null ? null : Math.round(v * f * 100) / 100; }
      return [k.label + u, c(k.cur), c(k.prev), ST.delta(k.cur, k.prev)];
    });
    return { name: "Resumo", head: [{ h: "Indicador", kind: "text" }, { h: "Valor", kind: "raw" }, { h: "Período anterior", kind: "raw" }, { h: "Variação (%)", kind: "delta" }], rows: rows, foot: null };
  };

  // Valor exportável de uma célula: durações em minutos.
  function cell(v, kind) {
    if (v == null) return null;
    if (kind === "dur") return Math.round(v / 60 * 100) / 100;
    if (kind === "delta" || kind === "dec" || kind === "raw") return Math.round(v * 100) / 100;
    return v;
  }
  function headText(c) { return c.kind === "dur" ? c.h + " (min)" : c.h; }
  ST.exportRows = function (t) {
    var rows = [t.head.map(headText)];
    t.rows.concat(t.foot ? [t.foot] : []).forEach(function (r) {
      rows.push(r.map(function (v, i) { return cell(v, t.head[i].kind); }));
    });
    return rows;
  };

  // ---------- CSV ----------
  ST.toCSV = function (tables) {
    var lines = [];
    tables.forEach(function (t, ti) {
      if (ti) lines.push("");
      lines.push(csvCell(t.name));
      ST.exportRows(t).forEach(function (r) { lines.push(r.map(csvCell).join(";")); });
    });
    return new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  };
  function csvCell(v) {
    if (v == null) return "";
    if (typeof v === "number") return String(v).replace(".", ",");
    v = String(v);
    return /[;"\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  // ---------- XLSX (OOXML mínimo, ZIP sem compressão) ----------
  var crcT = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) {
    var enc = new TextEncoder(), parts = [], central = [], off = 0;
    files.forEach(function (f) {
      var nm = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(10, 0, true); lh.setUint16(12, 33, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
      lh.setUint16(26, nm.length, true);
      parts.push(lh.buffer, nm, data);
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint16(14, 33, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
      ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
      central.push(ch.buffer, nm);
      off += 30 + nm.length + data.length;
    });
    var csize = 0; central.forEach(function (b) { csize += b.byteLength || b.length; });
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, csize, true); end.setUint32(16, off, true);
    return new Blob(parts.concat(central, [end.buffer]), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
  function esc(s) { return String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function colName(i) { var s = ""; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

  ST.toXLSX = function (tables) {
    var files = [], used = {}, names = [];
    tables.forEach(function (t, ti) {
      var base = t.name.replace(/[\[\]:*?\/\\]/g, " ").trim().slice(0, 28) || "Aba", nm = base, k = 2;
      while (used[nm.toLowerCase()]) nm = base.slice(0, 26) + " " + (k++);
      used[nm.toLowerCase()] = 1; names.push(nm);
      var rows = ST.exportRows(t), xml = "";
      rows.forEach(function (r, ri) {
        xml += '<row r="' + (ri + 1) + '">';
        r.forEach(function (v, ci) {
          if (v == null) return;
          var ref = colName(ci) + (ri + 1);
          if (typeof v === "number") xml += '<c r="' + ref + '"' + (ri && t.head[ci].kind !== "int" ? ' s="2"' : "") + "><v>" + v + "</v></c>";
          else xml += '<c r="' + ref + '" t="inlineStr"' + (ri === 0 ? ' s="1"' : "") + "><is><t>" + esc(v) + "</t></is></c>";
        });
        xml += "</row>";
      });
      var widths = '<cols><col min="1" max="1" width="30" customWidth="1"/><col min="2" max="' + Math.max(2, rows[0].length) + '" width="18" customWidth="1"/></cols>';
      files.push({ name: "xl/worksheets/sheet" + (ti + 1) + ".xml", data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
        widths + "<sheetData>" + xml + "</sheetData></worksheet>" });
    });
    var sheetsXml = names.map(function (n, i) { return '<sheet name="' + esc(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join("");
    var rels = names.map(function (n, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join("");
    var ct = names.map(function (n, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join("");
    var head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    files.unshift(
      { name: "[Content_Types].xml", data: head + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + ct + "</Types>" },
      { name: "_rels/.rels", data: head + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: "xl/workbook.xml", data: head + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheetsXml + "</sheets></workbook>" },
      { name: "xl/_rels/workbook.xml.rels", data: head + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels + '<Relationship Id="rId900" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: "xl/styles.xml", data: head + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>' }
    );
    return zip(files);
  };

  ST.download = function (blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };
})();
