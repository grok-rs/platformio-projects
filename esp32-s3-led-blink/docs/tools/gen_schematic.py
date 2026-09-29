import os
# Generates docs/schematic.svg — wiring for both firmware modes
W, H = 1400, 660
WIRE = "#222"
out = []
def add(s): out.append(s)

def text(x, y, s, size=15, anchor="start", weight="normal", fill="#222", family="DejaVu Sans, Arial, sans-serif"):
    add(f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}" font-weight="{weight}" fill="{fill}" font-family="{family}">{s}</text>')

def line(x1, y1, x2, y2, w=2, color=WIRE):
    add(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{w}" stroke-linecap="round"/>')

def dot(x, y):
    add(f'<circle cx="{x}" cy="{y}" r="4.5" fill="{WIRE}"/>')

def board(x, y, w, h, pins):
    add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="#eef2f7" stroke="#334" stroke-width="2.5"/>')
    text(x + w/2, y + 38, "ESP32-S3", 20, "middle", "bold", "#223")
    text(x + w/2, y + 62, "YD-ESP32-S3", 16, "middle", "normal", "#445")
    add(f'<rect x="{x + w/2 - 22}" y="{y + h - 48}" width="44" height="18" rx="3" fill="#cfd8e3" stroke="#556" stroke-width="1.5"/>')
    text(x + w/2, y + h - 35, "BOOT", 11, "middle", "bold", "#334")
    for label, py in pins:
        add(f'<rect x="{x + w - 6}" y="{py - 6}" width="12" height="12" fill="#c9a227" stroke="#7a5f00" stroke-width="1.5"/>')
        text(x + w - 14, py + 5, label, 15, "end", "bold", "#223")
        line(x + w + 6, py, x + w + 36, py)

def res_h(x, y, label):          # horizontal resistor, body x..x+80 on wire y
    add(f'<rect x="{x}" y="{y-11}" width="80" height="22" fill="#fff6d5" stroke="{WIRE}" stroke-width="2"/>')
    text(x + 40, y - 18, label, 15, "middle")

def res_v(cx, y, label):         # vertical resistor, body y..y+60 on wire cx
    add(f'<rect x="{cx-11}" y="{y}" width="22" height="60" fill="#fff6d5" stroke="{WIRE}" stroke-width="2"/>')
    text(cx + 20, y + 35, label, 15, "start")

def arrow(x1, y1, x2, y2, color):
    line(x1, y1, x2, y2, 2, color)
    import math
    a = math.atan2(y2 - y1, x2 - x1)
    for s in (-1, 1):
        line(x2, y2, x2 - 8*math.cos(a + s*0.45), y2 - 8*math.sin(a + s*0.45), 2, color)

def led_h(x, y, color, label):   # anode at x, cathode at x+60, current flows right
    line(x, y, x + 10, y)
    add(f'<polygon points="{x+10},{y-16} {x+10},{y+16} {x+42},{y}" fill="{color}" stroke="{WIRE}" stroke-width="2"/>')
    line(x + 42, y - 16, x + 42, y + 16, 3)
    line(x + 42, y, x + 60, y)
    arrow(x + 24, y - 18, x + 36, y - 32, color)
    arrow(x + 34, y - 18, x + 46, y - 32, color)
    text(x + 30, y + 36, label, 15, "middle")

def led_v(cx, y, color, label):  # anode at y, cathode at y+60, current flows down
    line(cx, y, cx, y + 10)
    add(f'<polygon points="{cx-16},{y+10} {cx+16},{y+10} {cx},{y+42}" fill="{color}" stroke="{WIRE}" stroke-width="2"/>')
    line(cx - 16, y + 42, cx + 16, y + 42, 3)
    line(cx, y + 42, cx, y + 60)
    arrow(cx + 20, y + 16, cx + 34, y + 28, color)
    arrow(cx + 20, y + 28, cx + 34, y + 40, color)
    text(cx + 44, y + 30, label, 15, "start")

def gnd(x, y):                   # ground symbol hanging below (x, y)
    line(x, y, x, y + 12)
    for i, hw in enumerate((16, 10, 4)):
        line(x - hw, y + 12 + i*6, x + hw, y + 12 + i*6, 2.5)

RED, BLUE, GREEN = "#e53935", "#1e88e5", "#43a047"

add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
add(f'<rect width="{W}" height="{H}" fill="#ffffff"/>')
add(f'<line x1="{W/2}" y1="30" x2="{W/2}" y2="{H-30}" stroke="#ccd" stroke-width="2" stroke-dasharray="8 8"/>')

# ---------------- Panel A: two GPIO ----------------
text(60, 58, "А. Два GPIO  (SINGLE_GPIO_MODE = 0, за замовчуванням)", 20, "start", "bold", "#112")
bx, by = 60, 110
board(bx, by, 200, 380, [("GPIO4", 200), ("GPIO5", 275), ("GPIO6", 350), ("GND", 450)])
px = bx + 200 + 36              # end of pin stub
bus_x = 640
rows = [(200, RED, "R1  220 Ω", "D1  червоний"),
        (275, BLUE, "R2  100 Ω", "D2  синій"),
        (350, GREEN, "R3  220 Ω", "D3  зелений")]
for y, col, rl, dl in rows:
    line(px, y, 330, y); res_h(330, y, rl); line(410, y, 470, y)
    led_h(470, y, col, dl); line(530, y, bus_x, y)
    dot(bus_x, y) if y != 200 else None
line(bus_x, 200, bus_x, 450)
line(px, 450, bus_x, 450); dot(bus_x, 450)
gnd(bus_x, 450)
text(60, 530, "Лівий гребінець: GPIO4/5/6 — піни 4/5/6 (одразу під RST), G — пін 22 (біля USB-C).", 14, "start", "bold", "#445")
text(60, 553, "Аноди — до GPIO через резистор, катоди — на GND. Зелений (GPIO6) — необов'язковий.", 14, "start", "normal", "#445")
text(60, 576, "Кнопка BOOT (GPIO0) вже на платі: коротке натискання — швидкість, довге — патерн.", 14, "start", "normal", "#445")

# ---------------- Panel B: one GPIO ----------------
ox = 760
text(ox, 58, "Б. Один GPIO  (SINGLE_GPIO_MODE = 1)", 20, "start", "bold", "#112")
bx = ox
board(bx, by, 200, 380, [("3V3", 190), ("GPIO7", 370), ("GND", 450)])
px = bx + 200 + 36
nx = 1050                       # shared node x
# blue branch: 3V3 -> R2 -> D2 -> node
line(px, 190, nx, 190); line(nx, 190, nx, 210)
res_v(nx, 210, "R2  100 Ω"); line(nx, 270, nx, 290)
led_v(nx, 290, BLUE, "D2  синій"); line(nx, 350, nx, 370)
# red branch: node -> R1 -> D1 -> GND
line(px, 370, nx, 370); dot(nx, 370)
line(nx, 370, 1090, 370); res_h(1090, 370, "R1  220 Ω"); line(1170, 370, 1220, 370)
led_h(1220, 370, RED, "D1  червоний"); line(1280, 370, 1340, 370)
line(1340, 370, 1340, 450); line(px, 450, 1340, 450); dot(1340, 450)
gnd(1340, 450)
# truth table
ty = 522
text(ox, ty, "GPIO7 = HIGH", 15, "start", "bold"); text(ox + 150, ty, "→  світить D1 (червоний), D2 вимкнений", 15)
text(ox, ty + 24, "GPIO7 = LOW", 15, "start", "bold"); text(ox + 150, ty + 24, "→  світить D2 (синій), D1 вимкнений", 15)
text(ox, ty + 48, "GPIO7 = INPUT", 15, "start", "bold"); text(ox + 150, ty + 48, "→  Hi-Z: обидва вимкнені (3.3 В &lt; Vf(D2) + Vf(D1) ≈ 4.8 В)", 15)
text(ox, ty + 76, "Лівий гребінець: 3V3 — пін 1/2, GPIO7 — пін 7, G — пін 22 (біля USB-C).", 14, "start", "bold", "#445")
text(ox, ty + 99, "Кадр R+B у цьому режимі — швидке перемикання HIGH/LOW (~500 Гц).", 14, "start", "normal", "#445")

add('</svg>')
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'schematic.svg'), 'w').write("\n".join(out))
print("ok")
