#!/usr/bin/env bash
# Exports the schematic and the breadboard bench of the study page (lessons/6-1, section 08) to docs/*.png, so the
# README and the site show the same wiring (the site's wiring is checked by tools/site-check/wires.mjs). Run from anywhere.
set -euo pipefail
cd "$(dirname "$0")/../../.."
OUT="$PWD/esp32-s3-freertos-device/docs"
shot() {  # <selector> <out.png> <width px>
  JS="const s=document.querySelector('$1'); s.setAttribute('data-shot',''); for (const e of document.body.children) e.style.visibility='hidden'; document.body.appendChild(s); s.style.cssText='visibility:visible;position:absolute;left:0;top:0;width:$3px;height:auto;max-width:none;max-height:none;z-index:99999;background:#fff;padding:12px'; s.querySelectorAll('.kb-pill.lvl').forEach((e)=>e.remove()); document.documentElement.style.background='#fff'; document.body.style.background='#fff'; window.scrollTo(0,0);"
  node tools/site-check/elshot.mjs lessons/6-1/ '[data-shot]' "$2" --width $(($3 + 100)) --theme light --wait 900 --js "$JS"
}
shot '#dual-mt [data-view="sch"] svg' "$OUT/schematic.png" 640
shot '#bb-mt' "$OUT/breadboard.png" 1300
echo "done"
