"""Testes do anonimizador (scripts/anonimizar.py) com dados 100% inventados."""
import importlib.util
import json
import re
import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("anonimizar", RAIZ / "scripts" / "anonimizar.py")
anon = importlib.util.module_from_spec(spec)
spec.loader.exec_module(anon)

T0 = 1_700_000_000_000
TEXTO_AUTOMATICO = "Olá! Já recebemos a sua mensagem e vamos responder em instantes."
TEXTO_MANUAL = "Segue o nosso catálogo completo com todos os preços atualizados."


def escrever_pendrive(base, chats):
    """chats: lista de (id, título, é_grupo, registros). Grava no formato do viewer."""
    data = base / "data"
    data.mkdir(parents=True)
    indice = [{"id": cid, "title": titulo, "phone": "5500000000000", "isGroup": g} for cid, titulo, g, _ in chats]
    (data / "chats.js").write_text("window.CHATS=" + json.dumps(indice) + ';window.META={"messages": 1};', encoding="utf-8")
    for cid, _, _, regs in chats:
        (data / f"chat_{cid}.js").write_text(f"window.__chat({cid},{json.dumps(regs)});", encoding="utf-8")
    return base


def rodar(pendrive, saida, monkeypatch, origens=None):
    argv = ["anonimizar.py", str(pendrive), "--saida", str(saida)]
    if origens is not None:
        argv += ["--origens", str(origens)]
    monkeypatch.setattr(sys, "argv", argv)
    return anon.main()


def msgs_de(chat, dados):
    """Retorna a lista de [t, flags] do chat, compatível com v:1 e v:2."""
    return chat[3] if dados.get("v") == 2 else chat[2]


def carregar(saida):
    texto = saida.read_text(encoding="utf-8")
    assert texto.startswith("window.STATS_DATA=")
    return json.loads(texto[len("window.STATS_DATA="):].rstrip().rstrip(";"))


def decodificar(flags):
    return {"cat": flags & 7, "enc": (flags >> 3) & 1, "auto": (flags >> 4) & 1, "m": (flags >> 5) & 1}


def cenario_basico():
    chats = []
    # 6 conversas em que o mesmo texto é enviado 2 s após a mensagem do contato -> automática
    for k in range(6):
        t = T0 + k * 3_600_000
        chats.append((9000 + k, f"SEGREDO Nome {k}", 0, [
            {"i": 1, "m": 0, "t": t, "y": "t", "x": f"Oi, quero saber mais sobre o item número {k}"},
            {"i": 2, "m": 1, "t": t + 2000, "y": "t", "x": TEXTO_AUTOMATICO},
            {"i": 3, "m": 1, "t": t + 400_000, "y": "t", "x": "Claro, já te passo os detalhes."},
        ]))
    # 6 conversas em que o mesmo texto é enviado por uma pessoa, minutos depois -> NÃO é automática
    for k in range(6):
        t = T0 + 100_000_000 + k * 3_600_000
        chats.append((9100 + k, f"SEGREDO Outro {k}", 0, [
            {"i": 1, "m": 0, "t": t, "y": "t", "x": f"Bom dia, pedido {k}"},
            {"i": 2, "m": 1, "t": t + 300_000, "y": "t", "x": TEXTO_MANUAL},
        ]))
    return chats


def test_encerramentos():
    for texto in ["Obrigada!", "ok", "Ok, valeu 👍", "Tchau, até logo", "👍", "Tenha uma ótima semana!", "Obrigado doutora", "Disponha"]:
        assert anon.is_closing(texto), texto
    for texto in ["Bom dia", "Obrigada, vou pensar", "Pode ser terça?", "Sim", "ok pode ser amanhã?", "???", "", "Doutora", "x" * 120]:
        assert not anon.is_closing(texto), texto


def test_chave_de_texto_ignora_textos_curtos_e_variacoes():
    assert anon.text_key("ok") is None
    assert anon.text_key("Olá,   tudo BEM com você?") == anon.text_key("ola, tudo bem com voce?")
    assert anon.text_key("Olá, tudo bem com você?") is not None


