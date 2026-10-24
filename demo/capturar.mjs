// Gera as capturas de tela de docs/img/ a partir da demonstração FICTÍCIA.
// Requisitos: Node 18+ e Google Chrome, Microsoft Edge ou Chromium instalado. Sem dependências npm.
//
//   uv run demo/gerar_demo.py && uv run scripts/anonimizar.py demo/saida/pendrive
//   node demo/capturar.mjs
//
// Atenção: o passo acima grava dados/estatisticas.js (fictício). Apague-o depois para deixar o painel "virgem".
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const saida = join(raiz, "docs", "img");
mkdirSync(saida, { recursive: true });

if (!existsSync(join(raiz, "dados", "estatisticas.js"))) {
  console.error("Falta dados/estatisticas.js. Rode antes: uv run demo/gerar_demo.py && uv run scripts/anonimizar.py demo/saida/pendrive");
  process.exit(1);
}

const candidatos = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
].filter(Boolean);
const navegador = candidatos.find(existsSync);
if (!navegador) { console.error("Não encontrei Chrome/Edge/Chromium. Defina a variável CHROME com o caminho do executável."); process.exit(1); }

const painel = pathToFileURL(join(raiz, "estatisticas.html")).href;
const ajuda = pathToFileURL(join(raiz, "ajuda.html")).href;
const telas = [
  ["01-visao-geral", painel, "light,p-all,g-month,c-none", 1360, 1100],
  ["02-contatos", painel, "light,contacts,p-all,g-month,c-none", 1360, 1250],
  ["03-comparacao", painel, "light,contacts,p-qtd,g-month,c-prev,fechado", 1360, 1250],
  ["04-intervalos-parciais", painel, "light,contacts,p-90d,g-month,c-prev", 1360, 1250],
  ["05-tempo-de-resposta", painel, "light,resp,p-all,g-month,c-none", 1360, 1400],
  ["06-ligacoes", painel, "light,calls,p-all,g-month,c-none", 1360, 1250],
  ["07-volume-e-performance", painel, "light,perf,p-all,g-month,c-none", 1360, 1500],
  ["08-ajustes", painel, "light,adv,p-all,g-month,c-none", 1360, 1000],
  ["09-ajuda", ajuda, "", 1000, 1000],
];

for (const [nome, url, hash, largura, altura] of telas) {
  const destino = join(saida, `${nome}.png`);
  execFileSync(navegador, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", `--window-size=${largura},${altura}`,
    "--virtual-time-budget=40000", `--screenshot=${destino}`, hash ? `${url}#${hash}` : url,
  ], { stdio: "ignore" });
  console.log("gerado", destino);
}
