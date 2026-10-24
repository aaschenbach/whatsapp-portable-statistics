#!/usr/bin/env python3
"""Gera uma saída FICTÍCIA no formato do whatsapp-portable-viewer (data/chats.js e data/chat_N.js).

Nada aqui vem de conversas reais: contatos, horários, textos e ligações são sorteados com uma semente
fixa, só para demonstrar o painel, produzir as capturas de tela da documentação e rodar os testes.

    uv run demo/gerar_demo.py                 # cria demo/saida/pendrive/data/
    uv run scripts/anonimizar.py demo/saida/pendrive
"""
import json
import random
import shutil
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

SEED = 7
TZ = timezone(timedelta(hours=-3))
START = datetime(2025, 1, 1, tzinfo=TZ)
DAYS = 365
N_CONTACTS = 700
N_GROUPS = 5

GREETING = "Olá! Obrigado pelo contato. Já vamos te atender, é rapidinho."
AWAY = "Olá! No momento estamos fora do horário de atendimento. Responderemos no próximo dia útil."
TEMPLATE = "Segue a nossa tabela de serviços atualizada, qualquer dúvida é só falar por aqui."
AD_FIRST = "Oi, vi o anúncio de vocês e queria saber mais detalhes."
OPENERS = ["Bom dia, tudo bem?", "Boa tarde! Gostaria de uma informação.", "Oi, preciso de ajuda com um pedido.",
           "Olá, vocês atendem aos sábados?", "Pode me passar os valores, por favor?", "Oi! Queria agendar um horário."]
QUESTIONS = ["Qual o prazo para entrega?", "Consigo pagar no cartão?", "Pode ser na semana que vem?",
             "Vocês têm esse modelo disponível?", "Pode me enviar o endereço?", "Como funciona a garantia?"]
ANSWERS = ["Claro! Deixa eu verificar e já te confirmo.", "Sim, temos disponibilidade, qual o melhor dia para você?",
           "Perfeito, anotado aqui. Mais alguma dúvida?", "Enviei as informações, dê uma olhada, por favor.",
           "Conseguimos sim! Posso confirmar para você?"]
CLOSINGS = ["Obrigada!", "Ok, valeu 👍", "Combinado, obrigado!", "Tchau, até logo!", "👍", "Perfeito, obrigada"]


def ms(dt):
    return int(dt.timestamp() * 1000)


def pick_hour(rng):
    return rng.choices(range(24), weights=[1, 0, 0, 0, 0, 1, 2, 5, 12, 16, 18, 14, 9, 11, 15, 16, 14, 10, 6, 5, 4, 3, 2, 1])[0]


def in_hours(dt):
    return dt.weekday() < 5 and 8 <= dt.hour < 18


def next_open(dt):
    d = dt
    while not in_hours(d):
        d = (d + timedelta(hours=1)).replace(minute=rng_minute(d), second=0)
    return d


def rng_minute(d):
    return (d.minute * 7 + 13) % 60


class Gen:
    def __init__(self):
        self.rng = random.Random(SEED)
        self.mid = 0

    def rec(self, dt, me, y, **extra):
        self.mid += 1
        r = {"i": self.mid, "m": me, "t": ms(dt) + (self.rng.randint(1, 999) if me else 0), "y": y}
        r.update(extra)
        return r

    def contact_msg(self, dt, text=None):
        rng = self.rng
        roll = rng.random()
        if text is not None or roll < 0.84:
            return self.rec(dt, 0, "t", x=text or rng.choice(OPENERS + QUESTIONS))
        if roll < 0.90:
            return self.rec(dt, 0, "i", f="Media/img.jpg", mt="image/jpeg")
        if roll < 0.95:
            return self.rec(dt, 0, "a", f="Media/nota.opus", mt="audio/ogg", d=rng.randint(3, 40))
        if roll < 0.98:
            return self.rec(dt, 0, "d", x="documento.pdf", n="documento.pdf", f="Media/documento.pdf", mt="application/pdf")
        return self.rec(dt, 0, "v", f="Media/video.mp4", mt="video/mp4", d=rng.randint(4, 60))

    def our_msg(self, dt, text=None):
        rng = self.rng
        roll = rng.random()
        if text is not None or roll < 0.86:
            return self.rec(dt, 1, "t", x=text or rng.choice(ANSWERS))
        if roll < 0.92:
            return self.rec(dt, 1, "i", f="Media/img.jpg", mt="image/jpeg")
        if roll < 0.96:
            return self.rec(dt, 1, "d", x="orcamento.pdf", n="orcamento.pdf", f="Media/orcamento.pdf", mt="application/pdf")
        return self.rec(dt, 1, "a", f="Media/nota.opus", mt="audio/ogg", d=rng.randint(3, 40))

    def human_delay(self):
        # maioria rápida, com uma cauda longa
        return self.rng.lognormvariate(4.6, 1.5)  # segundos

    def session(self, start, ad=False, by_us=False):
        """Uma conversa curta: abertura, idas e vindas, encerramento. Devolve a lista de registros."""
        rng, out = self.rng, []
        t = start
        if ad:
            out.append(self.rec(t, 0, "x", x="Conversa iniciada por anúncio", ad={"t": "Anúncio", "b": "", "u": ""}))
        if by_us:
            out.append(self.our_msg(t, TEMPLATE))
            t += timedelta(seconds=self.human_delay() * 3)
        else:
            out.append(self.contact_msg(t, AD_FIRST if ad else None))
            if not in_hours(t):
                out.append(self.rec(t + timedelta(seconds=rng.randint(1, 3)), 1, "t", x=AWAY))
                t = next_open(t) + timedelta(minutes=rng.randint(0, 40))
            elif rng.random() < 0.55:
                out.append(self.rec(t + timedelta(seconds=rng.randint(1, 3)), 1, "t", x=GREETING))
        turns = min(1 + int(rng.expovariate(1 / 4)), 18)
        for _ in range(turns):
            if rng.random() < 0.07:
                return out  # contato não foi respondido
            t += timedelta(seconds=min(self.human_delay(), 86400 * 2))
            out.append(self.our_msg(t))
            if rng.random() < 0.08:
                return out  # contato parou de responder
            t += timedelta(seconds=min(self.human_delay() * 1.5, 86400))
            out.append(self.contact_msg(t))
        if rng.random() < 0.9:
            t += timedelta(seconds=min(self.human_delay(), 86400))
            out.append(self.our_msg(t))
            if rng.random() < 0.7:
                out.append(self.contact_msg(t + timedelta(seconds=rng.randint(20, 400)), rng.choice(CLOSINGS)))
        return out

    def call(self, dt, me):
        rng = self.rng
        answered = rng.random() < (0.8 if me else 0.6)
        return self.rec(dt, me, "k", cv=1 if rng.random() < 0.12 else 0, cd=rng.randint(20, 600) if answered else 0,
                        cr=5 if answered else 2)


