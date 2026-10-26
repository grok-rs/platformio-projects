# Generates ../schematic.svg — Проєкт A «Три ритми»: three LEDs, each GPIO → 220 Ω → LED → common GND.
# Wiring on the bench: GPIO6 → red (LED1, 200 ms), GPIO5 → yellow (LED2, 500 ms), GPIO4 → green (LED3, 1000 ms).
import math, os

W, H = 1200, 720
WIRE = "#222"
out = []
def add(s): out.append(s)

def text(x, y, s, size=15, anchor="start", weight="normal", fill="#222", family="DejaVu Sans, Arial, sans-serif"):
    add(f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}" font-weight="{weight}" fill="{fill}" font-family="{family}">{s}</text>')

def line(x1, y1, x2, y2, w=2.5, color=WIRE):
    add(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{w}" stroke-linecap="round"/>')

def dot(x, y, color=WIRE):
    add(f'<circle cx="{x}" cy="{y}" r="5" fill="{color}"/>')

def arrow(x1, y1, x2, y2, color=WIRE, w=1.6):
    line(x1, y1, x2, y2, w, color)
    a = math.atan2(y2 - y1, x2 - x1)
    p = [(x2, y2), (x2 - 9*math.cos(a - .45), y2 - 9*math.sin(a - .45)), (x2 - 9*math.cos(a + .45), y2 - 9*math.sin(a + .45))]
    add('<polygon points="' + " ".join(f"{x:.1f},{y:.1f}" for x, y in p) + f'" fill="{color}"/>')

def pin_r(x, y, label):          # header pin on the right edge of the ESP32 box
    add(f'<rect x="{x - 6}" y="{y - 6}" width="12" height="12" fill="#c9a227" stroke="#7a5f00" stroke-width="1.5"/>')
    text(x - 14, y + 6, label, 17, "end", "bold", "#223")

def res_h(x, y, value):          # horizontal resistor, body x..x+90
    add(f'<rect x="{x}" y="{y-12}" width="90" height="24" fill="#fff6d5" stroke="{WIRE}" stroke-width="2"/>')
    text(x + 45, y - 20, value, 15, "middle", "bold")

def led_h(x, y, color):          # anode at x, cathode at x+60, current flows RIGHT
    add(f'<polygon points="{x+12},{y-18} {x+12},{y+18} {x+44},{y}" fill="{color}" stroke="{WIRE}" stroke-width="2"/>')
    line(x + 44, y - 18, x + 44, y + 18, 3)
    line(x, y, x + 12, y); line(x + 44, y, x + 60, y)
    for dx in (0, 12):           # light arrows
        arrow(x + 22 + dx, y - 22, x + 34 + dx, y - 38)
    text(x + 4, y + 34, "+", 14, "middle", "bold", "#b71c1c")
    text(x + 54, y + 34, "−", 14, "middle", "bold", "#223")

def gnd(x, y):
    line(x, y, x, y + 16)
    for i, hw in enumerate((20, 12, 5)):
        line(x - hw, y + 16 + i*7, x + hw, y + 16 + i*7, 2.5)

add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
add(f'<rect width="{W}" height="{H}" fill="#ffffff"/>')
text(40, 46, "Проєкт A «Три ритми»: три LED, кожен зі своїм ритмом, на спільному GND", 22, "start", "bold", "#112")

# ---------------- ESP32 ----------------
bx, by, bw, bh = 40, 80, 250, 430
add(f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" rx="14" fill="#eef2f7" stroke="#334" stroke-width="2.5"/>')
text(bx + 20, by + bh - 70, "ESP32-S3", 24, "start", "bold", "#223")
text(bx + 20, by + bh - 46, "YD-ESP32-S3 (N16R8)", 14, "start", "normal", "#445")
text(bx + 20, by + bh - 24, "живлення й Serial: USB", 14, "start", "normal", "#52606d")
PX = bx + bw
BUS = 960                                    # common GND bus x
rows = [("GPIO6", 140, "#e53935", "LED1", "червоний", "кожні 200 мс"),
        ("GPIO5", 250, "#fbc02d", "LED2", "жовтий",   "кожні 500 мс"),
        ("GPIO4", 360, "#43a047", "LED3", "зелений",  "кожні 1000 мс")]
for i, (pin, y, color, name, cname, rhythm) in enumerate(rows, 1):
    pin_r(PX, y, pin)
    line(PX + 6, y, 400, y); res_h(400, y, f"R{i}  220 Ом"); line(490, y, 600, y)
    led_h(600, y, color)
    line(660, y, BUS, y); dot(BUS, y)
    text(690, y - 12, f"{name} · {rhythm}", 17, "start", "bold", "#112")
    text(690, y + 26, f"HL{i}, {cname}", 14, "start", "normal", "#52606d")
YG = 460
pin_r(PX, YG, "GND")
line(PX + 6, YG, BUS, YG, 3.5, "#2e7d32"); dot(BUS, YG, "#2e7d32")
line(BUS, rows[0][1], BUS, YG, 3.5, "#2e7d32")
gnd(BUS, YG)
text(BUS + 18, YG + 6, "спільний GND", 16, "start", "bold", "#2e7d32")

# ---------------- notes ----------------
ny = 560
def note(dy, s, size=15, weight="normal", fill="#223"): text(40, ny + dy, s, size, "start", weight, fill)
note(0, "Анод LED (довга ніжка) — до резистора, катод (коротка, зріз на корпусі) — до GND.  HIGH на GPIO = світить.", 15, "bold")
note(28, "Струм кожного LED ≈ (3,3 − U<tspan font-size=\"11\" dy=\"4\">LED</tspan><tspan dy=\"-4\">) / 220 Ом: червоний/жовтий ≈ 5–6 мА, зелений 1,5–5 мА (залежить від типу)</tspan>")
note(50, "на пін, сумарно на пін, сумарно ≈ 18 мА: GPIOlt; 18 мА: GPIO ESP32-S3 це віддає без транзистора, зовнішнє живлення не потрібне.")
note(80, "Піни в завданні — GPIO15/16/17; на стенді — GPIO6/5/4. Обидва варіанти вільні: не strapping (0, 3, 45, 46), не USB (19, 20),", 14, "normal", "#52606d")
note(100, "не флеш/PSRAM (26–37), не RGB-світлодіод (48).", 14, "normal", "#52606d")

add('</svg>')
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'schematic.svg'), 'w').write("\n".join(out))
print("ok")