def test_nao_vaza_nome_telefone_nem_texto(tmp_path, monkeypatch):
    pend = escrever_pendrive(tmp_path / "pendrive", cenario_basico())
    saida = tmp_path / "saida" / "estatisticas.js"
    assert rodar(pend, saida, monkeypatch) == 0
    bruto = saida.read_text(encoding="utf-8")
    for proibido in ["SEGREDO", "5500000000000", "catálogo", "preços", "Claro", "quero saber"]:
        assert proibido not in bruto
    dados = carregar(saida)

    def so_numeros(valor):
        if isinstance(valor, list):
            return all(so_numeros(v) for v in valor)
        return isinstance(valor, int)

    # chats e calls só podem conter números (nomes, telefones e textos não devem vazar)
    # origins (quando presente) contém rótulos definidos pelo usuário, não dados pessoais
    assert so_numeros(dados["chats"]) and so_numeros(dados["calls"])
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", dados["gerado"]) and dados["cats"] == "tidavso"


def test_automaticas_so_quando_repetidas_e_rapidas(tmp_path, monkeypatch, capsys):
    pend = escrever_pendrive(tmp_path / "pendrive", cenario_basico())
    saida = tmp_path / "estatisticas.js"
    rodar(pend, saida, monkeypatch)
    dados = carregar(saida)
    automaticas = manuais = 0
    for chat in dados["chats"]:
        for t, flags in msgs_de(chat, dados):
            d = decodificar(flags)
            if d["auto"]:
                automaticas += 1
                assert d["m"] == 1
            elif d["m"] == 1 and d["cat"] == 0:
                manuais += 1
    assert automaticas == 6
    assert manuais == 6 + 6  # respostas rápidas legítimas + o catálogo enviado à mão
    assert "6 automáticas enviadas" in capsys.readouterr().out


def test_tipos_grupo_anuncio_ligacoes_e_renumeracao(tmp_path, monkeypatch):
    chats = [
        (8123, "SEGREDO A", 0, [
            {"i": 1, "m": 0, "t": T0 + 5000, "y": "t", "x": "Obrigada!"},
            {"i": 2, "m": 0, "t": T0 + 6000, "y": "s"},
            {"i": 3, "m": 1, "t": T0 + 7000, "y": "g"},
            {"i": 4, "m": 0, "t": T0 + 8000, "y": "del"},
            {"i": 5, "m": 0, "t": T0 + 9000, "y": "x", "x": "Aviso do sistema"},
            {"i": 6, "m": 1, "t": T0 + 10000, "y": "k", "cv": 1, "cd": 120, "cr": 5},
        ]),
        (8124, "SEGREDO B", 0, [
            {"i": 1, "m": 0, "t": T0, "y": "x", "x": "Conversa iniciada por anúncio", "ad": {"t": "", "b": "", "u": ""}},
            {"i": 2, "m": 0, "t": T0 + 1000, "y": "t", "x": "Bom dia, gostaria de informações"},
        ]),
        (8125, "SEGREDO Grupo", 1, [{"i": 1, "m": 0, "t": T0 + 20000, "y": "i"}]),
        (8126, "SEGREDO Só ligação", 0, [{"i": 1, "m": 0, "t": T0 + 30000, "y": "k", "cv": 0, "cd": 0, "cr": 2}]),
    ]
    pend = escrever_pendrive(tmp_path / "pendrive", chats)
    saida = tmp_path / "estatisticas.js"
    assert rodar(pend, saida, monkeypatch) == 0
    dados = carregar(saida)

    # ordenadas pela 1ª mensagem; as sem mensagem ficam no fim; ids originais não aparecem
    assert [len(msgs_de(c, dados)) for c in dados["chats"]] == [1, 4, 1, 0]
    por_ad = [c for c in dados["chats"] if c[1] == 1]
    assert len(por_ad) == 1 and len(msgs_de(por_ad[0], dados)) == 1
    grupos = [c for c in dados["chats"] if c[0] == 1]
    assert len(grupos) == 1

    a = next(c for c in dados["chats"] if len(msgs_de(c, dados)) == 4)
    decod = [decodificar(f) for _, f in msgs_de(a, dados)]
    assert decod[0]["enc"] == 1 and decod[0]["m"] == 0          # "Obrigada!" -> encerramento recebido
    assert decod[1]["enc"] == 1                                   # figurinha -> encerramento
    assert decod[2]["cat"] == dados["cats"].index("v") and decod[2]["m"] == 1   # GIF conta como vídeo
    assert decod[3]["cat"] == dados["cats"].index("o")            # apagada -> outros
    # sistema ("x") fora das mensagens; ligações separadas, apontando para a conversa renumerada
    assert len(dados["calls"]) == 2
    idx_a = next(i for i, c in enumerate(dados["chats"]) if len(msgs_de(c, dados)) == 4)
    chamada_a = next(c for c in dados["calls"] if c[5] == idx_a)
    assert chamada_a[:5] == [T0 + 10000, 1, 1, 120, 0]
    assert all(0 <= c[5] < len(dados["chats"]) for c in dados["calls"])
    assert "8123" not in json.dumps(dados)