def main():
    here = Path(__file__).resolve().parent
    out = here / "saida" / "pendrive" / "data"
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    g = Gen()
    rng = g.rng
    chats = []  # (id, titulo, grupo, registros)
    weights = [(0.35 if (START + timedelta(days=d)).weekday() >= 5 else 1.0) * (0.55 + d / DAYS) for d in range(DAYS)]
    for n in range(N_CONTACTS):
        day = rng.choices(range(DAYS), weights=weights)[0]
        start = START + timedelta(days=day, hours=pick_hour(rng), minutes=rng.randint(0, 59), seconds=rng.randint(0, 59))
        ad = rng.random() < 0.28 and day < 250
        recs = g.session(start, ad=ad, by_us=(not ad and rng.random() < 0.1))
        for _ in range(rng.choices([0, 1, 2], weights=[55, 30, 15])[0]):  # contatos que voltam depois
            back = start + timedelta(days=rng.randint(5, 120), hours=rng.randint(0, 6))
            if back < START + timedelta(days=DAYS):
                recs += g.session(back.replace(hour=pick_hour(rng)))
        for _ in range(rng.choices([0, 1, 2, 3], weights=[80, 12, 6, 2])[0]):
            when = start + timedelta(days=rng.randint(0, 90), hours=rng.randint(0, 9))
            if when < START + timedelta(days=DAYS):
                recs.append(g.call(when, rng.random() < 0.4))
        chats.append((n + 1, f"Contato {n + 1:03d}", 0, recs))
    for n in range(N_GROUPS):
        recs, t = [], START + timedelta(days=rng.randint(0, 60), hours=9)
        for _ in range(rng.randint(30, 120)):
            t += timedelta(minutes=rng.randint(5, 1500))
            recs.append(g.our_msg(t) if rng.random() < 0.3 else g.contact_msg(t))
        chats.append((N_CONTACTS + n + 1, f"Grupo {n + 1}", 1, recs))

    index = []
    for cid, title, grp, recs in chats:
        recs.sort(key=lambda r: r["t"])
        (out / f"chat_{cid}.js").write_text(f"window.__chat({cid},{json.dumps(recs, ensure_ascii=False, separators=(',', ':'))});", encoding="utf-8")
        last = recs[-1] if recs else {"t": 0, "m": 0}
        index.append({"id": cid, "title": title, "phone": "", "isGroup": grp, "lastTs": last["t"], "lastText": "", "lastMe": last["m"],
                      "count": len(recs), "hasMedia": 0, "search": title.lower()})
    total = sum(len(c[3]) for c in chats)
    meta = {"generatedAt": datetime.now().isoformat(timespec="seconds"), "messages": total, "chats": len(chats)}
    (out / "chats.js").write_text("window.CHATS=" + json.dumps(index, ensure_ascii=False, separators=(",", ":")) +
                                  ";window.META=" + json.dumps(meta) + ";", encoding="utf-8")
    print(f"Demonstração fictícia gerada em {out} ({len(chats)} conversas, {total} registros).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
