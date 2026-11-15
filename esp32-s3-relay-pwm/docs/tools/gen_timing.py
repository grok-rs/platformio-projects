import math, os
# Generates ../timing.svg — module 2.2 homework timing diagrams (schematic, not to scale):
#   top:    what relay.cpp timestamps — command on GPIO2, coil current, NO contact on GPIO5 with bounce, ISR calls;
#   bottom: UART 8N1 as PWM — two back-to-back frames of 0x00, 0x0F, 0x55, 0xFF on GPIO6.
W, H = 1320, 980
INK, MUTED, GRID = "#223", "#52606d", "#d5dbe3"
C_CMD, C_COIL, C_SIG, C_ISR, C_T = "#1565c0", "#e65100", "#6a1b9a", "#2e7d32", "#b71c1c"
out = []
def add(s): out.append(s)

def text(x, y, s, size=14, anchor="start", weight="normal", fill=INK, family="DejaVu Sans, Arial, sans-serif"):
    add(f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}" font-weight="{weight}" fill="{fill}" font-family="{family}">{s}</text>')

def line(x1, y1, x2, y2, w=2, color=INK, dash=""):
    extra = f' stroke-dasharray="{dash}"' if dash else ""
    add(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{w}" stroke-linecap="round"{extra}/>')

def poly(points, color, w=2.5):
    pts = " ".join(f"{x:.1f},{y:.1f}" for x, y in points)
    add(f'<polyline points="{pts}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linejoin="round"/>')

def digital(y, edges, x0, x1, high_first, color, hi=34):
    """Logic trace between x0 and x1; `edges` — x of every level change. Returns nothing."""
    level, x, pts = high_first, x0, []
    for e in edges + [x1]:
        yy = y - hi if level else y
        pts += [(x, yy), (e, yy)]
        x, level = e, not level
    poly(pts, color)

def bracket(x1, x2, y, label, color, below=True):   # |<---->| with a label
    line(x1, y - 6, x1, y + 6, 2, color); line(x2, y - 6, x2, y + 6, 2, color); line(x1, y, x2, y, 2, color)
    text((x1 + x2) / 2, y + 20 if below else y - 10, label, 13, "middle", "bold", color)

def tick(x, y, color, w=2.5, h=26):
    line(x, y, x, y - h, w, color)
    add(f'<circle cx="{x}" cy="{y - h}" r="3.5" fill="{color}"/>')

add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
add(f'<rect width="{W}" height="{H}" fill="#ffffff"/>')

# =====================================================================================================
# top: relay
# =====================================================================================================
text(40, 40, "ДЗ 1: що вимірює relay.cpp — схематично, не в масштабі", 20, "start", "bold", "#112")
X0, X1 = 230, 1290
T0, OP, T1, REL = 290, 450, 830, 940                      # command ON, first NO edge, command OFF, release edge
BOUNCE = [OP, OP + 10, OP + 14, OP + 26, OP + 29, OP + 42, OP + 44]   # closing NO: odd number of edges
RBOUNCE = [REL, REL + 9, REL + 12]                        # opening NO: usually much less bounce
WAIT = T0 + 250                                           # end of WAIT_MS after the ON command

add(f'<rect x="{T0}" y="64" width="{WAIT - T0}" height="330" fill="#fff8e1"/>')
add(f'<rect x="{T1}" y="64" width="{WAIT - T0}" height="330" fill="#fff8e1"/>')
text(T0 + 8, 82, "WAIT_MS = 50 мс: delay(), ISR ловить фронти", 12, "start", "bold", "#8d6e00")
text(T1 + 8, 82, "WAIT_MS = 50 мс", 12, "start", "bold", "#8d6e00")
for x in range(X0, X1 + 1, 40):
    line(x, 96, x, 370, 1, GRID)
# break in the time axis: PAUSE_MS between the ON and OFF measurements
bx = (WAIT + T1) / 2
add(f'<rect x="{bx - 26}" y="90" width="52" height="290" fill="#ffffff"/>')
for dx in (-8, 8):
    poly([(bx + dx - 6, 380), (bx + dx + 6, 90)], MUTED, 1.5)
text(bx, 398, "PAUSE_MS 1 с", 12, "middle", "bold", MUTED)

rows = [("GPIO2", "команда", 150, C_CMD), ("котушка", "струм", 215, C_COIL), ("GPIO5", "контакт NO", 290, C_SIG), ("ISR", "onContact()", 360, C_ISR)]
for name, sub, y, c in rows:
    text(40, y - 14, name, 15, "start", "bold", c)
    text(40, y + 4, sub, 12, "start", "normal", MUTED)

digital(150, [T0, T1], X0, X1, False, C_CMD)
# coil current: L/R rise after T0; after T1 it circulates through the module's diode and decays slowly
pts = [(X0, 215), (T0, 215)]
pts += [(T0 + i * 4, 215 - 36 * (1 - math.exp(-i * 4 / 55))) for i in range(1, 100) if T0 + i * 4 <= bx - 26]
pts += [(bx + 26, 215 - 36), (T1, 215 - 36)]
pts += [(T1 + i * 4, 215 - 36 * math.exp(-i * 4 / 70)) for i in range(1, 80)]
pts += [(X1, 215)]
poly(pts, C_COIL)
digital(290, BOUNCE + RBOUNCE, X0, X1, True, C_SIG)

for e in BOUNCE + RBOUNCE:
    tick(e, 360, C_ISR, 2)
tick(OP, 360, C_T, 3.5, 34); tick(REL, 360, C_T, 3.5, 34)
text(OP - 6, 318, "firstEdge", 12, "end", "bold", C_T)
text(BOUNCE[-1] + 6, 336, "lastEdge", 12, "start", "bold", C_ISR)
text(REL - 6, 318, "firstEdge", 12, "end", "bold", C_T)

for x, s in ((T0, "t0 = micros(); digitalWrite(RELAY, HIGH)"), (T1, "t0 = micros(); digitalWrite(RELAY, LOW)")):
    line(x, 100, x, 372, 1.5, C_T, "5 4")
    text(x + 6, 112, s, 11, "start", "bold", C_T, "DejaVu Sans Mono, monospace")
bracket(T0, OP, 384, "час увімкнення = firstEdge − t0", C_T)
bracket(OP, BOUNCE[-1], 252, "брязкіт = lastEdge − firstEdge", C_ISR, below=False)
bracket(T1, REL, 384, "час вимкнення", C_T)

ny = 440
for i, s in enumerate((
    "• ISR пише лише micros(): перший фронт — момент спрацювання, наступні тільки зсувають lastEdge. Брязкіт не може «зіпсувати» час — він після firstEdge.",
    "• Даташит SRD-05VDC-SL-C: увімкнення ≤ 10 мс, вимкнення ≤ 5 мс — без брязкоту і без діода. Діод на модулі гасить котушку повільніше → вимкнення довше.",
    "• Фронти, ближчі за час входу в ISR (кілька мкс), зливаються, тож «фронтів» — нижня межа. Аналізатор на GPIO2 і GPIO5 покаже всі.",
)):
    text(40, ny + i * 22, s, 13, "start", "normal", INK)

# =====================================================================================================
# bottom: UART 8N1 as PWM
# =====================================================================================================
TOP = 540
text(40, TOP, "ДЗ 2, експеримент: UART 8N1 як ШІМ — два кадри підряд на GPIO6 (9600 бод: біт 104 мкс, кадр 1,04 мс)", 20, "start", "bold", "#112")
BX0, BW, NB = 230, 42, 20                                # 20 bits = two frames
names = ["S", "0", "1", "2", "3", "4", "5", "6", "7", "P"] * 2
for i, n in enumerate(names):
    x = BX0 + i * BW
    add(f'<rect x="{x}" y="{TOP + 22}" width="{BW}" height="22" fill="{"#fde2e1" if n == "S" else "#e3f2e5" if n == "P" else "#eef2f7"}" stroke="#fff"/>')
    text(x + BW / 2, TOP + 38, n, 12, "middle", "bold", MUTED)
for k in range(3):
    line(BX0 + k * 10 * BW, TOP + 22, BX0 + k * 10 * BW, TOP + 330, 1.5 if k == 1 else 1, MUTED if k == 1 else GRID, "4 4" if k == 1 else "")
text(BX0 + 5 * BW, TOP + 16, "кадр 1", 12, "middle", "bold", MUTED)
text(BX0 + 15 * BW, TOP + 16, "кадр 2", 12, "middle", "bold", MUTED)
text(BX1 := BX0 + NB * BW + 18, TOP + 38, "частка HIGH · форма", 12, "start", "bold", MUTED)

bytes_ = [(0x00, "10 % · 960 Гц"), (0x0F, "50 % · 2 імпульси на кадр"), (0x55, "50 % · меандр 4,8 кГц"), (0xFF, "90 % · 960 Гц")]
for r, (b, note) in enumerate(bytes_):
    y = TOP + 100 + r * 66
    bits = [0] + [(b >> i) & 1 for i in range(8)] + [1]           # start, d0..d7 (LSB first), stop
    lv = bits * 2
    # shade HIGH bits, then the trace
    for i, v in enumerate(lv):
        if v:
            add(f'<rect x="{BX0 + i * BW}" y="{y - 34}" width="{BW}" height="34" fill="#f3e5f5"/>')
    pts = []
    for i, v in enumerate(lv):
        yy = y - 34 if v else y
        pts += [(BX0 + i * BW, yy), (BX0 + (i + 1) * BW, yy)]
    poly(pts, C_SIG)
    text(40, y - 14, f"0x{b:02X}", 16, "start", "bold", C_SIG)
    text(40, y + 4, "0 " + "".join(str(v) for v in bits[1:9]) + " 1", 12, "start", "normal", MUTED, "DejaVu Sans Mono, monospace")
    text(BX1, y - 10, note, 14, "start", "bold", INK)

ny = TOP + 370
for i, s in enumerate((
    "• Кадр: старт-біт (0), 8 біт даних молодшим уперед, стоп-біт (1). Частка HIGH = (кількість одиниць у байті + 1) / 10, тож 0 % і 100 % недосяжні.",
    "• 0x0F і 0x55 мають однакові 50 %, але різну форму: 0x55 — рівний меандр з частотою baud / 2, 0x0F — два імпульси в кадрі. Частота «ШІМ» = baud / 10.",
    "• У спокої TX = HIGH: без передачі мотор крутиться на повну. Serial1.begin(…, true) інвертує лінію: спокій LOW, 0x00 → 90 %, 0xFF → 10 %.",
)):
    text(40, ny + i * 22, s, 13, "start", "normal", INK)

add('</svg>')
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'timing.svg'), 'w').write("\n".join(out))
print("ok")