def test_pasta_invalida_e_arquivo_ausente(tmp_path, monkeypatch, capsys):
    assert rodar(tmp_path / "nao-existe", tmp_path / "x.js", monkeypatch) == 2
    assert "data" in capsys.readouterr().err
    pend = escrever_pendrive(tmp_path / "pendrive", [(1, "SEGREDO", 0, [{"i": 1, "m": 0, "t": T0, "y": "t", "x": "Olá, tudo bem?"}])])
    (pend / "data" / "chat_1.js").unlink()
    saida = tmp_path / "ok.js"
    assert rodar(pend, saida, monkeypatch) == 0
    assert carregar(saida)["chats"] == []
    assert "sem arquivo legível" in capsys.readouterr().err


@pytest.mark.skipif(not (RAIZ / "demo" / "gerar_demo.py").exists(), reason="demo ausente")
def test_demonstracao_ficticia_passa_pelo_anonimizador(tmp_path, monkeypatch):
    spec_demo = importlib.util.spec_from_file_location("gerar_demo", RAIZ / "demo" / "gerar_demo.py")
    demo = importlib.util.module_from_spec(spec_demo)
    spec_demo.loader.exec_module(demo)
    demo.N_CONTACTS = 40
    monkeypatch.setattr(demo, "__file__", str(tmp_path / "demo" / "gerar_demo.py"))
    assert demo.main() == 0
    saida = tmp_path / "estatisticas.js"
    assert rodar(tmp_path / "demo" / "saida" / "pendrive", saida, monkeypatch) == 0
    dados = carregar(saida)
    assert len(dados["chats"]) == 40 + demo.N_GROUPS
    assert sum(len(msgs_de(c, dados)) for c in dados["chats"]) > 400


# ---------- testes de detecção de origem ----------

def _origens_json(tmp_path, conteudo):
    p = tmp_path / "origens.json"
    p.write_text(json.dumps(conteudo), encoding="utf-8")
    return p


def test_sem_origens_mantem_v1(tmp_path, monkeypatch):
    pend = escrever_pendrive(tmp_path / "pend", [(1, "X", 0, [
        {"i": 1, "m": 0, "t": T0, "y": "t", "x": "vim pelo instagram"},
    ])])
    saida = tmp_path / "s.js"
    assert rodar(pend, saida, monkeypatch) == 0
    dados = carregar(saida)
    assert dados["v"] == 1
    assert "origins" not in dados
    assert len(dados["chats"][0]) == 3  # [g, ad, msgs]


def test_origem_detectada(tmp_path, monkeypatch):
    pend = escrever_pendrive(tmp_path / "pend", [
        (1, "X", 0, [{"i": 1, "m": 0, "t": T0, "y": "t", "x": "vim pelo instagram"}]),
        (2, "Y", 0, [{"i": 1, "m": 0, "t": T0 + 1000, "y": "t", "x": "pesquisei no google"}]),
        (3, "Z", 0, [{"i": 1, "m": 0, "t": T0 + 2000, "y": "t", "x": "Bom dia, quero informações"}]),
    ])
    ori = _origens_json(tmp_path, {"instagram": ["instagram"], "google": ["google"]})
    saida = tmp_path / "s.js"
    assert rodar(pend, saida, monkeypatch, origens=ori) == 0
    dados = carregar(saida)
    assert dados["v"] == 2
    assert set(dados["origins"]) == {"instagram", "google"}
    ori_idx = {dados["origins"][c[2]]: c for c in dados["chats"] if c[2] >= 0}
    assert "instagram" in ori_idx
    assert "google" in ori_idx
    sem_origem = [c for c in dados["chats"] if c[2] == -1]
    assert len(sem_origem) == 1  # "Bom dia..." não tem padrão


