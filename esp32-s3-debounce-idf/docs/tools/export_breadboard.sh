#!/usr/bin/env bash
# Exports the breadboard benches of the study page (lessons/2-6) to docs/breadboard.png and docs/breadboard-rc.png, so
# the README and the site show the same wiring (checked by tools/site-check/wires.mjs). Run from anywhere.
set -euo pipefail
cd "$(dirname "$0")/../../.."
shot() {  # <selector> <file>
  local JS='for (const id of ["bb-plain","bb-rc"]) document.getElementById(id).hidden=false; const s=document.querySelector("'$1'"); s.classList.remove("bb-db"); for (const e of document.body.children) e.style.visibility="hidden"; document.body.appendChild(s); s.style.cssText="visibility:visible;position:absolute;left:0;top:0;width:1300px;height:auto;max-width:none;max-height:none;z-index:99999;background:#fff"; s.querySelectorAll(".kb-pill.lvl").forEach((e)=>e.remove()); document.documentElement.style.background="#fff"; document.body.style.background="#fff"; window.scrollTo(0,0);'
  node tools/site-check/elshot.mjs lessons/2-6/ "$1" "$PWD/esp32-s3-debounce-idf/docs/$2" --width 1400 --theme light --wait 900 --js "$JS"
}
shot '#bb-db' breadboard.png
shot '#bb-dbrc' breadboard-rc.png
