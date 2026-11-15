# Generates ../schematic.svg — module 2.5 homework: GPIO2 → R1 → BC547B (R2 pull-up to +5 V) → IN of the 5 V relay
# module; contact COM–NO switches the fan (TT motor + 1N4007) from +5 V. LEDs on GPIO15/16, button on GPIO21.
import math, os

WIRE = "#222"
out = []
def add(s): out.append(s)

def text(x, y, s, size=15, anchor="start", weight="normal", fill="#222", family="DejaVu Sans, Arial, sans-serif"):
    add(f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}" font-weight="{weight}" fill="{fill}" font-family="{family}">{s}</text>')

def line(x1, y1, x2, y2, w=2.5, color=WIRE, dash=""):
    extra = f' stroke-dasharray="{dash}"' if dash else ""
    add(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{w}" stroke-linecap="round"{extra}/>')

def dot(x, y, color=WIRE):
    add(f'<circle cx="{x}" cy="{y}" r="5" fill="{color}"/>')

def box(x, y, w, h, fill, stroke, dash=""):
    extra = f' stroke-dasharray="{dash}"' if dash else ""
    add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="{fill}" stroke="{stroke}" stroke-width="2.5"{extra}/>')

def arrow(x1, y1, x2, y2, color=WIRE, w=1.6):
    line(x1, y1, x2, y2, w, color)
    a = math.atan2(y2 - y1, x2 - x1)
    p = [(x2, y2), (x2 - 9*math.cos(a - .45), y2 - 9*math.sin(a - .45)), (x2 - 9*math.cos(a + .45), y2 - 9*math.sin(a + .45))]
    add('<polygon points="' + " ".join(f"{x:.1f},{y:.1f}" for x, y in p) + f'" fill="{color}"/>')

def pin_r(x, y, label):          # header pin on the right edge of a box
    add(f'<rect x="{x - 6}" y="{y - 6}" width="12" height="12" fill="#c9a227" stroke="#7a5f00" stroke-width="1.5"/>')
    text(x - 14, y + 6, label, 17, "end", "bold", "#223")

def pin_l(x, y, label):          # header pin on the left edge of a box
    add(f'<rect x="{x - 6}" y="{y - 6}" width="12" height="12" fill="#c9a227" stroke="#7a5f00" stroke-width="1.5"/>')
    text(x + 14, y + 6, label, 16, "start", "bold", "#223")

def res_h(x, y, value, sub=""):  # horizontal resistor, body x..x+90
    add(f'<rect x="{x}" y="{y-12}" width="90" height="24" fill="#fff6d5" stroke="{WIRE}" stroke-width="2"/>')
    text(x + 45, y - 20, value, 15, "middle", "bold")
    if sub: text(x + 45, y + 32, sub, 13, "middle", "normal", "#52606d")

def res_v(x, y, label, value):   # vertical resistor, body y..y+70
    add(f'<rect x="{x-12}" y="{y}" width="24" height="70" fill="#fff6d5" stroke="{WIRE}" stroke-width="2"/>')
    text(x + 22, y + 30, label, 15, "start", "bold")
    text(x + 22, y + 50, value, 15, "start", "normal")

def cap_v(x, y, label, value):   # vertical capacitor, plates at y and y+12
    line(x - 22, y, x + 22, y, 3); line(x - 22, y + 12, x + 22, y + 12, 3)
    text(x + 30, y - 2, label, 15, "start", "bold")
    text(x + 30, y + 18, value, 15, "start", "normal")

def led_h(x, y, color):          # anode at x, cathode at x+60, current flows RIGHT
    add(f'<polygon points="{x+12},{y-18} {x+12},{y+18} {x+44},{y}" fill="{color}" stroke="{WIRE}" stroke-width="2"/>')
    line(x + 44, y - 18, x + 44, y + 18, 3)
    line(x, y, x + 12, y); line(x + 44, y, x + 60, y)
    for dx in (0, 12):
        arrow(x + 22 + dx, y - 22, x + 34 + dx, y - 38)

def gnd(x, y):
    line(x, y, x, y + 16)
    for i, hw in enumerate((20, 12, 5)):
        line(x - hw, y + 16 + i*7, x + hw, y + 16 + i*7, 2.5)

def contact(x, y):
    add(f'<circle cx="{x}" cy="{y}" r="4" fill="#fff" stroke="{WIRE}" stroke-width="2"/>')

def button_h(x, y):              # horizontal push button, terminals at x and x+80
    line(x, y, x + 18, y); line(x + 62, y, x + 80, y)
    contact(x + 22, y); contact(x + 58, y)
    line(x + 22, y - 12, x + 58, y - 12, 2.5); line(x + 40, y - 12, x + 40, y - 24); line(x + 32, y - 24, x + 48, y - 24, 2.5)

def button_v(x, y):              # vertical push button, terminals at y and y+80
    line(x, y, x, y + 18); line(x, y + 62, x, y + 80)
    contact(x, y + 22); contact(x, y + 58)
    line(x - 12, y + 22, x - 12, y + 58, 2.5); line(x - 12, y + 40, x - 24, y + 40); line(x - 24, y + 32, x - 24, y + 48, 2.5)

def npn(x, y):                   # base wire ends at (x, y); returns collector and emitter points
    add(f'<circle cx="{x+30}" cy="{y}" r="36" fill="#fff" stroke="{WIRE}" stroke-width="2"/>')
    line(x, y, x + 18, y); line(x + 18, y - 22, x + 18, y + 22, 3.5)
    c, e = (x + 42, y - 46), (x + 42, y + 46)
    line(x + 18, y - 9, c[0], y - 28); line(c[0], y - 28, c[0], c[1])
    line(x + 18, y + 9, e[0], y + 28); line(e[0], y + 28, e[0], e[1])
    arrow(x + 28, y + 17, x + 40, y + 27, WIRE, 2)
    return c, e

def motor(x, y):                 # centre (x, y), terminals at y-24 and y+24
    add(f'<circle cx="{x}" cy="{y}" r="24" fill="#fff" stroke="{WIRE}" stroke-width="2.5"/>')
    text(x, y + 7, "M", 20, "middle", "bold")

def diode_v_up(x, y):            # cathode at the top y, anode at y+50 (reverse-biased across a load)
    line(x, y, x, y + 14); line(x, y + 36, x, y + 50)
    add(f'<polygon points="{x-14},{y+36} {x+14},{y+36} {x},{y+14}" fill="#fff" stroke="{WIRE}" stroke-width="2"/>')
    line(x - 14, y + 14, x + 14, y + 14, 3)

W, H = 1320, 830
RED, GREEN, BLUE, PURPLE = "#c62828", "#2e7d32", "#1565c0", "#6a1b9a"
add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
add(f'<rect width="{W}" height="{H}" fill="#ffffff"/>')
text(40, 46, "Витяжний вентилятор: цикл 1 година, робота 15 хвилин, усе робить апаратний таймер", 20, "start", "bold", "#112")

bx, by, bw, bh = 40, 90, 270, 570
box(bx, by, bw, bh, "#eef2f7", "#334")
text(bx + 20, by + 36, "ESP32-S3", 22, "start", "bold", "#223")
text(bx + 20, by + 60, "YD-ESP32-S3 (N16R8)", 14, "start", "normal", "#445")
text(bx + 20, by + 94, "живлення: USB-C «USB» від ПК", 13, "start", "normal", "#52606d")
text(bx + 20, by + 114, "логіка 3,3 В", 13, "start", "normal", "#52606d")
PX = bx + bw
Y5, YB, YG2 = 120, 300, 640
YLR, YLW, YBT, YG = 450, 530, 590, 640
for y, n in ((YB, "GPIO2"), (YLR, "GPIO15"), (YLW, "GPIO16"), (YBT, "GPIO21"), (YG, "GND")):
    pin_r(PX, y, n)

# +5 V rail and common ground
XR = 1150
line(470, Y5, XR, Y5, 2.5, RED)
text(610, Y5 - 12, "+5 В: шина «+» макетки, модуль живлення MB-102 (не від піна ESP32)", 14, "start", "bold", RED)
line(PX + 6, YG, XR + 90, YG, 3.5, GREEN)
text(PX + 40, YG + 26, "СПІЛЬНА ЗЕМЛЯ: GND плати, «−» MB-102, GND модуля реле", 14, "start", "bold", GREEN)

# level shifter
line(PX + 6, YB, 370, YB, 2.5, BLUE); res_h(370, YB, "R1  10 кОм"); line(460, YB, 500, YB, 2.5, BLUE)
(cx, cy), (ex, ey) = npn(500, YB)
text(590, YB + 8, "VT1 BC547B", 15, "start", "bold"); text(590, YB + 28, "NPN: 3,3 В → 5 В", 13, "start", "normal", "#52606d")
gnd(ex, ey)
YIN = 220
line(cx, cy, cx, YIN)
res_v(cx, 130, "R2", "10 кОм"); line(cx, Y5, cx, 130, 2.5, RED); dot(cx, Y5, RED); line(cx, 200, cx, YIN)
dot(cx, YIN, PURPLE)

# relay module
mx, my, mw, mh = 760, 140, 280, 320
box(mx, my, mw, mh, "#eaf3fc", "#1f4e79")
text(mx + 18, my + 30, "Модуль реле 5 В", 17, "start", "bold")
text(mx + 18, my + 52, "активний рівень IN — LOW", 13, "start", "normal", "#445")
pin_l(mx, YIN, "IN"); line(cx, YIN, mx - 6, YIN, 2.5, PURPLE)
pin_l(mx, 300, "VCC"); pin_l(mx, 420, "GND")
XVCC, XMG = 730, 700
line(mx - 6, 300, XVCC, 300, 2.5, RED); line(XVCC, 300, XVCC, Y5, 2.5, RED); dot(XVCC, Y5, RED)
line(mx - 6, 420, XMG, 420, 2.5, GREEN); line(XMG, 420, XMG, YG, 2.5, GREEN); dot(XMG, YG, GREEN)
text(mx + 100, 340, "HIGH на GPIO2 →", 13, "start", "normal", "#52606d")
text(mx + 100, 360, "IN ≈ 0 В → реле ON,", 13, "start", "normal", "#52606d")
text(mx + 100, 380, "контакт COM–NO", 13, "start", "normal", "#52606d")

# contact → fan
XCOM, XNO = 1070, 1150
line(mx + mw, 250, XCOM, 250); text(XCOM - 6, 276, "COM", 13, "middle", "bold")
contact(XCOM, 250); line(XCOM, 250, XCOM, Y5, 2.5, RED); dot(XCOM, Y5, RED)
line(XCOM + 4, 248, 1112, 226, 2.5); contact(1118, 250); text(1118, 276, "NO", 13, "middle", "bold")
line(1122, 250, XNO, 250); line(XNO, 250, XNO, 400)
dot(XNO, 400)
motor(XNO, 450); line(XNO, 400, XNO, 426); line(XNO, 474, XNO, YG, 2.5); dot(XNO, YG, GREEN)
text(XNO - 34, 500, "вентилятор", 15, "end", "bold"); text(XNO - 34, 520, "мотор TT, 5 В", 13, "end", "normal", "#52606d")
XD = 1230
line(XNO, 400, XD, 400); line(XD, 400, XD, 425); diode_v_up(XD, 425); line(XD, 475, XD, YG); dot(XD, YG, GREEN)
text(XD + 18, 446, "VD1", 14, "start", "bold"); text(XD + 18, 466, "1N4007", 13, "start", "normal", "#52606d")

# indicators and button
line(PX + 6, YLR, 370, YLR); res_h(370, YLR, "R3  220 Ом"); line(460, YLR, 500, YLR); led_h(500, YLR, "#e53935")
line(560, YLR, 590, YLR); line(590, YLR, 590, YG); dot(590, YG, GREEN)
text(604, YLR + 5, "працює", 14, "start", "bold", "#b71c1c")
line(PX + 6, YLW, 370, YLW); res_h(370, YLW, "R4  220 Ом"); line(460, YLW, 500, YLW); led_h(500, YLW, "#43a047")
line(560, YLW, 590, YLW); dot(590, YLW)
text(604, YLW + 5, "чекає", 14, "start", "bold", "#2e7d32")
line(PX + 6, YBT, 370, YBT); button_h(370, YBT); line(450, YBT, 480, YBT); line(480, YBT, 480, YG); dot(480, YG, GREEN)
text(370, YBT + 26, "S1 «увімкнути зараз»", 13, "start", "bold")

ny = 700
for dy, s, size, w, c in ((0, "Як це працює", 15, "bold", "#112"),
    (24, "gptimer (ESP-IDF): тік 1 мкс, спрацьовує раз на секунду циклу. Обробник сам рахує секунду циклу й перемикає GPIO2, GPIO15, GPIO16:", 14, "normal", "#223"),
    (46, "другий цикл, loop() чи окрема задача для цього не потрібні. Під час налагодження SPEEDUP 300 робить з години 12 с, а з 15 хвилин 3 с.", 14, "normal", "#223"),
    (74, "Мотор не можна вішати на GPIO напряму. Живлення мотора — від MB-102, а не від плати, GND спільний. Діод VD1 — смугою до «+», паралельно мотору.", 14, "bold", "#7f1d1d"),
    (98, "Мотора немає? Замість нього підійде LED + 220 Ом на контакті NO, як у «Сутінковому перемикачі».", 14, "normal", "#52606d")):
    text(40, ny + dy, s, size, "start", w, c)

add('</svg>')
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'schematic.svg'), 'w').write("\n".join(out))
print("ok")
