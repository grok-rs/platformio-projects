# Generates ../schematic.svg — «Мультизадачний пристрій»: GPIO15/16/17 → 220 Ω → red/yellow/green LED → GND;
# buttons 3V3 → BTN1 → GPIO21 and 3V3 → BTN2 → GPIO18 (INPUT_PULLDOWN).
import math, os

W, H = 1200, 700
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


def contact(x, y):
    add(f'<circle cx="{x}" cy="{y}" r="4" fill="#fff" stroke="{WIRE}" stroke-width="2"/>')

def button_h(x, y):              # horizontal push button, terminals at x and x+80
    line(x, y, x + 18, y); line(x + 62, y, x + 80, y)
    contact(x + 22, y); contact(x + 58, y)
    line(x + 22, y - 12, x + 58, y - 12, 2.5); line(x + 40, y - 12, x + 40, y - 24); line(x + 32, y - 24, x + 48, y - 24, 2.5)

add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
add(f'<rect width="{W}" height="{H}" fill="#ffffff"/>')
text(40, 46, "Мультизадачний пристрій: 3 LED у своїх ритмах, BTN1 — швидкість LED2, BTN2 — пауза", 22, "start", "bold", "#112")

bx, by, bw, bh = 40, 80, 250, 480
add(f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" rx="14" fill="#eef2f7" stroke="#334" stroke-width="2.5"/>')
text(bx + 20, 330, "ESP32-S3", 24, "start", "bold", "#223")
text(bx + 20, 354, "YD-ESP32-S3 (N16R8)", 14, "start", "normal", "#445")
PX = bx + bw
BUS = 960
rows = [("GPIO15", 120, "#e53935", "LED1 · індикатор паузи", "червоний"),
        ("GPIO16", 210, "#fbc02d", "LED2 · швидкість від BTN1", "жовтий"),
        ("GPIO17", 300, "#43a047", "LED3 · завжди 1000 мс", "зелений")]
for i, (pin, y, color, label, cname) in enumerate(rows, 1):
    pin_r(PX, y, pin)
    line(PX + 6, y, 400, y); res_h(400, y, f"R{i}  220 Ом"); line(490, y, 600, y)
    led_h(600, y, color)
    line(660, y, BUS, y); dot(BUS, y)
    text(690, y - 12, label, 17, "start", "bold", "#112")
    text(690, y + 26, f"HL{i}, {cname}", 14, "start", "normal", "#52606d")

# buttons: 3V3 → button → GPIO, internal pull-down to GND
RED = "#c62828"
Y33, YB1, YB2, YG = 390, 440, 490, 535
pin_r(PX, Y33, "3V3"); pin_r(PX, YB1, "GPIO21"); pin_r(PX, YB2, "GPIO18"); pin_r(PX, YG, "GND")
XB = 520                                   # 3V3 riser x
line(PX + 6, Y33, XB, Y33, 2.5, RED); line(XB, Y33, XB, YB2, 2.5, RED); dot(XB, YB1, RED); dot(XB, YB2, RED)
text(PX + 40, Y33 - 10, "тільки 3V3, не 5V!", 15, "start", "bold", RED)
for y, name, what in ((YB1, "BTN1", "швидкість LED2 (1000 → 500 → 200)"), (YB2, "BTN2", "пауза вкл / викл")):
    line(PX + 6, y, 400, y); button_h(400, y); line(480, y, XB, y, 2.5, RED)
    text(560, y + 6, f"{name} · {what}", 16, "start", "bold", "#112")
line(PX + 6, YG, BUS, YG, 3.5, "#2e7d32"); dot(BUS, YG, "#2e7d32")
line(BUS, rows[0][1], BUS, YG, 3.5, "#2e7d32"); gnd(BUS, YG)
text(BUS + 18, YG + 6, "спільний GND", 16, "start", "bold", "#2e7d32")

ny = 610
def note(dy, s, size=15, weight="normal", fill="#223"): text(40, ny + dy, s, size, "start", weight, fill)
note(0, "Анод LED (довга ніжка) — до резистора, катод — до GND. Кнопки — між 3V3 і входом, режим INPUT_PULLDOWN:", 15, "bold")
note(24, "відпущена = LOW (внутрішня підтяжка ≈45 кОм до GND), натиснута = HIGH. Зовнішній резистор не потрібен.")
note(52, "Немає другої кнопки? Вбудована BOOT (GPIO0): натиснута = LOW, режим INPUT.", 14, "normal", "#52606d")

add('</svg>')
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'schematic.svg'), 'w').write("\n".join(out))
print("ok")
