#!/usr/bin/env bash
# Regenerates the SVG diagrams and renders them to PNG with headless Chrome.
set -euo pipefail
cd "$(dirname "$0")"
for gen in gen_schematic gen_breadboard gen_breadboard_min gen_breadboard_single; do
  python3 "$gen.py"
done
cd ..
render() {  # <name> <width> <height>
  google-chrome --headless=new --disable-gpu --hide-scrollbars \
    --window-size="$2,$3" --screenshot="$1.png" "file://$PWD/$1.svg" 2>/dev/null
}
render schematic            1400 660
render breadboard           1320 700
render breadboard_step1     1320 640
render breadboard_single_gpio 1320 690
echo "done"
