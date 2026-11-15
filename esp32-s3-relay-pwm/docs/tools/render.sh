#!/usr/bin/env bash
# Regenerates the schematics, the breadboard layouts and the timing diagram (docs/*.svg|png) with headless Chrome.
set -euo pipefail
cd "$(dirname "$0")"
for gen in gen_schematic gen_breadboard gen_timing; do
  python3 "$gen.py"
done
cd ..
render() {  # <name> <width> <height>
  google-chrome --headless=new --disable-gpu --hide-scrollbars \
    --window-size="$2,$3" --screenshot="$1.png" "file://$PWD/$1.svg" 2>/dev/null
}
render schematic-relay 1400 900
render schematic-motor 1400 900
render breadboard-relay 1320 1000
render breadboard-motor 1320 910
render timing          1320 980
echo "done"
