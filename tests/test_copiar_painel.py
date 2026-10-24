"""Testes de scripts/copiar_painel.py com uma árvore de arquivos inventada."""
import importlib.util
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("copiar_painel", RAIZ / "scripts" / "copiar_painel.py")
cp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cp)


@pytest.fixture
def origem(tmp_path):
    raiz = tmp_path / "projeto"
    arquivos = {
        "estatisticas.html": "<html>painel</html>", "ajuda.html": "<html>ajuda</html>",
        "stats/stats.js": "js", "stats/stats.css": "css", "stats/lib/chart.umd.js": "chart",
        "dados/estatisticas.js": "window.STATS_DATA={};",
        "scripts/anonimizar.py": "x", "docs/00.md": "x", "README.md": "x", "demo/gerar_demo.py": "x",
    }
    for rel, conteudo in arquivos.items():
        f = raiz / rel
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(conteudo, encoding="utf-8")
    return raiz


def rodar(origem, destino, mensagens=None, entrada=None, **kw):
    mensagens = [] if mensagens is None else mensagens
    resp = iter(entrada or [])
    return cp.copiar(origem, destino, entrada=lambda _p: next(resp, ""), saida=mensagens.append, **kw), "\n".join(mensagens)


def arquivos_em(pasta):
    return sorted(str(p.relative_to(pasta)).replace("\\", "/") for p in pasta.rglob("*") if p.is_file())


def test_copia_so_o_necessario_na_subpasta(origem, tmp_path):
    destino = tmp_path / "pendrive"
    codigo, _ = rodar(origem, destino, assumir_sim=True)
    assert codigo == 0
    assert arquivos_em(destino / "Estatisticas") == sorted([
        "ajuda.html", "estatisticas.html", "dados/estatisticas.js",
        "stats/lib/chart.umd.js", "stats/stats.css", "stats/stats.js"])
    assert not (destino / "Estatisticas" / "scripts").exists()
    assert (destino / "Estatisticas" / "dados" / "estatisticas.js").read_text(encoding="utf-8") == "window.STATS_DATA={};"


def test_subpasta_vazia_copia_direto_na_raiz(origem, tmp_path):
    destino = tmp_path / "pasta"
    assert rodar(origem, destino, subpasta="", assumir_sim=True)[0] == 0
    assert (destino / "estatisticas.html").is_file()


def test_sem_dados_nao_copia_o_arquivo_de_dados(origem, tmp_path):
    destino = tmp_path / "site"
    codigo, texto = rodar(origem, destino, sem_dados=True, assumir_sim=True)
    assert codigo == 0
    assert not (destino / "Estatisticas" / "dados").exists()
    assert "Nenhum dado carregado" in texto


def test_pergunta_sobre_dados_e_resposta_nao(origem, tmp_path):
    destino = tmp_path / "pasta"
    codigo, _ = rodar(origem, destino, entrada=["n"])
    assert codigo == 0
    assert not (destino / "Estatisticas" / "dados").exists()
    assert (destino / "Estatisticas" / "estatisticas.html").is_file()


def test_sem_arquivo_de_dados_avisa_e_para(origem, tmp_path):
    (origem / "dados" / "estatisticas.js").unlink()
    destino = tmp_path / "pasta"
    codigo, texto = rodar(origem, destino, assumir_sim=True)
    assert codigo == 2 and "preparar-dados" in texto
    assert not destino.exists()


def test_substituir_pergunta_antes_e_respeita_a_resposta(origem, tmp_path):
    destino = tmp_path / "pasta"
    rodar(origem, destino, assumir_sim=True)
    painel = destino / "Estatisticas" / "estatisticas.html"
    painel.write_text("versão antiga", encoding="utf-8")
    codigo, texto = rodar(origem, destino, entrada=["s", "n"])      # copiar dados: sim; substituir: não
    assert codigo == 3 and "Nada foi alterado" in texto
    assert painel.read_text(encoding="utf-8") == "versão antiga"
    codigo, _ = rodar(origem, destino, entrada=["s", "s"])
    assert codigo == 0 and painel.read_text(encoding="utf-8") == "<html>painel</html>"


def test_nunca_apaga_outros_arquivos_nem_dados_antigos(origem, tmp_path):
    destino = tmp_path / "pendrive"
    rodar(origem, destino, assumir_sim=True)
    outro = destino / "meu-arquivo.txt"
    outro.write_text("meu", encoding="utf-8")
    codigo, texto = rodar(origem, destino, sem_dados=True, assumir_sim=True)
    assert codigo == 0
    assert outro.read_text(encoding="utf-8") == "meu"
    assert (destino / "Estatisticas" / "dados" / "estatisticas.js").is_file()
    assert "NÃO foi alterado" in texto


def test_detecta_copia_corrompida(origem, tmp_path, monkeypatch):
    def copia_ruim(src, dst):
        Path(dst).write_text("corrompido", encoding="utf-8")
    monkeypatch.setattr(cp.shutil, "copyfile", copia_ruim)
    codigo, texto = rodar(origem, tmp_path / "pasta", assumir_sim=True)
    assert codigo == 1 and "não confere" in texto


@pytest.mark.parametrize("texto", ["E", "e:", "E:\\", "E:/", ' "e" '])
def test_letra_de_unidade_no_windows(texto):
    assert cp.normalizar_destino(texto, windows=True) == Path("E:\\")


def test_pastas_sao_mantidas_e_aspas_removidas():
    assert cp.normalizar_destino('"C:\\stats"', windows=True) == Path("C:\\stats")
    assert cp.normalizar_destino("/media/usb", windows=False) == Path("/media/usb")
    assert cp.normalizar_destino("e", windows=False) == Path("e")   # fora do Windows, "e" é uma pasta


def test_o_pacote_real_nao_inclui_codigo_de_desenvolvimento():
    arquivos = {str(a).replace("\\", "/") for a in cp.lista_arquivos(RAIZ, com_dados=False)}
    assert {"estatisticas.html", "ajuda.html", "stats/stats.js", "stats/lib/chart.umd.js", "stats/lib/chart.js-LICENSE.md"} <= arquivos
    assert not any(a.startswith(("scripts/", "docs/", "demo/", "tests/", ".git")) for a in arquivos)
    assert "dados/estatisticas.js" not in arquivos
