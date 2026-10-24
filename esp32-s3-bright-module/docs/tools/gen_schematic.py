import os
# Generates ../schematic.svg — ТЗ-A «Яскравий модуль», low-side NPN switch:
# +5 V (MB-102) → LED → R2 220 Ω → collector 2N2222, emitter → GND; GPIO5 (LEDC PWM) → R1 1 kΩ → base;
# common GND; button S1 3V3 → GPIO6 (INPUT_PULLDOWN, RISING interrupt) steps the brightness level.
W, H = 1320, 860
WIRE = "#222"
out = []
def add(s): out.append(s)

def text(x, y, s, size=15, anchor="start", weight="normal", fill="#222", family="DejaVu Sans, Arial, sans-serif"):
    add(f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}" font-weight="{weight}" fill="{fill}" font-family="{family}">{s}</text>')

def line(x1, y1, x2, y2, w=2, color=WIRE, dash=""):
    extra = f' stroke-dasharray="{dash}"' if dash else ""
    add(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{w}" stroke-linecap="round"{extra}/>')

def poly(points, color=WIRE, w=2):
    pts = " ".join(f"{x},{y}" for x, y in points)
    add(f'<polyline points="{pts}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linejoin="round"/>')

def dot(x, y, color=WIRE):
    add(f'<circle cx="{x}" cy="{y}" r="4.5" fill="{color}"/>')

def arrow(x1, y1, x2, y2, color, w=2.5):   # straight arrow, head at (x2, y2)
    import math
    line(x1, y1, x2, y2, w, color)
    a = math.atan2(y2 - y1, x2 - x1)
    p = [(x2, y2), (x2 - 12*math.cos(a - .4), y2 - 12*math.sin(a - .4)), (x2 - 12*math.cos(a + .4), y2 - 12*math.sin(a + .4))]
    add('<polygon points="' + " ".join(f"{x:.1f},{y:.1f}" for x, y in p) + f'" fill="{color}"/>')

def pin_r(x, y, label, above=False):   # header pin on the RIGHT edge of a box, stub to x+36
    add(f'<rect x="{x - 6}" y="{y - 6}" width="12" height="12" fill="#c9a227" stroke="#7a5f00" stroke-width="1.5"/>')
    text(x - 12, y - 9 if above else y + 5, label, 15, "end", "bold", "#223")
    line(x + 6, y, x + 36, y)

def pin_l(x, y, label):          # terminal on the LEFT edge of a box, stub to x-36
    add(f'<rect x="{x - 6}" y="{y - 6}" width="12" height="12" fill="#c9a227" stroke="#7a5f00" stroke-width="1.5"/>')
    text(x + 14, y + 5, label, 15, "start", "bold", "#223")
    line(x - 6, y, x - 36, y)

def res_h(x, y, name, value):    # horizontal resistor, body x..x+80 on wire y
    add(f'<rect x="{x}" y="{y-11}" width="80" height="22" fill="#fff6d5" stroke="{WIRE}" stroke-width="2"/>')
    text(x + 40, y - 20, f"{name}  {value}", 15, "middle", "bold")

def res_v(cx, y, name, value):   # vertical resistor, body y..y+60 on wire cx
    add(f'<rect x="{cx-11}" y="{y}" width="22" height="60" fill="#fff6d5" stroke="{WIRE}" stroke-width="2"/>')
    text(cx + 22, y + 26, name, 15, "start", "bold")
    text(cx + 22, y + 46, value, 15, "start")

def led_v(cx, y, color):         # anode at y, cathode at y+70, current flows DOWN
    line(cx, y, cx, y + 18)
    add(f'<polygon points="{cx-17},{y+18} {cx+17},{y+18} {cx},{y+50}" fill="{color}" stroke="{WIRE}" stroke-width="2"/>')
    line(cx - 17, y + 50, cx + 17, y + 50, 2.5)
    line(cx, y + 50, cx, y + 70)
    for dy in (0, 12):           # light arrows
        arrow(cx - 22, y + 26 + dy, cx - 40, y + 14 + dy, WIRE, 1.5)
    text(cx + 24, y + 30, "HL1  LED", 15, "start", "bold")
    text(cx + 24, y + 50, "червоний", 14, "start", "normal", "#445")
    text(cx - 10, y + 14, "+", 14, "end", "bold", "#b71c1c")
    text(cx - 10, y + 66, "−", 14, "end", "bold", "#223")

def npn(bx, cy):                 # base bar at x=bx, centred on y=cy; returns (base_x, coll_xy, emit_xy)
    add(f'<circle cx="{bx+22}" cy="{cy}" r="40" fill="#f4f7fb" stroke="{WIRE}" stroke-width="2"/>')
    line(bx, cy - 26, bx, cy + 26, 4)
    cx_, ctop = bx + 40, cy - 40
    line(bx, cy - 12, cx_, cy - 34, 2.5); line(cx_, cy - 34, cx_, ctop, 2)
    line(bx, cy + 12, cx_, cy + 34, 2.5); line(cx_, cy + 34, cx_, cy + 40, 2)
    arrow(bx + 14, cy + 20, cx_ - 4, cy + 32, WIRE, 2.5)  # NPN: arrow points OUT of the emitter
    return bx - 40, (cx_, ctop), (cx_, cy + 40)

def contact(x, y):
    add(f'<circle cx="{x}" cy="{y}" r="4" fill="#fff" stroke="{WIRE}" stroke-width="2"/>')

def switch_v(x, y, label):       # vertical push button, terminals at y and y+80
    line(x, y, x, y + 14); line(x, y + 66, x, y + 80)
    contact(x, y + 14); contact(x, y + 66)
    line(x + 14, y + 14, x + 14, y + 66, 2.5)
    line(x + 14, y + 40, x + 30, y + 40, 2); line(x + 30, y + 32, x + 30, y + 48, 2.5)
    text(x + 40, y + 36, label, 15, "start", "bold")

def dashed_box(x, y, w, h, label):
    add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="none" stroke="#7b8794" stroke-width="1.5" stroke-dasharray="6 5"/>')
    text(x + 8, y + h - 8, label, 12, "start", "normal", "#52606d")

def gnd(x, y):
    line(x, y, x, y + 14)
    for i, hw in enumerate((18, 11, 4)):
        line(x - hw, y + 14 + i*6, x + hw, y + 14 + i*6, 2.5)

def SUB(a, b, c):             # text with a subscript, e.g. I_B
    return f'{a}<tspan font-size="11" dy="4">{b}</tspan><tspan dy="-4">{c}</tspan>'

C_IB, C_IC, C_GND, C_5V = "#1565c0", "#e65100", "#2e7d32", "#c62828"

add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
add(f'<rect width="{W}" height="{H}" fill="#ffffff"/>')
text(40, 46, "ТЗ-A «Яскравий модуль»: ESP32-S3 керує яскравістю LED через ключ 2N2222, кнопка S1 перемикає рівні", 20, "start", "bold", "#112")

Y5V, YB, YGND = 110, 350, 520

# ---------------- ESP32 ----------------
bx, by, bw, bh = 40, 90, 300, 470
add(f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" rx="14" fill="#eef2f7" stroke="#334" stroke-width="2.5"/>')
text(bx + 20, by + 36, "ESP32-S3", 20, "start", "bold", "#223")
text(bx + 20, by + 58, "YD-ESP32-S3 / DevKitC-1", 15, "start", "normal", "#445")
text(bx + 20, by + 92, "живлення: USB-C від ПК", 14, "start", "normal", "#52606d")
text(bx + 20, by + 114, "логіка 3,3 В", 14, "start", "normal", "#52606d")
for i, c in enumerate(("ledcSetup(0, 5000, 8);", "ledcAttachPin(5, 0);", "ledcWrite(0, duty);", "pinMode(6, INPUT_PULLDOWN);", "attachInterrupt(6, onPress, RISING);")):
    text(bx + 14, YB + 44 + i*18, c, 11, "start", "normal", "#223", "DejaVu Sans Mono, monospace")
text(bx + 14, YB + 44 + 5*18 + 4, "duty: 0 → 40 → 128 → 255 → 0", 12, "start", "bold", "#52606d")
PX = bx + bw
Y33, Y6 = 170, 240
pin_r(PX, Y33, "3V3"); pin_r(PX, Y6, "GPIO6", above=True); pin_r(PX, YB, "GPIO5"); pin_r(PX, YGND, "GND")
sx = PX + 36

# ---------------- button S1: 3V3 → S1 → GPIO6, internal pull-down ----------------
SWX = 440
line(sx, Y33, SWX, Y33, 2.5, "#6a1b9a")
switch_v(SWX, Y33, "S1  кнопка")
poly([(SWX, Y33 + 80), (SWX, Y6), (sx, Y6)], "#6a1b9a", 2.5)
text(SWX + 40, Y33 + 58, "натиснута → GPIO6 = 3,3 В", 13, "start", "normal", "#52606d")
text(SWX + 40, Y33 + 76, "→ фронт RISING → ISR", 13, "start", "normal", "#52606d")
text(SWX + 40, Y33 + 98, "тільки від 3V3, ніколи від 5 В!", 13, "start", "bold", "#7f1d1d")
PDX = 250                                            # internal pull-down of GPIO6
dashed_box(bx + 110, Y6 - 28, bw - 122, 122, "")
text(bx + 118, Y6 - 12, "INPUT_PULLDOWN", 11, "start", "bold", "#52606d")
line(PDX, Y6, PX - 6, Y6); dot(PDX, Y6)
res_v(PDX, Y6, "", ""); text(PDX - 16, Y6 + 36, "≈45 кОм", 12, "end", "normal", "#52606d")
gnd(PDX, Y6 + 60)

# ---------------- base circuit ----------------
QX = 700                                             # base bar of Q1
base_x, (cxq, cyq), (exq, eyq) = npn(QX, YB)
line(sx, YB, 470, YB, 2.5, C_IB); res_h(470, YB, "R1", "1 кОм"); line(550, YB, QX, YB, 2.5, C_IB)
arrow(395, YB + 26, 455, YB + 26, C_IB)
text(395, YB + 50, SUB("I", "B", " ≈ (3,3 − 0,7) / 1000 ≈ 2,6 мА"), 14, "start", "bold", C_IB)
text(QX - 8, YB - 14, "B", 14, "end", "bold", "#223")
text(QX + 52, cyq + 8, "C", 14, "start", "bold", "#223")
text(QX + 52, eyq + 2, "E", 14, "start", "bold", "#223")
text(QX - 12, YB + 30, "≈0,7 В", 12, "end", "normal", "#52606d")
text(QX + 76, YB - 6, "Q1  2N2222", 16, "start", "bold", "#112")
text(QX + 76, YB + 16, "NPN, ключ «на землі»", 14, "start", "normal", "#445")
text(QX + 76, YB + 36, SUB("увімкнено: U", "CE", " ≈ 0,1 В"), 13, "start", "normal", "#52606d")

# ---------------- collector chain: +5 V → LED → R2 → C ----------------
led_v(cxq, Y5V + 20, "#ef5350")                     # anode y=130, cathode y=200
line(cxq, Y5V, cxq, Y5V + 20, 2.5, C_5V)
line(cxq, Y5V + 90, cxq, 222); res_v(cxq, 222, "R2", "220 Ом"); line(cxq, 282, cxq, cyq)
arrow(cxq + 110, 150, cxq + 110, 270, C_IC)
text(cxq + 124, 180, SUB("I", "C", " ≈ (5 − 2,0 − 0,1) / 220"), 14, "start", "bold", C_IC)
text(cxq + 124, 202, "≈ 13 мА", 14, "start", "bold", C_IC)
text(cxq + 124, 228, "іде від MB-102,", 13, "start", "normal", "#52606d")
text(cxq + 124, 246, "а не з піна ESP32", 13, "start", "normal", "#52606d")

# ---------------- MB-102 ----------------
mx, my, mw, mh = 1080, 90, 210, 470
add(f'<rect x="{mx}" y="{my}" width="{mw}" height="{mh}" rx="14" fill="#fff4f2" stroke="#7f1d1d" stroke-width="2.5"/>')
text(mx + 24, my + 150, "MB-102", 20, "start", "bold", "#223")
text(mx + 24, my + 172, "модуль живлення", 15, "start", "normal", "#445")
text(mx + 24, my + 172 + 34, "перемичка цієї", 14, "start", "normal", "#52606d")
text(mx + 24, my + 172 + 54, "сторони: 5V", 14, "start", "bold", "#52606d")
text(mx + 24, my + 172 + 88, "вхід: USB 5 В або", 14, "start", "normal", "#52606d")
text(mx + 24, my + 172 + 108, "DC-гніздо 6,5–12 В", 14, "start", "normal", "#52606d")
text(mx + 24, my + 172 + 142, "кнопка живлення: ON", 14, "start", "normal", "#52606d")
pin_l(mx, Y5V, "+5 В"); pin_l(mx, YGND, "GND (−)")
line(cxq, Y5V, mx - 36, Y5V, 2.5, C_5V)
text(cxq + 20, Y5V - 10, "+5 В (шина «+» макетки)", 14, "start", "bold", C_5V)

# ---------------- ground: emitter, ESP32 GND, MB-102 GND ----------------
line(exq, eyq, exq, YGND, 2.5)
line(sx, YGND, mx - 36, YGND, 4, C_GND)
dot(exq, YGND, C_GND); dot(sx + 40, YGND, C_GND)
gnd(sx + 40, YGND)
text(470, YGND - 12, "СПІЛЬНА ЗЕМЛЯ: GND ESP32 = «−» MB-102", 15, "start", "bold", C_GND)
text(470, YGND + 40, "без цього дроту струм бази не має шляху назад → LED не світить", 13, "start", "normal", C_GND)
text(exq + 12, YGND - 60, "емітер → GND", 13, "start", "normal", "#52606d")

# ---------------- notes ----------------
ny = 620
def note(x, dy, s, size=14, weight="normal", fill="#223"): text(x, ny + dy, s, size, "start", weight, fill)
note(40, 0, "Як це працює", 16, "bold", "#112")
note(40, 26, "1.  GPIO5 видає ШІМ 5 кГц (LEDC, 8 біт). У фазі HIGH через R1 тече ≈ 2,6 мА → Q1 у насиченні; у фазі LOW Q1 закритий.")
note(40, 48, "2.  Струм LED ≈ 13 мА іде імпульсами: +5 В → LED → R2 → C → E → GND → MB-102. Яскравість ∝ duty / 255:")
note(70, 70, SUB("OFF = 0 (0 %),  LOW = 40 (≈16 %),  MID = 128 (≈50 %),  HIGH = 255 (100 %, U", "CE", " ≈ 0,1–0,2 В)."))
note(40, 92, "3.  S1: відпущена — внутрішня підтяжка тримає GPIO6 у LOW; натиснута — 3,3 В → RISING → ISR ставить прапорець, рівень змінює loop().")
note(40, 114, SUB("4.  Запас: I", "C", "") + SUB(" / I", "B", " ≈ 13 / 2,6 ≈ 5 — значно менше h") + SUB("", "FE", " 2N2222A (≥ 75 при 10 мА), тож ключ надійно в насиченні."))
note(40, 150, "Перевірка перед увімкненням (схему перемикати лише при вимкненому живленні)", 16, "bold", "#112")
note(40, 174, "• «−» MB-102 з'єднано з GND ESP32 — єдиний зв'язок між живленнями.   • +5 В MB-102 НЕ йде на 5V / VIN / піни ESP32.", 14, "bold", "#7f1d1d")
note(40, 196, "• Кнопка — від 3V3.   • Довга ніжка LED (анод) — до +5 В.   • E-B-C визначено за вашим корпусом.", 14, "bold", "#7f1d1d")

# 2N2222 pinout inset (TO-92, flat face towards the viewer)
ix, iy = 1150, 610
text(ix - 50, iy - 6, "2N2222 / PN2222A, TO-92", 14, "start", "bold", "#112")
iy += 26
add(f'<path d="M{ix},{iy+70} L{ix},{iy+30} A40,40 0 0 1 {ix+80},{iy+30} L{ix+80},{iy+70} Z" fill="#333" stroke="#000" stroke-width="1.5"/>')
text(ix + 40, iy + 56, "плаский бік", 11, "middle", "normal", "#ddd")
for i, l in enumerate("EBC"):
    lx = ix + 16 + i*24
    line(lx, iy + 70, lx, iy + 112, 3, "#9e9e9e")
    text(lx, iy + 130, l, 15, "middle", "bold", "#223")
text(ix + 40, iy + 148, "звірте з даташитом", 12, "middle", "normal", "#7f1d1d")

add('</svg>')
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'schematic.svg'), 'w').write("\n".join(out))
print("ok")