def test_origem_nao_detectada(tmp_path, monkeypatch):
    pend = escrever_pendrive(tmp_path / "pend", [(1, "X", 0, [
        {"i": 1, "m": 0, "t": T0, "y": "t", "x": "Boa tarde, quero uma consulta"},
    ])])
    ori = _origens_json(tmp_path, {"instagram": ["instagram"]})
    saida = tmp_path / "s.js"
    assert rodar(pend, saida, monkeypatch, origens=ori) == 0
    dados = carregar(saida)
    assert dados["v"] == 2
    assert dados["chats"][0][2] == -1


def test_origem_ignora_enviadas(tmp_path, monkeypatch):
    pend = escrever_pendrive(tmp_path / "pend", [(1, "X", 0, [
        {"i": 1, "m": 1, "t": T0, "y": "t", "x": "Olá, posso ajudar?"},
        {"i": 2, "m": 0, "t": T0 + 5000, "y": "t", "x": "Sim, vim pelo instagram"},
    ])])
    ori = _origens_json(tmp_path, {"instagram": ["instagram"]})
    saida = tmp_path / "s.js"
    assert rodar(pend, saida, monkeypatch, origens=ori) == 0
    dados = carregar(saida)
    assert dados["v"] == 2
    assert dados["chats"][0][2] == dados["origins"].index("instagram")


def test_origem_normaliza_acentos(tmp_path, monkeypatch):
    pend = escrever_pendrive(tmp_path / "pend", [(1, "X", 0, [
        {"i": 1, "m": 0, "t": T0, "y": "t", "x": "Indicação da minha amiga"},
    ])])
    ori = _origens_json(tmp_path, {"indicacao": ["indicacao"]})
    saida = tmp_path / "s.js"
    assert rodar(pend, saida, monkeypatch, origens=ori) == 0
    dados = carregar(saida)
    assert dados["v"] == 2
    assert dados["chats"][0][2] == dados["origins"].index("indicacao")


def test_origem_sem_msg_recebida(tmp_path, monkeypatch):
    pend = escrever_pendrive(tmp_path / "pend", [(1, "X", 0, [
        {"i": 1, "m": 1, "t": T0, "y": "t", "x": "Olá, tudo bem?"},
        {"i": 2, "m": 1, "t": T0 + 1000, "y": "t", "x": "vim pelo instagram"},
    ])])
    ori = _origens_json(tmp_path, {"instagram": ["instagram"]})
    saida = tmp_path / "s.js"
    assert rodar(pend, saida, monkeypatch, origens=ori) == 0
    dados = carregar(saida)
    assert dados["v"] == 2
    assert dados["chats"][0][2] == -1


def test_origens_ignora_grupos(tmp_path, monkeypatch):
    pend = escrever_pendrive(tmp_path / "pend", [
        (1, "G", 1, [{"i": 1, "m": 0, "t": T0, "y": "t", "x": "vim pelo instagram"}]),
        (2, "I", 0, [{"i": 1, "m": 0, "t": T0 + 1000, "y": "t", "x": "vim pelo instagram"}]),
    ])
    ori = _origens_json(tmp_path, {"instagram": ["instagram"]})
    saida = tmp_path / "s.js"
    assert rodar(pend, saida, monkeypatch, origens=ori) == 0
    dados = carregar(saida)
    grupo = next(c for c in dados["chats"] if c[0] == 1)
    indiv = next(c for c in dados["chats"] if c[0] == 0)
    assert grupo[2] == -1   # grupo não tem origem detectada
    assert indiv[2] == dados["origins"].index("instagram")
