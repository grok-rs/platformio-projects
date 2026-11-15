#!/usr/bin/env bash
# Exports the breadboard bench of the study page (lessons/2-5, #bb-vent) to docs/breadboard.png, so the README and the
# site show the same wiring (checked by tools/site-check/wires.mjs and railaudit.mjs). Run from anywhere.
set -euo pipefail
cd "$(dirname "$0")/../../.."
JS='const s=document.querySelector("#bb-vent"); for (const e of document.body.children) e.style.visibility="hidden"; document.body.appendChild(s); s.style.cssText="visibility:visible;position:absolute;left:0;top:0;width:1300px;height:auto;max-width:none;max-height:none;z-index:99999;background:#fff"; s.querySelectorAll(".kb-pill.lvl").forEach((e)=>e.remove()); document.documentElement.style.background="#fff"; document.body.style.background="#fff"; window.scrollTo(0,0);'
node tools/site-check/elshot.mjs lessons/2-5/ '#bb-vent' "$PWD/esp32-s3-vent-timer/docs/breadboard.png" --width 1400 --theme light --wait 900 --js "$JS"
