# Generates ../breadboard.svg — the same circuit as schematic.svg on a full-size breadboard:
# YD-ESP32-S3 on the left, GPIO6/5/4 → 220 Ω → red/yellow/green LED → top «−» rail ← pin G.
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..',
                                'esp32-s3-bounce-test', 'docs', 'tools'))
from yd_board import Svg, breadboard, esp32, resistor, led, rx, j1_row, COL, RAIL, BANDS_220

s = Svg(1320, 680)
s.text(20, 34, "Проєкт A «Три ритми» на макетці: GPIO6 → червоний, GPIO5 → жовтий, GPIO4 → зелений, усі через 220 Ω на GND", 19, "start", "bold", "#112")
breadboard(s)
s.text(rx(31)+9, 131, "розрив шини", 9, "middle", "normal", "#b91c1c")
esp32(s, 'h', 'a', used_top=("4", "5", "6", "G"))

RED, YELLOW, GREEN, BLK = "#d32f2f", "#f9a825", "#2e7d32", "#222"
# (GPIO name, resistor start row, colour, labels)
circuits = [("6", 27, RED,    "R1 220 Ω", "LED1 ← GPIO6"),
            ("5", 35, YELLOW, "R2 220 Ω", "LED2 ← GPIO5"),
            ("4", 43, GREEN,  "R3 220 Ω", "LED3 ← GPIO4")]
for gpio, dst, col, rl, dl in circuits:
    resistor(s, dst, dst+4, COL['i'], BANDS_220, rl)
    led(s, dst+4, COL['h'], col, dl, "#8a6d00" if col == YELLOW else None)
    s.wire(rx(dst+5), COL['j'], rx(dst+5), RAIL['tn'], BLK)             # cathode -> GND rail
for gpio, dst, col, rl, dl in circuits:
    src = j1_row(gpio)
    s.wire(rx(src), COL['j'], rx(dst), COL['j'], col, bulge=40 + (dst-src)*2.2)   # GPIO -> resistor
g = j1_row("G")
s.wire(rx(g), COL['j'], rx(g+1), RAIL['tn'], BLK)                       # ESP32 G -> rail (row 1 has no rail hole)
s.wire(rx(30), RAIL['tn'], rx(33), RAIL['tn'], BLK, bulge=30)           # bridge the split rail
s.text(rx(31)+9, 48, "перемичка через розрив", 9, "middle", "normal", "#b91c1c")
s.text(rx(g+1)+8, 74-4, "G", 10, "start", "bold", "#222")

ny = 500
def note(t, dy, bold=False): s.text(20, ny+dy, t, 13, "start", "bold" if bold else "normal", "#222")
note("1.  Плата — через центральний канал; над верхнім гребінцем (3V3, 3V3, RST, 4, 5, 6, 7, …, 5V, G) лишається 1–2 вільні отвори для перемичок.", 0)
note("2.  LED: довга ніжка (+) — у ряд резистора, коротка (−, зріз на корпусі) — чорною перемичкою на шину «−». Резистор 220 Ω: червоний-червоний-коричневий.", 24)
note("3.  Чорна перемичка: пін G (останній на гребінці, біля USB-C; поруч 5V — не переплутати!) → шина «−». Шина розірвана посередині — перемичка 30→33.", 48)
note("4.  Живлення, прошивка й Serial — один кабель у роз'єм «USB» (нативний USB, не «COM»). Шина «+» не потрібна: «плюс» кожному LED дає сам GPIO.", 72, True)
lx, ly = 20, ny+110
for c, l, dx in ((RED, "GPIO6 → R1 (200 мс)", 0), (YELLOW, "GPIO5 → R2 (500 мс)", 200), (GREEN, "GPIO4 → R3 (1000 мс)", 400), (BLK, "GND", 610)):
    s.line(lx+dx, ly, lx+dx+28, ly, 4.5, c); s.text(lx+dx+36, ly+4, l, 12)

s.add('</svg>')                                                   # Svg.save() writes next to yd_board.py
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'breadboard.svg'), 'w').write("\n".join(s.out))
print("ok")
