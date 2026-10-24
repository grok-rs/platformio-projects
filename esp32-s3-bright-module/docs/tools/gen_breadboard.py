# Generates ../breadboard.svg — the same circuit as schematic.svg on a full-size
# breadboard: MB-102 power module on the right end (bottom side = 5 V), YD-ESP32-S3 on the left,
# GPIO5 → R1 1 kΩ (across the channel) → base of 2N2222; +5 V → LED → R2 220 Ω → collector; emitter → GND;
# button S1 3V3 → GPIO6 (ТЗ-A «Яскравий модуль»).
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..',
                                'esp32-s3-bounce-test', 'docs', 'tools'))
from yd_board import Svg, breadboard, esp32, rx, j1_row, j3_row, COL, RAIL

s = Svg(1320, 840)
s.text(20, 34, "ТЗ-A «Яскравий модуль» на макетці: GPIO5 → ключ 2N2222 → LED (5 В від MB-102), кнопка S1 3V3 → GPIO6", 19, "start", "bold", "#112")
breadboard(s)
esp32(s, 'i', 'b', used_top=("5", "6", "3V3"), used_bot=("G",))

BLK, RED, GRN, ORG, PUR = "#222", "#d32f2f", "#2e7d32", "#ef6c00", "#6a1b9a"

# --- MB-102 power module: plugs into both rail pairs at the right end ------------
MX0, MX1 = rx(57) - 10, 1306
s.rect(MX0, 64, MX1 - MX0, 364, "#1f4e79", "#0d2a44", 1.5, 6, 'opacity="0.96"')
s.text((MX0 + MX1) / 2, 200, "MB-102", 14, "middle", "bold", "#ffffff")
s.text((MX0 + MX1) / 2, 218, "модуль живлення", 10, "middle", "normal", "#cfe3f5")
s.rect(MX1 - 34, 228, 40, 30, "#c0c0c0", "#666", 1, 3); s.text(MX1 - 40, 247, "USB", 9, "end", "bold", "#fff")
s.add(f'<circle cx="{MX1 - 18}" cy="290" r="13" fill="#111" stroke="#666" stroke-width="2"/>')
s.text(MX1 - 40, 294, "DC 6,5–12 В", 9, "end", "bold", "#fff")
s.rect(MX0 + 14, 236, 22, 22, "#e0e0e0", "#555", 1, 3); s.add(f'<circle cx="{MX0 + 25}" cy="247" r="6" fill="#444"/>')
s.text(MX0 + 25, 272, "ON", 9, "middle", "bold", "#fff")
s.add(f'<circle cx="{MX0 + 25}" cy="290" r="4" fill="#4caf50"/>')
# rail pins (+ and − of each side) and the voltage-select jumper of each side
for yp, yn in ((RAIL['tp'], RAIL['tn']), (RAIL['bp'], RAIL['bn'])):
    for y in (yp, yn):
        s.rect(rx(59) - 4, y - 4, 8, 8, "#d4af37", "#7a5f00", 1)
    s.text(rx(59) + 9, yp + 4, "+", 11, "start", "bold", "#ff8a80")
    s.text(rx(59) + 9, yn + 4, "−", 11, "start", "bold", "#90caf9")
def jumper(y, on, label_on):
    labels = ("5V", "OFF", "3V3")
    for i, l in enumerate(labels):
        x = rx(61) + i * 18 - 18
        s.rect(x - 3, y - 3, 6, 6, "#d4af37", "#7a5f00", 1)
        s.text(x, y - 8, l, 7, "middle", "bold" if l == on else "normal", "#fff" if l == on else "#9fb6cc")
    x = rx(61) + labels.index(on) * 18 - 18
    s.rect(x - 7, y - 5, 23 if on != "3V3" else 14, 10, "none", "#ffd54f", 2, 2)
    s.text(rx(61), y + 18, label_on, 8, "middle", "bold", "#ffd54f")
jumper(150, "OFF", "верх: OFF")
jumper(338, "5V", "низ: 5 В")

s.text(rx(31) + 9, 368, "розрив шини", 9, "middle", "normal", "#b91c1c")

# --- GPIO5 → j46 → R1 1 kΩ across the channel (f46 → e46) → base (c46) ----------
g5 = j1_row("5")                                                   # GPIO5 sits in i18, j18 is free
s.wire(rx(g5), COL['j'], rx(46), COL['j'], GRN, bulge=48)
def resistor_v(r, y1, y2, bands, label):
    x = rx(r)
    s.line(x, y1, x, y1 + 10, 2, "#888"); s.line(x, y2 - 10, x, y2, 2, "#888")
    s.rect(x - 7, y1 + 10, 14, y2 - y1 - 20, "#e9dcb8", "#7a6a4a", 1.2, 3)
    for i, c in enumerate(bands): s.rect(x - 7, y1 + 14 + i * 7, 14, 3.5, c)
    for y in (y1, y2): s.add(f'<circle cx="{x}" cy="{y}" r="2.5" fill="#bbb"/>')
    s.text(x - 12, (y1 + y2) / 2 + 4, label, 11, "end", "bold", "#333")
