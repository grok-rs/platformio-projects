# Generates docs/breadboard.svg — physical layout on a full-size (830-pt) breadboard:
# button S1 on GPIO21 and an 8-channel FX2 logic analyzer (Saleae Logic clone) probing it,
# plus the firmware's BOUNCE marker (GPIO40) and LABEL UART (GPIO41).
from yd_board import Svg, breadboard, esp32, rx, j1_row, j3_row, COL, RAIL

s = Svg(1320, 840)
s.text(20, 34, "Макетна плата: YD-ESP32-S3 + кнопка S1 (GPIO21) + логічний аналізатор — тест брязкоту", 19, "start", "bold", "#112")
breadboard(s)
s.text(rx(31)+9, 131, "розрив шини", 9, "middle", "normal", "#b91c1c")
# Headers in i/b instead of the usual h/a: one free hole stays on each side (j and a),
# so the bottom header (GPIO21, G) is reachable.
esp32(s, 'i', 'b', used_top=("G",), used_bot=("21", "40", "41", "G"))

def button(r1, r2):
    # 6x6 tactile switch straddling the center channel, legs in f/e of rows r1 and r2
    x1, x2 = rx(r1), rx(r2)
    for x in (x1, x2):
        for y in (COL['f'], COL['e']): s.add(f'<circle cx="{x}" cy="{y}" r="3.5" fill="#bbb" stroke="#555" stroke-width="1"/>')
    s.rect(x1-9, COL['f']+6, x2-x1+18, COL['e']-COL['f']-12, "#2b2b2b", "#000", 1, 3)
    s.add(f'<circle cx="{(x1+x2)/2}" cy="{(COL["f"]+COL["e"])/2}" r="10" fill="#555" stroke="#111" stroke-width="1.5"/>')
    s.text((x1+x2)/2, COL['e']+28, "S1", 11, "middle", "bold", "#333")

BLK, W21, P_BTN, P_MARK, P_LBL = "#222", "#7b1fa2", "#1565c0", "#2e7d32", "#ef6c00"

# --- Button: GPIO21 → S1 (diagonal legs a46 → e46, f48 → j48) → GND rail ---------
BTN = 46
button(BTN, BTN+2)
s.wire(rx(BTN+2), COL['j'], rx(BTN+2), RAIL['tn'], BLK)                 # S1 diagonal leg -> GND rail
s.wire(rx(j3_row("21")), COL['a'], rx(BTN), COL['a'], W21, bulge=-70)   # GPIO21 -> S1 (bottom half)
g = j1_row("G")
s.wire(rx(g), COL['j'], rx(g+1), RAIL['tn'], BLK)                       # ESP32 G -> rail (row 1 has no rail hole)
s.wire(rx(28), RAIL['tn'], rx(33), RAIL['tn'], BLK, bulge=30)           # bridge the split rail
s.text(rx(30.5), 48, "перемичка через розрив", 9, "middle", "normal", "#b91c1c")
s.text(rx(g+1)+8, 74-4, "G", 10, "start", "bold", "#222")

# --- Logic analyzer -----------------------------------------------------------
# One 10-pin header: GND, CH1…CH8, CLK. PulseView/Logic 2 call CH1…CH8 "D0…D7" / "Channel 0…7".
LX0 = rx(17)
LX1, LY = LX0 + 520, 540
s.rect(LX0, LY, LX1-LX0, 92, "#263238", "#000", 1.5, 8)
s.text(LX0+16, LY+58, "Логічний аналізатор 24 MHz 8CH", 15, "start", "bold", "#eceff1")
s.text(LX0+16, LY+80, "(клон Saleae Logic — Logic 2 або PulseView)", 11, "start", "normal", "#b0bec5")
s.rect(LX1-60, LY+38, 50, 30, "#c0c0c0", "#666", 1, 5)
s.text(LX1-35, LY+86, "USB → ПК", 10, "middle", "bold", "#eceff1")
pins = ["GND", "CH1", "CH2", "CH3", "CH4", "CH5", "CH6", "CH7", "CH8", "CLK"]
PX0, PSTEP = LX0+60, 38
px = {n: PX0 + i*PSTEP for i, n in enumerate(pins)}
used = {"CH1": P_BTN, "CH2": P_MARK, "CH3": P_LBL, "GND": BLK}
for n, x in px.items():
    s.rect(x-5, LY-5, 10, 10, "#d4af37", "#7a5f00", 1)
    hi = n in used
    s.text(x, LY+22, n, 10 if hi else 9, "middle", "bold" if hi else "normal", "#ffffff" if hi else "#90a4ae")
    sub = {"CH1": "D0", "CH2": "D1", "CH3": "D2"}.get(n)
    if sub: s.text(x, LY+36, sub, 9, "middle", "normal", "#80cbc4")

