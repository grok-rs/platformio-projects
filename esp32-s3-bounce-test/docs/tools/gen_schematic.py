import os
# Generates docs/schematic.svg — principal circuit: button on GPIO21 + logic analyzer probe
W, H = 1320, 760
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

P_BTN, P_MARK, P_LBL = "#1565c0", "#2e7d32", "#ef6c00"

add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
add(f'<rect width="{W}" height="{H}" fill="#ffffff"/>')
text(40, 48, "Принципова схема: кнопка S1 на GPIO21 і логічний аналізатор (тест брязкоту)", 21, "start", "bold", "#112")

# ---------------- board ----------------
bx, by, bw, bh = 40, 80, 340, 420
add(f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" rx="14" fill="#eef2f7" stroke="#334" stroke-width="2.5"/>')
text(bx + 20, by + 36, "ESP32-S3", 20, "start", "bold", "#223")
text(bx + 20, by + 58, "YD-ESP32-S3", 16, "start", "normal", "#445")
PX = bx + bw                     # pins sit on the right edge
Y21, YG = 280, 460
Y40, Y41 = 380, 420
pin(PX, Y21, "GPIO21"); pin(PX, Y40, "GPIO40"); pin(PX, Y41, "GPIO41"); pin(PX, YG, "GND")
text(bx + 30, Y40 + 5, "OUTPUT: BOUNCE", 13, "start", "normal", "#52606d")
text(bx + 30, Y41 + 5, "Serial1 TX: LABEL", 13, "start", "normal", "#52606d")

# internal pull-up of GPIO21 (INPUT_PULLUP) + interrupt
pux = 290
dashed_box(bx + 12, 150, bw - 24, 200, "усередині чипа: INPUT_PULLUP + ISR")
vcc(pux, 178); line(pux, 178, pux, 190)
res_v(pux, 190, "", "#52606d"); text(pux - 18, 230, "≈45 kΩ", 14, "end")
line(pux, 250, pux, Y21); dot(pux, Y21)
line(bx + 60, Y21, PX - 6, Y21)
text(bx + 20, Y21 - 8, "вхід GPIO21", 14, "start", "normal", "#52606d")
text(bx + 30, Y21 + 34, "ISR: час кожного фронту", 13, "start", "bold", "#223", "DejaVu Sans Mono, monospace")

# ---------------- external parts ----------------
sx = PX + 36                     # end of pin stubs
bus = 820
TAP = 450                        # where the analyzer probe clips onto the signal wire
line(sx, Y21, 580, Y21); switch_h(580, Y21, "S1  кнопка"); line(660, Y21, bus, Y21); dot(bus, Y21)
line(bus, Y21, bus, YG)
line(sx, YG, bus, YG); dot(bus, YG); gnd(bus, YG + 50); line(bus, YG, bus, YG + 50)
text(bus - 14, Y21 + 60, "GND", 15, "end", "bold", "#223")

# ---------------- logic analyzer ----------------
lx, ly, lw, lh = 940, 110, 330, 400
add(f'<rect x="{lx}" y="{ly}" width="{lw}" height="{lh}" rx="14" fill="#eceff1" stroke="#263238" stroke-width="2.5"/>')
text(lx + 24, ly + 100, "Логічний аналізатор", 19, "start", "bold", "#223")
text(lx + 24, ly + 122, "24 MHz, 8 каналів", 14, "start", "normal", "#445")
text(lx + 24, ly + 150, "USB → ПК, Logic 2 / PulseView", 14, "start", "bold", "#445")
text(lx + 24, ly + 172, "входи 0…5 В, 3.3 В — OK", 13, "start", "normal", "#52606d")
LA_Y1, LA_YG = 150, YG
for y, name, sub, c in ((LA_Y1, "CH1", "D0 — кнопка", P_BTN), (Y40, "CH2", "D1 — BOUNCE", P_MARK),
                        (Y41, "CH3", "D2 — LABEL (UART)", P_LBL), (LA_YG, "GND", "", WIRE)):
    add(f'<rect x="{lx - 6}" y="{y - 6}" width="12" height="12" fill="#c9a227" stroke="#7a5f00" stroke-width="1.5"/>')
    text(lx + 16, y + 5, name, 15, "start", "bold", c)
    if sub: text(lx + 70, y + 5, sub, 14, "start", "normal", "#52606d")

dot(TAP, Y21, P_BTN); poly([(TAP, Y21), (TAP, LA_Y1), (lx - 6, LA_Y1)], P_BTN, 2.5)
line(bus, YG, lx - 6, LA_YG, 2.5)
# Firmware outputs straight across; they cross the GND bus without a dot — not connected.
line(sx, Y40, lx - 6, Y40, 2.5, P_MARK); line(sx, Y41, lx - 6, Y41, 2.5, P_LBL)
text(TAP - 8, LA_Y1 - 8, "щуп CH1", 13, "start", "bold", P_BTN)

# ---------------- notes ----------------
nx, ny = 40, 580
def note(dx, dy, s, size=14, weight="normal", fill="#223"): text(nx + dx, ny + dy, s, size, "start", weight, fill)
note(0,   0,   "Кнопка, активний рівень LOW", 16, "bold", "#112")
note(0,   26,  "Відпущена: підтяжка ≈45 kΩ тримає GPIO21 у 3.3 В → HIGH.")
note(0,   48,  "Натиснута: GPIO21 замкнено на GND → LOW.")
note(0,   70,  "Контакти при замиканні/розмиканні кілька мс «відскакують» —")
note(0,   92,  "на вході серія LOW/HIGH замість одного фронту.")
note(640, 0,   "Два «свідки» одного сигналу", 16, "bold", "#112")
note(640, 26,  "ESP32: переривання CHANGE рахує фронти й міряє інтервали (Serial).")
note(640, 48,  "Аналізатор: CH1 бачить той самий провід із роздільністю 42 нс.")
note(640, 70,  "Імпульси, коротші за реакцію ISR (кілька мкс), ESP32 може пропустити.")
note(640, 114, "Logic 2: 24 MS/s, тригер на Channel 1 ↑ (BOUNCE) — лише брязкіт.", 14, "bold", "#445")
note(640, 136, "Async Serial на Channel 2, 115200 → текстові підписи подій.", 14, "normal", "#445")

add('</svg>')
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'schematic.svg'), 'w').write("\n".join(out))
print("ok")
