#!/usr/bin/env bash
# Regenerates the schematic and the breadboard layout (docs/*.svg|png) with
# headless Chrome, then copies the PNGs to the study page (docs/power-loads/ in the repo root,
# served by GitHub Pages — it cannot reference files outside docs/).
set -euo pipefail
cd "$(dirname "$0")"
for gen in gen_schematic gen_breadboard; do
  python3 "$gen.py"
done
cd ..
render() {  # <name> <width> <height>
  google-chrome --headless=new --disable-gpu --hide-scrollbars \
    --window-size="$2,$3" --screenshot="$1.png" "file://$PWD/$1.svg" 2>/dev/null
}
render schematic  1320 860
render breadboard 1320 840

site=../../docs/power-loads
cp schematic.png  "$site/led-switch-schematic.png"
cp breadboard.png "$site/led-switch-breadboard.png"
echo "done"