# Probe points: free holes on the same rows as the signals.
#   button net — row 46 (c): GPIO21 jumper in a, S1 leg in e
#   GND        — row 2 (a):  the ESP32 bottom-header G pin sits in b
s.wire(rx(BTN), COL['c'], px["CH1"], LY, P_BTN, bulge=-40)
s.wire(rx(2), COL['a'], px["GND"], LY, BLK, bulge=-60)
#   firmware outputs — GPIO40 / GPIO41 sit in b of rows 15 / 16, the a holes are free
s.wire(rx(j3_row("40")), COL['a'], px["CH2"], LY, P_MARK, bulge=-50)
s.wire(rx(j3_row("41")), COL['a'], px["CH3"], LY, P_LBL, bulge=-50)
s.text(rx(BTN)+8, COL['c']+4, "щуп CH1", 9, "start", "bold", P_BTN)
s.text(rx(2)+8, COL['a']+18, "GND аналізатора", 9, "start", "bold", BLK)

# --- What the three channels show on a bouncing release -------------------------
wx, wy = LX1 + 30, 548
s.text(wx, wy-12, "Брязкіт у Logic 2", 12, "start", "bold", "#112")
def trace(y, h, pts, c, label):
    s.add('<polyline points="' + " ".join(f"{a:.1f},{b}" for a, b in pts) + f'" fill="none" stroke="{c}" stroke-width="2"/>')
    s.text(wx+214, y+h/2+4, label, 9, "start", "bold", c)
by, bh = wy, 24
pts = [(wx, by+bh)]
x = wx + 20
for w in (5, 4, 8, 3):                               # bouncing release: LOW → HIGH with spikes
    pts += [(x, by+bh), (x, by), (x+w, by), (x+w, by+bh)]
    x += w + 5
pts += [(x, by+bh), (x, by), (wx+205, by)]
trace(by, bh, pts, P_BTN, "CH1")
second = wx + 20 + 5                                  # BOUNCE goes HIGH on the second edge …
my = by + 38
trace(my, 14, [(wx, my+14), (second, my+14), (second, my), (wx+150, my), (wx+150, my+14), (wx+205, my+14)], P_MARK, "CH2")
ly2 = my + 30                                         # … LABEL text follows 50 ms of quiet later
s.rect(wx+150, ly2, 55, 14, "#fff3e0", P_LBL, 1, 3)
s.text(wx+177, ly2+11, "RELEASE#7", 8, "middle", "bold", P_LBL)
s.line(wx, ly2+7, wx+150, ly2+7, 2, P_LBL); s.line(wx+205, ly2+7, wx+210, ly2+7, 2, P_LBL)
s.text(wx+214, ly2+11, "CH3", 9, "start", "bold", P_LBL)
s.text(wx, ly2+30, "тригер: CH2 ↑   підпис: +50 мс", 9, "start", "normal", "#333")

ny = 680
def note(t, dy, bold=False): s.text(20, ny+dy, t, 13, "start", "bold" if bold else "normal", "#222")
note("1.  ESP32 — через центральний канал: верхній гребінець у колонці i, нижній — у b. Так лишається по одному вільному отвору з кожного боку (j та a).", 0)
note("2.  Кнопка S1 над центральним каналом: GPIO21 (a5) → a46, ДІАГОНАЛЬНА ніжка f48 → j48 → шина «−». Резистор не потрібен — підтяжку дає INPUT_PULLUP.", 24)
note("3.  Пін G (останній на верхньому гребінці, біля USB-C; поруч 5V — не переплутати!) → шина «−». Шина розірвана посередині — перемичка 28→33.", 48)
note("4.  Аналізатор: CH1 → c46 (кнопка), CH2 → a15 (GPIO40, BOUNCE), CH3 → a16 (GPIO41, LABEL), GND → a2 (пін G). Без спільної землі запис — сміття.", 72, True)
note("     Підпис виводів на корпусі аналізатора може відрізнятися (CH0…CH7 замість CH1…CH8) — звіряйтеся з написами на вашому екземплярі.", 96)
lx, ly = 20, ny+136
for c, l, dx in ((W21, "GPIO21 → S1", 0), (BLK, "GND", 150), (P_BTN, "CH1 (D0) — кнопка", 250),
                 (P_MARK, "CH2 (D1) — BOUNCE, GPIO40", 450), (P_LBL, "CH3 (D2) — LABEL, GPIO41", 680)):
    s.line(lx+dx, ly, lx+dx+28, ly, 4.5, c); s.text(lx+dx+36, ly+4, l, 12)

s.save('breadboard.svg')
