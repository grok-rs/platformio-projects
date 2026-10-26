#!/usr/bin/env bash
# Regenerates docs/schematic.svg and renders it to PNG with headless Chrome.
set -euo pipefail
cd "$(dirname "$0")"
python3 gen_schematic.py
cd ..
google-chrome --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1200,700 --screenshot=schematic.png "file://$PWD/schematic.svg" 2>/dev/null
echo "done"
