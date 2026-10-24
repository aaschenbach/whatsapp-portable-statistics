#!/usr/bin/env bash
# Copia o painel de estatisticas para um pendrive ou uma pasta, so com o necessario, conferindo cada arquivo.
# Uso: bash copiar-painel.sh [/destino] [--sem-dados] [--demo] [--sim]
set -e
cd "$(dirname "$0")"
export PYTHONUTF8=1

fail() { printf '\033[31m[ERRO]\033[0m %s\n' "$1" >&2; exit 1; }

DESTINO=""
EXTRA=()
for arg in "$@"; do
  case "$arg" in
    --sem-dados|--demo|--sim) EXTRA+=("$arg") ;;
    *) DESTINO="$arg" ;;
  esac
done
if [ -z "$DESTINO" ]; then
  echo "Para onde copiar o painel?"
  echo "  Pendrive ou pasta: informe o caminho, por exemplo  /media/usb  ou  ~/stats"
  read -r -p "Destino: " DESTINO
fi
[ -n "$DESTINO" ] || fail "Informe o destino."

is_py3() { "$1" --version 2>&1 | grep -q "Python 3"; }

if command -v uv >/dev/null 2>&1; then
  uv run --no-project scripts/copiar_painel.py "$DESTINO" "${EXTRA[@]}"
elif command -v python3 >/dev/null 2>&1 && is_py3 python3; then
  python3 scripts/copiar_painel.py "$DESTINO" "${EXTRA[@]}"
elif command -v python >/dev/null 2>&1 && is_py3 python; then
  python scripts/copiar_painel.py "$DESTINO" "${EXTRA[@]}"
else
  fail "Nao encontrei o uv nem o Python 3. Instale o uv (https://docs.astral.sh/uv/) ou o Python 3 e rode de novo."
fi
