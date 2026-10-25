#!/usr/bin/env bash
# Prepara os dados do painel de estatisticas a partir do pendrive gerado pelo whatsapp-portable-viewer.
# Uso: bash preparar-dados.sh [/caminho/do/pendrive] [/outro/estatisticas.js] [/origens.json]
set -e
cd "$(dirname "$0")"
export PYTHONUTF8=1

fail() { printf '\033[31m[ERRO]\033[0m %s\n' "$1" >&2; exit 1; }

PENDRIVE="$1"
SAIDA="$2"
ORIGENS="${3:-}"
if [ -z "$PENDRIVE" ]; then
  echo "Informe a pasta do pendrive gerada pelo whatsapp-portable-viewer"
  echo '(a pasta que contem a subpasta "data"; a pasta Media nao e usada).'
  read -r -p "Pasta: " PENDRIVE
fi
PENDRIVE="${PENDRIVE%\"}"; PENDRIVE="${PENDRIVE#\"}"
PENDRIVE="${PENDRIVE/#\~/$HOME}"
[ -f "$PENDRIVE/data/chats.js" ] || fail "Nao encontrei data/chats.js em '$PENDRIVE'. Informe a pasta gerada pelo viewer (a que contem a pasta data)."

if [ -z "$ORIGENS" ] && [ -f "$(dirname "$0")/origens.exemplo.json" ]; then
  echo
  read -rp "Detectar o canal de origem dos contatos usando o arquivo de exemplo (origens.exemplo.json)? [S/N] " resp
  case "$resp" in
    [Ss]*)
      ORIGENS="$(dirname "$0")/origens.exemplo.json"
      echo "Usando origens.exemplo.json. Para personalizar, copie para origens.json e ajuste os termos."
      ;;
  esac
fi

EXTRA=()
[ -n "$SAIDA" ]   && EXTRA+=(--saida "$SAIDA")
[ -n "$ORIGENS" ] && EXTRA+=(--origens "$ORIGENS")

is_py3() { "$1" --version 2>&1 | grep -q "Python 3"; }

echo
echo "Anonimizando e gerando o arquivo de estatisticas..."
if command -v uv >/dev/null 2>&1; then
  uv run --no-project scripts/anonimizar.py "$PENDRIVE" "${EXTRA[@]}"
elif command -v python3 >/dev/null 2>&1 && is_py3 python3; then
  python3 scripts/anonimizar.py "$PENDRIVE" "${EXTRA[@]}"
elif command -v python >/dev/null 2>&1 && is_py3 python; then
  python scripts/anonimizar.py "$PENDRIVE" "${EXTRA[@]}"
else
  fail "Nao encontrei o uv nem o Python 3. Instale o uv (https://docs.astral.sh/uv/) ou o Python 3 e rode de novo."
fi

echo
echo "Pronto. Abra estatisticas.html neste diretorio para ver o painel."
echo "O arquivo gerado nao contem nomes, telefones nem texto de mensagens."
