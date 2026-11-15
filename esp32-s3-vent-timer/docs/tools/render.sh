#!/usr/bin/env bash
# Regenerates the schematic and the diagrams (docs/*.svg|png) with headless Chrome.
set -euo pipefail
cd "$(dirname "$0")"
python3 gen_schematic.py
python3 gen_diagrams.py
cd ..
google-chrome --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1320,830 --screenshot=schematic.png "file://$PWD/schematic.svg" 2>/dev/null
google-chrome --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1320,950 --screenshot=timing.png "file://$PWD/timing.svg" 2>/dev/null
google-chrome --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1320,640 --screenshot=architecture.png "file://$PWD/architecture.svg" 2>/dev/null
echo "done"