resistor_v(46, COL['f'], COL['e'], ("#8b4513", "#000", "#d00"), "R1 1 кОм")    # brown-black-red

# --- Q1 2N2222, TO-92 flat face towards the viewer: E c45, B c46, C c47 -----------
y = COL['c']
for r in (45, 46, 47): s.add(f'<circle cx="{rx(r)}" cy="{y}" r="3" fill="#bbb" stroke="#555"/>')
R = 27                                                            # half-disc body, flat face down (towards you)
s.add(f'<path d="M{rx(46) - R},{y - 8} A{R},{R} 0 0 1 {rx(46) + R},{y - 8} Z" fill="#333" stroke="#000" stroke-width="1"/>')
for r in (45, 46, 47): s.line(rx(r), y - 8, rx(r), y, 2, "#9e9e9e")
s.text(rx(46), y - 14, "2N2222", 8, "middle", "bold", "#eee")
for r, l in ((45, "E"), (46, "B"), (47, "C")): s.text(rx(r), y + 15, l, 10, "middle", "bold", "#333")
s.text(rx(46) - R - 4, y - 12, "Q1", 11, "end", "bold", "#333")

# --- emitter → GND rail; collector → R2 220 Ω → LED → +5 V rail ---------------------
s.wire(rx(45), COL['a'], rx(44), RAIL['bn'], BLK)             # diagonal: hops over the + rail
def resistor_h(r1, r2, y, bands, label):
    x1, x2 = rx(r1), rx(r2)
    s.line(x1, y, x1 + 10, y, 2, "#888"); s.line(x2 - 10, y, x2, y, 2, "#888")
    s.rect(x1 + 10, y - 7, x2 - x1 - 20, 14, "#e9dcb8", "#7a6a4a", 1.2, 3)
    for i, c in enumerate(bands): s.rect(x1 + 18 + i * 9, y - 7, 4, 14, c)
    for x in (x1, x2): s.add(f'<circle cx="{x}" cy="{y}" r="2.5" fill="#bbb"/>')
    s.text((x1 + x2) / 2, y + 22, label, 11, "middle", "bold", "#333")
resistor_h(47, 51, COL['b'], ("#d00", "#d00", "#8b4513"), "R2 220 Ом")         # red-red-brown
# LED: cathode (short leg, flat rim) d51, anode (long leg) d52
xk, xa, yl = rx(51), rx(52), COL['d']
for x in (xk, xa): s.add(f'<circle cx="{x}" cy="{yl}" r="3" fill="#bbb" stroke="#555"/>')
s.add(f'<circle cx="{(xk + xa) / 2}" cy="{yl - 14}" r="11" fill="#ef5350" stroke="#333" stroke-width="1.5"/>')
s.add(f'<circle cx="{(xk + xa) / 2 - 3}" cy="{yl - 17}" r="3" fill="#fff" opacity="0.6"/>')
s.line(xk - 2, yl - 26, xk - 2, yl - 2, 2.5, "#333")
for x in (xk, xa): s.line(x, yl - 6, x, yl, 2, "#9e9e9e")                    # flat rim = cathode side
s.text(xk - 10, yl - 18, "−", 11, "middle", "bold", "#333"); s.text(xa + 10, yl - 18, "+", 11, "middle", "bold", "#333")
s.text(xa + 18, yl - 4, "HL1", 11, "start", "bold", "#c62828")
s.wire(xa, COL['a'], xa, RAIL['bp'], RED)

# --- button S1: 6x6 tactile switch over the channel, legs f27 f29 e27 e29 -----------
# The diagonal pair (f27 ↔ e29) is always the switched pair, whichever way the button is turned.
B1 = 27
for x in (rx(B1), rx(B1 + 2)):
    for yy in (COL['f'], COL['e']): s.add(f'<circle cx="{x}" cy="{yy}" r="3.5" fill="#bbb" stroke="#555" stroke-width="1"/>')
