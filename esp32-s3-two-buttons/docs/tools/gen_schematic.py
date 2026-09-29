import math
import os
# Generates docs/schematic.svg — principal circuit: 2 LEDs, external button, on-board BOOT
W, H = 1320, 740
WIRE = "#222"
out = []
def add(s): out.append(s)

def text(x, y, s, size=15, anchor="start", weight="normal", fill="#222", family="DejaVu Sans, Arial, sans-serif"):
    add(f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}" font-weight="{weight}" fill="{fill}" font-family="{family}">{s}</text>')

def line(x1, y1, x2, y2, w=2, color=WIRE, dash=""):
    extra = f' stroke-dasharray="{dash}"' if dash else ""
    add(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{w}" stroke-linecap="round"{extra}/>')

def dot(x, y):
    add(f'<circle cx="{x}" cy="{y}" r="4.5" fill="{WIRE}"/>')

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

def arrow(x1, y1, x2, y2, color):
    line(x1, y1, x2, y2, 2, color)
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

def contact(x, y):
    add(f'<circle cx="{x}" cy="{y}" r="4.5" fill="#fff" stroke="{WIRE}" stroke-width="2"/>')

def switch_h(x, y, label):       # normally-open push button, terminals at x and x+80
    line(x, y, x + 20, y); line(x + 60, y, x + 80, y)
    contact(x + 20, y); contact(x + 60, y)
    line(x + 14, y - 14, x + 66, y - 14, 2.5)
    line(x + 40, y - 14, x + 40, y - 30, 2); line(x + 32, y - 30, x + 48, y - 30, 2.5)
    text(x + 40, y + 30, label, 15, "middle")

def switch_v(cx, y, label):      # vertical push button, terminals at y and y+60
    line(cx, y, cx, y + 14); line(cx, y + 46, cx, y + 60)
    contact(cx, y + 14); contact(cx, y + 46)
    line(cx - 14, y + 10, cx - 14, y + 50, 2.5)
    line(cx - 14, y + 30, cx - 28, y + 30, 2); line(cx - 28, y + 22, cx - 28, y + 38, 2.5)
    text(cx + 16, y + 35, label, 14, "start", "bold")

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

RED, YEL = "#e53935", "#fbc02d"

add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
add(f'<rect width="{W}" height="{H}" fill="#ffffff"/>')
text(40, 48, "Принципова схема: 2 світлодіоди, зовнішня кнопка S1 та BOOT", 21, "start", "bold", "#112")

# ---------------- board ----------------
bx, by, bw, bh = 40, 80, 340, 600
add(f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" rx="14" fill="#eef2f7" stroke="#334" stroke-width="2.5"/>')
text(bx + 20, by + 36, "ESP32-S3", 20, "start", "bold", "#223")
text(bx + 20, by + 58, "YD-ESP32-S3", 16, "start", "normal", "#445")
PX = bx + bw                     # pins sit on the right edge
Y15, Y16, Y17, YG = 180, 270, 400, 640
pin(PX, Y15, "GPIO15"); pin(PX, Y16, "GPIO16"); pin(PX, Y17, "GPIO21"); pin(PX, YG, "GND")
text(bx + 20, Y15 + 5, "OUTPUT", 14, "start", "normal", "#52606d")
text(bx + 20, Y16 + 5, "OUTPUT", 14, "start", "normal", "#52606d")

# internal pull-up of GPIO21 (INPUT_PULLUP)
pux = 290
dashed_box(bx + 12, 300, bw - 24, 140, "усередині чипа: INPUT_PULLUP")
vcc(pux, 318); line(pux, 318, pux, 328)
res_v(pux, 328, "", "#52606d"); text(pux - 18, 368, "≈45 kΩ", 14, "end")
line(pux, 388, pux, Y17); dot(pux, Y17)
line(bx + 60, Y17, PX - 6, Y17)
text(bx + 20, Y17 - 8, "вхід GPIO21", 14, "start", "normal", "#52606d")

# on-board BOOT circuit on GPIO0
cx = 150
dashed_box(bx + 12, 460, bw - 24, 200, "на платі: кнопка BOOT, GPIO0 (INPUT)")
vcc(cx, 482); line(cx, 482, cx, 490)
res_v(cx, 490, "10 kΩ"); line(cx, 550, cx, 560); dot(cx, 560)
line(cx, 560, cx + 150, 560); text(cx + 150, 552, "GPIO0", 14, "end", "bold", "#223")
switch_v(cx, 560, "BOOT"); gnd(cx, 620)

# ---------------- external parts ----------------
sx = PX + 36                     # end of pin stubs
bus = 860
for y, rl, dl in ((Y15, "R1  220 Ω", "D1"), (Y16, "R2  220 Ω", "D2")):
    line(sx, y, 480, y); res_h(480, y, rl); line(560, y, 640, y)
    led_h(640, y, RED, dl); line(700, y, bus, y); dot(bus, y) if y != Y15 else None
line(sx, Y17, 580, Y17); switch_h(580, Y17, "S1  кнопка"); line(660, Y17, bus, Y17); dot(bus, Y17)
line(bus, Y15, bus, YG)
line(sx, YG, bus, YG); dot(bus, YG); gnd(bus, YG)
text(bus + 14, (Y15 + YG) / 2, "GND", 15, "start", "bold", "#223")

# ---------------- notes ----------------
nx = 930
def note(dy, s, size=14, weight="normal", fill="#223"): text(nx, 110 + dy, s, size, "start", weight, fill)
note(0,   "Виходи (світлодіоди)", 16, "bold", "#112")
note(26,  "GPIO = HIGH (3.3 В) → струм через R і LED на GND.")
note(48,  "I ≈ (3.3 − 2.0) / 220 ≈ 6 мА — безпечно")
note(70,  "для світлодіода і для виводу (межа ~20 мА).")
note(92,  "Довга ніжка LED (+) — до резистора,")
note(114, "коротка (−) — на GND.")
note(158, "Входи (кнопки), активний рівень LOW", 16, "bold", "#112")
note(184, "Відпущена: підтяжка тримає вхід у 3.3 В → HIGH.")
note(206, "Натиснута: вхід замкнено на GND → LOW.")
note(228, "S1: підтяжка всередині чипа (INPUT_PULLUP),")
note(250, "     тому зовні лише кнопка між GPIO21 і GND.")
note(272, "BOOT: підтяжка 10 kΩ уже на платі → INPUT.")
note(316, "Режими", 16, "bold", "#112")
note(342, "S1   → режим 1: D1+D2 разом, 200 мс")
note(364, "BOOT → режим 2: D1/D2 по черзі, 1000 мс")
note(386, "Режим тримається до натискання іншої кнопки.")
note(434, "Гребінці плати:", 14, "bold", "#445")
note(456, "лівий: GPIO15/16 — піни 8/9, G — пін 22;", 14, "normal", "#445")
note(478, "правий: GPIO21 — пін 18 (5-й від USB-C).", 14, "normal", "#445")
note(500, "Не тримати BOOT під час скидання/увімкнення —", 14, "normal", "#b71c1c")
note(522, "плата перейде в режим прошивки.", 14, "normal", "#b71c1c")

add('</svg>')
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'schematic.svg'), 'w').write("\n".join(out))
print("ok")
