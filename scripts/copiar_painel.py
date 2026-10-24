"""Copia o painel de estatísticas para um pendrive ou uma pasta, só com o que é necessário, e confere cada arquivo (SHA-256).

Copia: estatisticas.html, ajuda.html, a pasta stats/ e (opcional) dados/estatisticas.js.
Nunca apaga nada no destino. Por padrão grava numa subpasta "Estatisticas" do destino.
"""
import argparse
import hashlib
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

PAGINAS = ["estatisticas.html", "ajuda.html"]
DADOS = Path("dados") / "estatisticas.js"


def normalizar_destino(texto, windows=None):
    """Aceita 'E', 'E:', 'E:\\' (pendrive no Windows) ou um caminho de pasta."""
    windows = (os.name == "nt") if windows is None else windows
    t = texto.strip().strip('"').strip("'").strip()
    if windows and re.fullmatch(r"[A-Za-z]:?[\\/]?", t):
        return Path(t[0].upper() + ":\\")
    return Path(os.path.expanduser(t))


def lista_arquivos(raiz, com_dados):
    arquivos = [Path(p) for p in PAGINAS]
    stats = sorted(p.relative_to(raiz) for p in (raiz / "stats").rglob("*") if p.is_file())
    arquivos += stats
    if com_dados:
        arquivos.append(DADOS)
    return arquivos


def sha256(caminho):
    h = hashlib.sha256()
    with open(caminho, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def tamanho(bytes_):
    return f"{bytes_ / 1e6:.1f} MB" if bytes_ >= 1e6 else f"{bytes_ / 1e3:.0f} KB"


def perguntar(pergunta, padrao_sim, assumir_sim, entrada):
    if assumir_sim:
        return True
    sufixo = "[S/n]" if padrao_sim else "[s/N]"
    resposta = entrada(f"{pergunta} {sufixo} ").strip().lower()
    return padrao_sim if not resposta else resposta[0] in ("s", "y")


def gerar_dados_demo(raiz):
    """Gera os dados FICTÍCIOS da demonstração num arquivo temporário e devolve (arquivo, limpeza)."""
    saida_demo = raiz / "demo" / "saida"
    existia = saida_demo.exists()
    tmp = Path(tempfile.mkdtemp(prefix="painel-demo-")) / "estatisticas.js"
    py = [sys.executable]
    subprocess.run(py + [str(raiz / "demo" / "gerar_demo.py")], check=True, stdout=subprocess.DEVNULL)
    subprocess.run(py + [str(raiz / "scripts" / "anonimizar.py"), str(saida_demo / "pendrive"), "--saida", str(tmp)],
                   check=True, stdout=subprocess.DEVNULL)
    if not existia:
        shutil.rmtree(saida_demo, ignore_errors=True)
    return tmp


def copiar(raiz, destino, subpasta="Estatisticas", sem_dados=False, demo=False, assumir_sim=False,
           entrada=input, saida=print):
    """Devolve 0 em caso de sucesso, 1 erro, 2 faltam dados, 3 cancelado."""
    base = destino / subpasta if subpasta else destino
    if os.name == "nt" and destino.drive and not Path(destino.drive + "\\").exists():
        saida(f"ERRO: a unidade {destino.drive} não foi encontrada. Confira se o pendrive está conectado.")
        return 1

    dados_origem = raiz / DADOS
    tmp_demo = None
    if demo:
        saida("Gerando os dados fictícios da demonstração (nada disso vem de conversas reais)...")
        tmp_demo = gerar_dados_demo(raiz)
        dados_origem, com_dados = tmp_demo, True
    elif sem_dados:
        com_dados = False
    elif not dados_origem.is_file():
        saida("ERRO: não existe dados/estatisticas.js. Rode antes o preparar-dados (veja o README), "
              "ou use a opção de copiar sem dados.")
        return 2
    else:
        saida("O arquivo de dados não tem nomes, telefones nem texto de mensagens, mas contém as datas e horários\n"
              "de cada mensagem e ligação.")
        com_dados = perguntar("Copiar também o arquivo de dados?", True, assumir_sim, entrada)

    arquivos = lista_arquivos(raiz, com_dados)
    origem_de = {a: (dados_origem if a == DADOS else raiz / a) for a in arquivos}
    total = sum(origem_de[a].stat().st_size for a in arquivos)

    existentes = [a for a in arquivos if (base / a).exists()]
    if existentes and not perguntar(f"Já existe um painel em {base} ({len(existentes)} arquivo(s) seriam substituídos). "
                                    "Substituir os arquivos do painel?", False, assumir_sim, entrada):
        saida("Cancelado. Nada foi alterado.")
        return 3

    try:
        base.mkdir(parents=True, exist_ok=True)
        livre = shutil.disk_usage(base).free
    except OSError as erro:
        saida(f"ERRO: não consegui criar ou acessar {base}: {erro}")
        return 1
    if livre < total * 1.1:
        saida(f"ERRO: espaço insuficiente em {base} (precisa de {tamanho(total)}, há {tamanho(livre)}).")
        return 1

    for a in arquivos:
        alvo = base / a
        alvo.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(origem_de[a], alvo)
        if sha256(origem_de[a]) != sha256(alvo):
            saida(f"ERRO: a cópia de {a} não confere (arquivo corrompido ou pendrive com problema).")
            return 1
    if tmp_demo:
        shutil.rmtree(tmp_demo.parent, ignore_errors=True)

    saida(f"\nCopiados e conferidos: {len(arquivos)} arquivos ({tamanho(total)}) em {base}")
    if not com_dados and (base / DADOS).exists():
        saida("ATENÇÃO: já existia dados/estatisticas.js no destino (de uma cópia anterior). Ele NÃO foi alterado nem apagado.")
    if com_dados and not demo:
        saida("Lembrete: o arquivo de dados tem datas e horários; trate o destino como interno (ou use BitLocker To Go no pendrive).")
    if not com_dados:
        saida("Sem o arquivo de dados, o painel mostra \"Nenhum dado carregado\" até você copiar o dados/estatisticas.js.")
    saida(f"Abra {base / 'estatisticas.html'}")
    return 0


def main():
    raiz = Path(__file__).resolve().parent.parent
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("destino", nargs="?", help="pendrive (E, E: ou E:\\) ou pasta (C:\\stats, /media/usb)")
    ap.add_argument("--subpasta", default="Estatisticas", help='subpasta do destino (padrão "Estatisticas"; vazio = direto na raiz)')
    ap.add_argument("--sem-dados", action="store_true", help="não copia dados/estatisticas.js (para publicar o painel vazio)")
    ap.add_argument("--demo", action="store_true", help="copia com dados FICTÍCIOS de demonstração, em vez dos seus")
    ap.add_argument("--sim", action="store_true", help="responde sim a todas as perguntas (sem interação)")
    args = ap.parse_args()
    if args.sem_dados and args.demo:
        ap.error("use --sem-dados ou --demo, não os dois")
    texto = args.destino or input("Destino (ex.: E: para um pendrive, ou C:\\stats para uma pasta): ")
    if not texto.strip():
        print("ERRO: informe o destino.", file=sys.stderr)
        return 1
    return copiar(raiz, normalizar_destino(texto), args.subpasta, args.sem_dados, args.demo, args.sim)


if __name__ == "__main__":
    sys.exit(main())
