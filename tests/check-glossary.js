// Uso: node tests/check-glossary.js
// Confere se todo indicador e gráfico de pendrive/stats/stats.js tem explicação em stats-glossario.js.
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "..", "stats");
global.window = global;
eval(fs.readFileSync(path.join(dir, "stats-glossario.js"), "utf8"));
const src = fs.readFileSync(path.join(dir, "stats.js"), "utf8");
const G = window.GLOSS;

const blocks = new Set([...src.matchAll(/\bid: "([a-z]\w*)"/g)].map(m => m[1]).concat([...src.matchAll(/respSpec\("(\w+)"/g)].map(m => m[1])));
blocks.delete("bg"); // plugin do Chart.js, não é gráfico
[...src.matchAll(/dir \+ "_(\w+)"/g)].forEach(m => ["recv", "sent"].forEach(d => blocks.add(d + "_" + m[1])));
const kpis = new Set([...src.matchAll(/\bkp\.(\w+) = K\(/g)].map(m => m[1]));
["recv", "sent"].forEach(d => kpis.add("cat_" + d + "_t"));

const errors = [];
for (const id of blocks) if (!G.entry(id) || G.entry(id).k !== "b") errors.push("Gráfico sem explicação: " + id);
for (const id of kpis) if (!G.entry(id) || G.entry(id).k !== "k") errors.push("Indicador sem explicação: " + id);

const used = new Set([...blocks, ...kpis, "cat_recv", "cat_sent"]);
const vals = Object.keys(G.values({}));
for (const [id, e] of Object.entries(G)) {
  if (!e || typeof e !== "object" || !e.t) continue;
  if (e.k !== "c" && !used.has(id)) errors.push("Explicação sem uso na página: " + id);
  if (!e.s || !e.g || !e.k) errors.push("Entrada incompleta: " + id);
  if (e.k !== "c" && (!e.h || !e.h.length)) errors.push("Sem 'como é calculado': " + id);
  if (e.s && e.s.length > 220) errors.push("Explicação curta longa demais (" + e.s.length + "): " + id);
  const all = [e.s].concat(e.h || [], e.d || [], e.w || []).join(" ");
  for (const m of all.matchAll(/\{(\w+)\}/g)) if (!vals.includes(m[1])) errors.push("Marcador desconhecido {" + m[1] + "} em " + id);
}
// referências "ver/veja \"Título\"" precisam apontar para uma explicação existente (viram links na ajuda)
const titles = new Set(Object.values(G).filter(e => e && e.t).map(e => e.t.toLowerCase()));
for (const [id, e] of Object.entries(G)) {
  if (!e || !e.t) continue;
  const all = [e.s].concat(e.h || [], e.d || [], e.w || []).join(" ");
  for (const m of all.matchAll(/\b[Vv](?:er|eja)\b[^"(]{0,12}"([^"]+)"/g)) if (!titles.has(m[1].toLowerCase())) errors.push("Referência sem destino em " + id + ': "' + m[1] + '"');
  for (const m of all.matchAll(/\(ver ([^)"]+)\)/g)) if (m[1] !== "Ajustes") errors.push("Referência sem aspas em " + id + ": (ver " + m[1] + ")");
}
console.log(`${blocks.size} gráficos, ${kpis.size} indicadores, ${Object.keys(G).filter(k => G[k] && G[k].t).length} explicações`);
if (errors.length) { console.log(errors.join("\n")); process.exit(1); }
console.log("OK: glossário cobre todos os indicadores e gráficos.");
