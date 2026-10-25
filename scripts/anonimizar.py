"""Anonimiza a saída do whatsapp-portable-viewer para o painel de estatísticas.

Lê somente <pendrive>/data/chats.js e <pendrive>/data/chat_*.js (a pasta Media não é usada)
e grava um único arquivo (padrão: dados/estatisticas.js) sem nomes, telefones nem texto de
mensagens: apenas data/hora, direção, tipo de mídia e marcações calculadas aqui
(automática, encerramento, anúncio, grupo, ligações, origem). Os ids das conversas são renumerados.

A lógica de "encerramento" e de "mensagem automática" é a mesma do painel original;
a conferência é feita comparando os números dos dois caminhos (ver tests/).

Detecção de origem (opcional):
  Passe --origens <arquivo.json> com um mapa {rótulo: [termos]} para identificar o canal de
  aquisição de cada contato novo a partir da primeira mensagem recebida. Veja origens.exemplo.json.
"""
import argparse
import json
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

CATS = ["t", "i", "d", "a", "v", "s", "o"]
CATIDX = {c: i for i, c in enumerate(CATS)}
CATMAP = {"t": "t", "i": "i", "d": "d", "a": "a", "v": "v", "g": "v", "s": "s",
          "del": "o", "l": "o", "c": "o", "p": "o"}

CLOSE_ITEMS = [
    "ok(?:ay|k+)?", "blz", "beleza", "certo", "certinho", "combinado", "perfeit[oa]", "otim[oa]", "excelente", "show", "joia", "top",
    "valeu", "vlw", "(?:muit[oa]s? |mt |mto )?(?:obrigad[oa]s?|obrigadao|obg|obgd|brigad[oa])", "agradeco", "gratidao", "grat[oa]",
    "tchau", "xau", "ciao", "ate (?:logo|mais|breve|amanha|la|ja|a proxima|segunda|terca|quarta|quinta|sexta|sabado|domingo)",
    "disponha", "de nada", "por nada", "imagina", "tmj", "abracos?", "beijos?", "bjs?", "bjos?", "igualmente", "amem",
    "entendi", "entendido", "anotad[oa]", "fechado", "fechou", "positivo", "tranquilo",
    "tenha (?:um|uma) (?:otim[oa]|excelente|bom|boa|abencoad[oa]|lind[oa]) (?:dia|tarde|noite|semana|fim de semana|fds)",
    "(?:otim[oa]|excelente|abencoad[oa]) (?:dia|tarde|noite|semana|fim de semana|fds)",
    "bom fim de semana", "bom fds", "boa semana", "(?:qualquer duvida )?(?:fico|estou) a disposicao", "sra?", "senhora?", "dra?", "doutora?",
]
CLOSE_RE = re.compile(r"^(?:(?:" + "|".join(CLOSE_ITEMS) + r")(?: |\Z))+\Z")
VOCATIVE_ONLY = re.compile(r"^(?:(?:sra?|senhora?|dra?|doutora?)(?: |\Z))+\Z")
COMBINING = re.compile("[̀-ͯ]")
NONALNUM = re.compile(r"[^a-z0-9\s]")
SPACES = re.compile(r"\s+")


def utf16_len(s):
    return len(s.encode("utf-16-le")) // 2


def norm_text(s):
    return COMBINING.sub("", unicodedata.normalize("NFD", s.lower()))


def text_key(s):
    """Chave para agrupar textos idênticos; None para textos curtos (menos de 12 caracteres)."""
    t = SPACES.sub(" ", norm_text(s)).strip()
    return t if utf16_len(t) >= 12 else None


def is_closing(text):
    if not text or "?" in text or utf16_len(text) > 90:
        return False
    t = SPACES.sub(" ", NONALNUM.sub(" ", norm_text(text))).strip()
    if not t:
        return bool(re.search(r"\S", text))
    return bool(CLOSE_RE.match(t)) and not VOCATIVE_ONLY.match(t)


def read_js_json(path, pattern):
    text = path.read_text(encoding="utf-8")
    m = re.match(pattern, text, re.DOTALL)
    if not m:
        raise ValueError(f"formato inesperado em {path.name}")
    return m


def load_patterns(path):
    """Lê arquivo de origens JSON. Retorna dict {rótulo: [termo_normalizado]}."""
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    result = {}
    for k, v in raw.items():
        if k.startswith("_"):
            continue
        terms = [norm_text(t) for t in v if isinstance(t, str) and t.strip()]
        if terms:
            result[k] = terms
    return result


def detect_origin(recs, patterns):
    """Retorna rótulo de origem da primeira mensagem recebida, ou None."""
    for r in recs:
        if r.get("m") or r.get("y") != "t" or not r.get("x"):
            continue
        t_norm = norm_text(r["x"])
        for key, terms in patterns.items():
            if any(term in t_norm for term in terms):
                return key
        break  # analisa só a primeira mensagem recebida
    return None


