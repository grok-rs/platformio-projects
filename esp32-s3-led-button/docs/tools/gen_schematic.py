import os
# Generates docs/schematic.svg — principal circuit: LED, button, logic analyzer probes
W, H = 1320, 900
WIRE = "#222"
out = []
def add(s): out.append(s)

def text(x, y, s, size=15, anchor="start", weight="normal", fill="#222", family="DejaVu Sans, Arial, sans-serif"):
    add(f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}" font-weight="{weight}" fill="{fill}" font-family="{family}">{s}</text>')

def line(x1, y1, x2, y2, w=2, color=WIRE, dash=""):
    extra = f' stroke-dasharray="{dash}"' if dash else ""
    add(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{w}" stroke-linecap="round"{extra}/>')

def poly(points, color=WIRE, w=2):  # polyline through (x, y) points
    pts = " ".join(f"{x},{y}" for x, y in points)
    add(f'<polyline points="{pts}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linejoin="round"/>')

def dot(x, y, color=WIRE):
    add(f'<circle cx="{x}" cy="{y}" r="4.5" fill="{color}"/>')

def pin(x, y, label):            # header pin on the right edge of the board, stub to x+36
    add(f'<rect x="{x - 6}" y="{y - 6}" width="12" height="12" fill="#c9a227" stroke="#7a5f00" stroke-width="1.5"/>')
    text(x + 14, y - 10, label, 15, "start", "bold", "#223")
    line(x + 6, y, x + 36, y)

def res_h(x, y, label):          # horizontal resistor, body x..x+80 on wire y
    add(f'<rect x="{x}" y="{y-11}" width="80" height="22" fill="#fff6d5" stroke="{WIRE}" stroke-width="2"/>')
    text(x + 40, y - 18, label, 15, "middle")

def res_v(cx, y, label, color=WIRE):   # vertical resistor, body y..y+60 on wire cx
    add(f'<rect x="{cx-11}" y="{y}" width="22" height="60" fill="#fff6d5" stroke="{color}" stroke-width="2"/>')
    text(cx + 18, y + 35, label, 14, "start")

def led_h(x, y, color, label):   # anode at x, cathode at x+60, current flows right
    line(x, y, x + 10, y)
    add(f'<polygon points="{x+10},{y-16} {x+10},{y+16} {x+42},{y}" fill="{color}" stroke="{WIRE}" stroke-width="2"/>')
    line(x + 42, y - 16, x + 42, y + 16, 2.5)
    line(x + 42, y, x + 60, y)
    for dx in (0, 10):           # light arrows
        line(x + 24 + dx, y - 20, x + 34 + dx, y - 32, 1.5)
    text(x + 30, y + 36, label, 15, "middle", "bold")

def contact(x, y):
    add(f'<circle cx="{x}" cy="{y}" r="4" fill="#fff" stroke="{WIRE}" stroke-width="2"/>')

def switch_h(x, y, label):       # horizontal push button, terminals at x and x+80
    line(x, y, x + 14, y); line(x + 66, y, x + 80, y)
    contact(x + 14, y); contact(x + 66, y)
    line(x + 14, y - 14, x + 66, y - 14, 2.5)
    line(x + 40, y - 14, x + 40, y - 30, 2); line(x + 32, y - 30, x + 48, y - 30, 2.5)
    text(x + 40, y + 30, label, 15, "middle")

def gnd(x, y):                   # ground symbol hanging below (x, y)
    line(x, y, x, y + 12)
    for i, hw in enumerate((16, 10, 4)):
        line(x - hw, y + 12 + i*6, x + hw, y + 12 + i*6, 2.5)

def vcc(x, y, label="3V3"):      # supply symbol, wire continues down from (x, y)
    line(x - 12, y, x + 12, y, 2.5)
    text(x, y - 8, label, 13, "middle", "bold", "#b71c1c")

def dashed_box(x, y, w, h, label):
    add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="none" stroke="#7b8794" stroke-width="1.5" stroke-dasharray="6 5"/>')
    text(x + 8, y + h - 8, label, 12, "start", "normal", "#52606d")

RED = "#e53935"
P_LED, P_BTN = "#00897b", "#1565c0"

add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
add(f'<rect width="{W}" height="{H}" fill="#ffffff"/>')
text(40, 48, "Принципова схема: світлодіод, кнопка S1 і логічний аналізатор", 21, "start", "bold", "#112")

# ---------------- board ----------------
bx, by, bw, bh = 40, 80, 340, 560
add(f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" rx="14" fill="#eef2f7" stroke="#334" stroke-width="2.5"/>')
text(bx + 20, by + 36, "ESP32-S3", 20, "start", "bold", "#223")
text(bx + 20, by + 58, "YD-ESP32-S3", 16, "start", "normal", "#445")
PX = bx + bw                     # pins sit on the right edge
Y15, Y21, YG = 200, 400, 600
pin(PX, Y15, "GPIO15"); pin(PX, Y21, "GPIO21"); pin(PX, YG, "GND")
text(bx + 20, Y15 + 5, "OUTPUT", 14, "start", "normal", "#52606d")

# internal pull-up of GPIO21 (INPUT_PULLUP)
pux = 290
dashed_box(bx + 12, 300, bw - 24, 150, "усередині чипа: INPUT_PULLUP")
vcc(pux, 318); line(pux, 318, pux, 328)
res_v(pux, 328, "", "#52606d"); text(pux - 18, 368, "≈45 kΩ", 14, "end")
line(pux, 388, pux, Y21); dot(pux, Y21)
line(bx + 60, Y21, PX - 6, Y21)
text(bx + 20, Y21 - 8, "вхід GPIO21", 14, "start", "normal", "#52606d")

# ---------------- external parts ----------------
sx = PX + 36                     # end of pin stubs
bus = 820
TAP15, TAP21 = 450, 470          # where the analyzer probes clip onto the signal wires
line(sx, Y15, 500, Y15); res_h(500, Y15, "R1  220 Ω"); line(580, Y15, 640, Y15)
led_h(640, Y15, RED, "D1"); line(700, Y15, bus, Y15)
line(sx, Y21, 580, Y21); switch_h(580, Y21, "S1  кнопка"); line(660, Y21, bus, Y21); dot(bus, Y21)
line(bus, Y15, bus, YG)
line(sx, YG, bus, YG); dot(bus, YG); gnd(bus, YG + 60); line(bus, YG, bus, YG + 60)
text(bus - 14, (Y21 + YG) / 2, "GND", 15, "end", "bold", "#223")

# ---------------- logic analyzer ----------------
lx, ly, lw, lh = 940, 110, 330, 560
add(f'<rect x="{lx}" y="{ly}" width="{lw}" height="{lh}" rx="14" fill="#eceff1" stroke="#263238" stroke-width="2.5"/>')
text(lx + 24, ly + 330, "Логічний аналізатор", 19, "start", "bold", "#223")
text(lx + 24, ly + 352, "24 MHz, 8 каналів (fx2lafw)", 14, "start", "normal", "#445")
text(lx + 24, ly + lh - 44, "USB → ПК, PulseView", 14, "start", "bold", "#445")
text(lx + 24, ly + lh - 22, "входи 0…5 В, 3.3 В — OK", 13, "start", "normal", "#52606d")
LA_Y1, LA_Y2, LA_YG = 150, 330, YG
for y, name, sub, c in ((LA_Y1, "CH1", "D0 — LED", P_LED), (LA_Y2, "CH2", "D1 — кнопка", P_BTN), (LA_YG, "GND", "", WIRE)):
    add(f'<rect x="{lx - 6}" y="{y - 6}" width="12" height="12" fill="#c9a227" stroke="#7a5f00" stroke-width="1.5"/>')
    text(lx + 16, y + 5, name, 15, "start", "bold", c)
    if sub: text(lx + 70, y + 5, sub, 14, "start", "normal", "#52606d")

# Probe wires: tap dot on the signal, route around the circuit to the analyzer input.
# They cross the GND bus without a dot — crossing wires are not connected.
dot(TAP15, Y15, P_LED); poly([(TAP15, Y15), (TAP15, LA_Y1), (lx - 6, LA_Y1)], P_LED, 2.5)
dot(TAP21, Y21, P_BTN); poly([(TAP21, Y21), (TAP21, LA_Y2), (lx - 6, LA_Y2)], P_BTN, 2.5)
line(bus, YG, lx - 6, LA_YG, 2.5)
text(TAP15 - 8, LA_Y1 - 8, "щуп CH1", 13, "start", "bold", P_LED)
text(TAP21 - 8, LA_Y2 - 8, "щуп CH2", 13, "start", "bold", P_BTN)

# ---------------- notes ----------------
nx, ny = 40, 720
def note(dx, dy, s, size=14, weight="normal", fill="#223"): text(nx + dx, ny + dy, s, size, "start", weight, fill)
note(0,   0,   "Вихід (світлодіод)", 16, "bold", "#112")
note(0,   26,  "GPIO15 = HIGH (3.3 В) → струм через R1 і D1 на GND.")
note(0,   48,  "I ≈ (3.3 − 2.0) / 220 ≈ 6 мА — безпечно (межа виводу ~20 мА).")
note(0,   70,  "Довга ніжка LED (+) — до резистора, коротка (−) — на GND.")
note(0,   114, "Вхід (кнопка), активний рівень LOW", 16, "bold", "#112")
note(0,   140, "Відпущена: підтяжка ≈45 kΩ тримає GPIO21 у 3.3 В → HIGH.")
note(0,   162, "Натиснута: GPIO21 замкнено на GND → LOW.")
note(640, 0,   "Логічний аналізатор лише «слухає»", 16, "bold", "#112")
note(640, 26,  "Входи аналізатора високоомні — на схему вони не впливають.")
note(640, 48,  "CH1 бачить вихід GPIO15, CH2 — вхід GPIO21 разом із брязкотом.")
note(640, 70,  "GND аналізатора — обов'язково до GND плати: рівні вимірюються")
note(640, 92,  "відносно землі, без неї запис — випадковий шум.")
note(640, 136, "PulseView: fx2lafw, 1–4 МГц, тригер на CH2 ↓ (falling).", 14, "bold", "#445")
note(640, 158, "Між фронтом CH2 і фронтом CH1 — затримка антибрязкоту 30 мс.", 14, "normal", "#445")

add('</svg>')
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'schematic.svg'), 'w').write("\n".join(out))
print("ok")
