#!/usr/bin/env bash
# Run API + frontend dev server together.
# Usage: bash scripts/dev.sh
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

RED='\033[0;31m'
CYN='\033[0;36m'
GRN='\033[0;32m'
YLW='\033[0;33m'
DIM='\033[2m'
RST='\033[0m'

cleanup() {
  echo -e "\n${YLW}Stopping…${RST}"
  kill "${API_PID:-}" "${UI_PID:-}" 2>/dev/null
  wait "${API_PID:-}" "${UI_PID:-}" 2>/dev/null
  echo -e "${YLW}Done.${RST}"
  exit 0
}
trap cleanup INT TERM

tag() {
  local label="$1" color="$2"
  while IFS= read -r line; do
    printf "${color}[%-3s]${RST} ${DIM}%s${RST}\n" "$label" "$line"
  done
}

if [[ ! -f .venv/Scripts/petmonitor-api.exe ]]; then
  echo -e "${RED}Error:${RST} .venv/Scripts/petmonitor-api.exe not found."
  echo -e "       Run: pip install -e . (inside .venv) first."
  exit 1
fi

echo -e "${GRN}╔══════════════════════════════════╗${RST}"
echo -e "${GRN}║      PetMonitor AI — dev         ║${RST}"
echo -e "${GRN}╚══════════════════════════════════╝${RST}"
echo -e "  ${CYN}API${RST}  → http://127.0.0.1:8000"
echo -e "  ${RED}UI${RST}   → http://localhost:5173"
echo -e "  ${DIM}Ctrl+C to stop both${RST}\n"

.venv/Scripts/petmonitor-api.exe 2>&1 | tag "API" "$CYN" &
API_PID=$!

npm run dev --prefix frontend 2>&1 | tag "UI" "$RED" &
UI_PID=$!

wait "${API_PID}" "${UI_PID}"