def main():
    here = Path(__file__).resolve().parent.parent
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pendrive", help="pasta do pendrive gerada pelo whatsapp-portable-viewer (a que contém data/)")
    ap.add_argument("--saida", default=str(here / "dados" / "estatisticas.js"), help="arquivo de saída")
    ap.add_argument("--origens", default=None, metavar="ARQUIVO",
                    help="arquivo JSON com padrões de origem dos contatos (ex: origens.json)")
    args = ap.parse_args()

    data = Path(args.pendrive) / "data"
    chats_js = data / "chats.js"
    if not chats_js.is_file():
        print(f"ERRO: não encontrei {chats_js}. Informe a pasta do pendrive gerada pelo viewer (a que contém a pasta data).", file=sys.stderr)
        return 2

    patterns = {}
    if args.origens:
        try:
            patterns = load_patterns(args.origens)
        except (OSError, ValueError, KeyError) as e:
            print(f"ERRO ao ler arquivo de origens '{args.origens}': {e}", file=sys.stderr)
            return 2
        if not patterns:
            print(f"Aviso: arquivo de origens '{args.origens}' não contém padrões válidos.", file=sys.stderr)

    meta = json.loads(read_js_json(chats_js, r"window\.CHATS=(\[.*\]);\s*window\.META=").group(1))
    is_group = {c["id"]: 1 if c.get("isGroup") else 0 for c in meta}
    del meta  # nomes e telefones nunca são usados

    raw = []      # (id, g, ad, origin, msgs[[t, m, cat, text_key, closing]])
    calls = []    # (t, m, v, d, g, id)
    failed = 0
    for cid, g in is_group.items():
        f = data / f"chat_{cid}.js"
        if not f.is_file():
            failed += 1
            continue
        try:
            recs = json.loads(read_js_json(f, r"window\.__chat\(\d+,(\[.*\])\);\s*$").group(1))
        except (ValueError, json.JSONDecodeError):
            failed += 1
            continue
        msgs, ad = [], False
        for r in recs:
            if r.get("ad"):
                ad = True
            y = r.get("y")
            if y == "x":
                continue
            if y == "k":
                calls.append((r["t"], 1 if r.get("m") else 0, 1 if r.get("cv") else 0, r.get("cd") or 0, g, cid))
                continue
            key, cl = None, 0
            if y == "t" and r.get("x"):
                key, cl = text_key(r["x"]), 1 if is_closing(r["x"]) else 0
            elif y == "s":
                cl = 1
            msgs.append([r["t"], 1 if r.get("m") else 0, CATIDX[CATMAP.get(y, "o")], key, cl, 0])
        msgs.sort(key=lambda x: x[0])  # estável, como no painel
        origin = detect_origin(recs, patterns) if patterns and not g else None
        raw.append((cid, g, 1 if ad else 0, origin, msgs))

    # mensagens automáticas: texto repetido em várias conversas e enviado em segundos após o outro lado
    stats = {}

    def walk(fn):
        for ci, (_, g, _, _origin, msgs) in enumerate(raw):
            if g:
                continue
            last_t, last_m = 0, -1
            for x in msgs:
                fast = last_m == (0 if x[1] else 1) and x[0] - last_t <= 10000
                if x[3] is not None:
                    fn(x, ci, fast)
                last_t, last_m = x[0], x[1]

    def count(x, ci, fast):
        s = stats.setdefault((x[3], x[1]), [0, 0, 0, -1])  # n, q, chats, última conversa
        s[0] += 1
        if fast:
            s[1] += 1
        if s[3] != ci:
            s[2] += 1
            s[3] = ci

    auto = {"sent": 0, "recv": 0}

    def mark(x, ci, fast):
        n, q, ch, _ = stats[(x[3], x[1])]
        r = q / n
        if (ch >= 5 and r >= 0.5) or (ch >= 8 and r >= 0.3 and fast):
            x[5] = 1
            auto["sent" if x[1] else "recv"] += 1

    walk(count)
    walk(mark)

    # renumera as conversas pela data da primeira mensagem (os ids originais não vão para a saída)
    order = sorted(range(len(raw)), key=lambda i: (raw[i][4][0][0] if raw[i][4] else float("inf"), i))
    newid = {raw[i][0]: n for n, i in enumerate(order)}

    def compress(msgs):
        return [[m[0], m[2] | (m[4] << 3) | (m[5] << 4) | (m[1] << 5)] for m in msgs]

    if patterns:
        seen_ori, ori_labels = set(), []
        for _, _, _, origin, _ in raw:
            if origin and origin not in seen_ori:
                seen_ori.add(origin)
                ori_labels.append(origin)
        ori_index = {k: i for i, k in enumerate(ori_labels)}
        chats_out = []
        for i in order:
            _, g, ad, origin, msgs = raw[i]
            chats_out.append([g, ad, ori_index.get(origin, -1), compress(msgs)])
        calls_out = sorted([[t, m, v, d, g, newid[cid]] for t, m, v, d, g, cid in calls])
        out = {"v": 2, "origins": ori_labels, "gerado": date.today().isoformat(),
               "cats": "".join(CATS), "chats": chats_out, "calls": calls_out}
    else:
        chats_out = []
        for i in order:
            _, g, ad, _origin, msgs = raw[i]
            chats_out.append([g, ad, compress(msgs)])
        calls_out = sorted([[t, m, v, d, g, newid[cid]] for t, m, v, d, g, cid in calls])
        out = {"v": 1, "gerado": date.today().isoformat(), "cats": "".join(CATS),
               "chats": chats_out, "calls": calls_out}

    dest = Path(args.saida)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text("window.STATS_DATA=" + json.dumps(out, separators=(",", ":")) + ";\n", encoding="utf-8")

    n_msgs = sum(len(c[-1]) for c in chats_out)
    print(f"OK: {len(chats_out)} conversas, {n_msgs} mensagens, {len(calls_out)} ligações "
          f"({auto['sent']} automáticas enviadas e {auto['recv']} recebidas detectadas).")
    if patterns:
        counts = {k: sum(1 for _, _, _, origin, _ in raw if origin == k) for k in ori_labels}
        total_ori = sum(counts.values())
        detail = ", ".join(f"{k}: {v}" for k, v in counts.items())
        print(f"Origens identificadas: {total_ori} contato(s) ({detail}).")
    print(f"Arquivo gerado: {dest} ({dest.stat().st_size / 1e6:.1f} MB)")
    if failed:
        print(f"Aviso: {failed} conversa(s) listada(s) em chats.js sem arquivo legível.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
