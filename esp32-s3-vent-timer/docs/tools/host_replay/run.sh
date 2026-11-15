#!/usr/bin/env bash
# PC simulation, NOT a bench result: compiles the real cpp/src/main.c against stub ESP-IDF headers and a model clock.
# -Wno-format: int64_t/uint32_t are long/int on the PC but long long/long in ESP-IDF; the firmware build checks formats.
# Output: results/simulation-on-pc.txt
set -euo pipefail
cd "$(dirname "$0")"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
gcc -std=gnu17 -Wall -Wno-unused-parameter -Wno-format -Iinclude harness.c ../../../cpp/src/main.c -o "$T/run"
OUT=../../../results/simulation-on-pc.txt; mkdir -p ../../../results
{
echo "# СИМУЛЯЦІЯ НА ПК, а не вивід плати. Справжній cpp/src/main.c із заглушками ESP-IDF, час модельний."
echo "# Це перевірка логіки: на платі числа мс відрізнятимуться. Перезапуск: docs/tools/host_replay/run.sh"
echo; echo "=== normal: SPEEDUP 300, нічого не натискаємо"; "$T/run" normal
echo; echo "=== button: S1 о 5 с і 12,5 с (чекає: цикл спочатку) та о 13 с (працює: ігнорується, робота не подовжилась)"; "$T/run" button
echo; echo "=== hang: таймер зупинився о 7 с"; "$T/run" hang
} > "$OUT"
echo "written $OUT"
