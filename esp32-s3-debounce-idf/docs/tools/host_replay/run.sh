#!/usr/bin/env bash
# PC simulation, NOT a bench result: compiles the real cpp/src/*.c with stub FreeRTOS and GPIO headers and feeds them
# edges (invented scenarios and the 190 events recorded on the bench, docs/bounce-bench). Output: results/replay-on-pc.txt
set -euo pipefail
cd "$(dirname "$0")"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
python3 gen.py "$T" >/dev/null
OUT=../../../results/replay-on-pc.txt; mkdir -p ../../../results
{
echo "# СИМУЛЯЦІЯ НА ПК, а не вимірювання на платі. Справжні cpp/src/*.c зі заглушками FreeRTOS і GPIO."
echo "# Час модельний, тому «реакція» — це лише логіка затримки. Перезапуск: docs/tools/host_replay/run.sh"
echo "# Сценарії: A — 5 чистих натискань; B — 5 з брязкотом в обидва боки; C — 3 натискання по 30 мс;"
echo "# D — утримання 2,5 с і натискання 200 мс; E — 190 подій стенду 17.10, 91 натискання, утримання 200 мс."
for sc in A_clean B_bouncy C_short D_long E_real; do
  echo; echo "=== $sc"
  for st in raw time state poll; do
    gcc -O1 -w -Iinclude harness.c ../../../cpp/src/$st.c -o "$T/run"
    printf -- "--- %s: " "$st"
    r=$("$T/run" "$T/$sc.edges" | grep -E 'переривань:|прийнято:|натискань:' | tail -1 || true); echo "${r:-нічого не прийнято}"
  done
done; } > "$OUT"
echo "written $OUT"