s.rect(rx(B1) - 9, COL['f'] + 6, rx(B1 + 2) - rx(B1) + 18, COL['e'] - COL['f'] - 12, "#2b2b2b", "#000", 1, 3)
s.add(f'<circle cx="{rx(B1 + 1)}" cy="{(COL["f"] + COL["e"]) / 2}" r="10" fill="#555" stroke="#111" stroke-width="1.5"/>')
s.text(rx(B1 + 1), COL['f'] - 8, "S1", 11, "middle", "bold", "#333")
s.wire(rx(j1_row("3V3") ), COL['j'], rx(B1), COL['j'], ORG, bulge=26)          # 3V3 (i21) → j27 → leg f27
# GPIO6 (i17) → j17 → a29 → leg e29: over the board, past the right side of S1, then back into a29
x1, x2, xr = rx(j1_row("6")), rx(B1 + 2), rx(B1 + 5)
s.add(f'<path d="M{x1},{COL["j"]} C{x1},48 {xr},48 {xr},{COL["e"]} C{xr},{COL["a"] - 18} {x2},{COL["a"] - 18} {x2},{COL["a"]}" '
      f'fill="none" stroke="{PUR}" stroke-width="4.5" stroke-linecap="round"/>')
for x, y in ((x1, COL['j']), (x2, COL['a'])):
    s.add(f'<circle cx="{x}" cy="{y}" r="3.2" fill="#ddd" stroke="{PUR}" stroke-width="1.5"/>')

# --- common ground: ESP32 G (b22) → a22 → GND rail right of the split -------------
gr = j3_row("G")                                                  # J3 pin 1 = row 22
s.wire(rx(gr), COL['a'], rx(34), RAIL['bn'], BLK, bulge=-40)
s.text(rx(gr) + 6, COL['a'] + 16, "G", 10, "start", "bold", BLK)

# --- notes ---------------------------------------------------------------------------
ny = 516
def note(t, dy, bold=False, fill="#222"): s.text(20, ny + dy, t, 13, "start", "bold" if bold else "normal", fill)
note("0.  Збирайте й перемикайте схему лише при вимкненому живленні (USB ESP32 від'єднано, MB-102 — OFF).", -24, True, "#b71c1c")
note("1.  MB-102 — на правий край макетки, штирі в обидві пари шин. Нижня перемичка — 5V, верхня — OFF. Звірте «+»/«−» модуля з червоною/синьою шиною.", 0)
note("2.  GPIO5 (i18, гребінець J1) → вільний отвір j18 → зелений дріт → j46. R1 1 кОм (коричневий-чорний-червоний) стоїть ЧЕРЕЗ канал: f46 → e46.", 24)
note("3.  Q1 2N2222 у корпусі TO-92, плаский бік до себе: E — c45, B — c46 (з'єднана з R1 через ряд 46), C — c47. Емітер: a45 → шина «−» (ряд 44).", 48)
note("4.  Колектор: R2 220 Ом (червоний-червоний-коричневий) b47 → b51 → катод LED d51 (коротка ніжка, плаский обідок). Анод d52 → a52 → шина «+» (5 В).", 72)
note("5.  СПІЛЬНА ЗЕМЛЯ: пін G ESP32 (b22, гребінець J3) → a22 → шина «−» ПРАВОРУЧ від розриву (ряд 34). Без цього дроту LED не засвітиться.", 96, True, GRN)
note("6.  Кнопка S1 над каналом (ряди 27/29): 3V3 (i21) → j21 → помаранчевий → j27 (ніжка f27); GPIO6 (i17) → j17 → фіолетовий → a29 (ДІАГОНАЛЬНА ніжка e29).", 120)
note("     Резистор не потрібен: INPUT_PULLDOWN тримає GPIO6 у LOW, натискання дає 3,3 В → RISING. Кнопку живити тільки від 3V3, ніколи від 5 В!", 144)
note("7.  ESP32 живиться від USB-C комп'ютера. +5 В MB-102 НЕ подавати на 5V / VIN / піни ESP32 — єдиний зв'язок між живленнями — GND.", 168, True, "#b71c1c")
note("Шлях струмів:  керування  GPIO5 → R1 → B → E → шина «−» → G ESP32 (≈ 2,6 мА);   навантаження  MB-102 +5 В → LED → R2 → C → E → шина «−» → MB-102 (≈ 13 мА).", 204, False, "#445")
note("Перевірка: duty 255 → LED на максимумі, U(КЕ) ≈ 0,1–0,2 В; duty 0 → не світить; натискання S1: OFF → LOW → MID → HIGH → OFF.", 228, False, "#445")
note("LED не світить ніколи — перевірте спільну землю, полярність LED, E-B-C транзистора і перемичку 5V на MB-102.", 252, False, "#445")
lx, ly = 20, ny + 290
for c, l, dx in ((GRN, "GPIO5 → R1 (ШІМ керування)", 0), (RED, "+5 В від MB-102", 260), (BLK, "GND (спільна земля)", 450), (ORG, "3V3 → S1", 660), (PUR, "S1 → GPIO6", 800)):
    s.line(lx + dx, ly, lx + dx + 28, ly, 4.5, c); s.text(lx + dx + 36, ly + 4, l, 12)

s.add('</svg>')                                                   # Svg.save() writes next to yd_board.py
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'breadboard.svg'), 'w').write("\n".join(s.out))
print("ok")
