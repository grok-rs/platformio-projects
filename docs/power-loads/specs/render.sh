#!/usr/bin/env bash
# Renders the ТЗ spec sheets (tz-*.html) to ../tz-*-spec.png with headless Chrome:
# a tall screenshot, then the empty bottom is cropped (the side margins stay).
set -euo pipefail
cd "$(dirname "$0")"
for name in tz-a tz-b; do
  out="../$name-spec.png"
  google-chrome --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=1240,1800 --screenshot="$out" "file://$PWD/$name.html" 2>/dev/null
  read -r h y <<< "$(convert "$out" -trim -format '%h %Y' info: | tr -d '+')"
  convert "$out" -crop "1240x$((h + y + 46))+0+0" +repage "$out"
done
echo "done"
