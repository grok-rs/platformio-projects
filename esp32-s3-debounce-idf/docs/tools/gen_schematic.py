# Generates ../schematic.svg — module 2.6 homework (tasks of lesson 2.4): button on GPIO7 with a 10 kΩ pull-up,
# LED on GPIO15; task 5 adds the RC filter 100 Ω + 100 nF.
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

W, H = 1200, 760
RED, GREEN, PURPLE, ORANGE, TEAL = "#c62828", "#2e7d32", "#6a1b9a", "#ef6c00", "#00897b"
add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
add(f'<rect width="{W}" height="{H}" fill="#ffffff"/>')
text(40, 46, "Усунення брязкоту: кнопка на GPIO7 з підтяжкою 10 кОм, LED на GPIO15, RC-фільтр лише в завданні 5", 19, "start", "bold", "#112")

bx, by, bw, bh = 40, 90, 260, 470
box(bx, by, bw, bh, "#eef2f7", "#334")
text(bx + 20, by + 36, "ESP32-S3", 22, "start", "bold", "#223")
text(bx + 20, by + 60, "YD-ESP32-S3 (N16R8)", 14, "start", "normal", "#445")
text(bx + 20, by + 94, "ESP-IDF 6.1 (C) або", 13, "start", "normal", "#52606d")
text(bx + 20, by + 114, "esp-hal (Rust)", 13, "start", "normal", "#52606d")
PX = bx + bw
Y33, YB, YL, YG = 130, 270, 420, 520
for y, n in ((Y33, "3V3"), (YB, "GPIO7"), (YL, "GPIO15"), (YG, "GND")):
    pin_r(PX, y, n)
XN = 520            # node: pull-up, filter and GPIO7 meet here
line(PX + 6, Y33, XN, Y33, 2.5, ORANGE); text(PX + 40, Y33 - 10, "тільки 3V3, не 5V!", 14, "start", "bold", ORANGE)
add(f'<rect x="{XN-12}" y="160" width="24" height="70" fill="#fff6d5" stroke="{WIRE}" stroke-width="2"/>')
text(XN - 22, 190, "R1", 15, "end", "bold"); text(XN - 22, 210, "10 кОм", 15, "end")
line(XN, Y33, XN, 160, 2.5, ORANGE)
line(XN, 230, XN, YB, 2.5, PURPLE)
line(PX + 6, YB, XN, YB, 2.5, PURPLE); dot(XN, YB, PURPLE)
text(PX + 30, YB - 12, "вузол кнопки", 14, "start", "bold", PURPLE)
arrow(PX + 110, YB + 44, PX + 110, YB + 6, TEAL, 2)
text(PX + 30, YB + 62, "CH1 аналізатора", 13, "start", "bold", TEAL)

# RC filter (task 5)
fx, fy, fw, fh = 600, 180, 310, 300
box(fx, fy, fw, fh, "#faf5ff", PURPLE, "8 6")
text(fx + 16, fy + 26, "Лише завдання 5: RC-фільтр", 15, "start", "bold", PURPLE)
text(fx + 16, fy + 46, "Без нього: C1 знято, R2 замінено дротом", 13, "start", "normal", "#52606d")
XC, XR2 = 660, 750
line(XN, YB, XR2, YB, 2.5, PURPLE); dot(XC, YB, PURPLE)
line(XC, YB, XC, 360); cap_v(XC, 360, "C1", "100 нФ"); line(XC, 372, XC, YG)
res_h(XR2, YB, "R2  100 Ом"); line(XR2 + 90, YB, 970, YB, 2.5)

# button to GND
XBTN = 970
button_v(XBTN, YB); line(XBTN, YB + 80, XBTN, YG)
text(XBTN + 18, YB + 46, "S1", 16, "start", "bold"); text(XBTN + 18, YB + 66, "тактова кнопка", 13, "start", "normal", "#52606d")

line(PX + 6, YG, XBTN, YG, 3.5, GREEN); dot(XC, YG, GREEN); dot(XBTN, YG, GREEN); gnd(XBTN, YG)
text(XBTN + 28, YG + 6, "спільний GND", 15, "start", "bold", GREEN)

# LED
line(PX + 6, YL, 370, YL); res_h(370, YL, "R3  220 Ом"); line(460, YL, 480, YL); led_h(480, YL, "#e53935")
line(540, YL, 570, YL); line(570, YL, 570, YG); dot(570, YG, GREEN)
text(PX + 30, YL + 42, "CH2 аналізатора: реакція", 13, "start", "bold", TEAL)

ny = 600
for dy, s, size, w, c in ((0, "Навіщо саме так", 15, "bold", "#112"),
    (24, "Натискання: C1 розряджається через R2 і кнопку, τ = 100 Ом × 100 нФ = 10 мкс, тобто фронт і далі майже миттєвий.", 14, "normal", "#223"),
    (46, "Відпускання: C1 заряджається через R1, τ = 10 кОм × 100 нФ = 1 мс. Короткі розмикання під час брязкоту не встигають підняти вузол до рівня HIGH.", 14, "normal", "#223"),
    (68, "Вхід GPIO7 бачить HIGH від 0,75 × 3,3 В ≈ 2,5 В: це ≈ 1,4 τ, близько 1,4 мс після відпускання.", 14, "normal", "#223"),
    (96, "R2 обмежує струм розряду C1 через контакти: 3,3 В / 100 Ом = 33 мА замість стрибка, який обмежує лише опір дроту.", 14, "normal", "#52606d"),
    (120, "Не беріть GPIO35–37: на платі N16R8 вони зайняті пам'яттю PSRAM. GPIO0, 3, 45, 46 теж не для кнопки: це strapping-піни.", 14, "bold", "#7f1d1d")):
    text(40, ny + dy, s, size, "start", w, c)

add('</svg>')
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'schematic.svg'), 'w').write("\n".join(out))
print("ok")
