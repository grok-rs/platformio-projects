import math, os
# Generates ../schematic-relay.svg and ../schematic-motor.svg — module 2.2 homework:
#   ДЗ 1: GPIO2 → R1 10 kΩ → BC547B (R2 10 kΩ pull-up to +5 V) → IN of the 5 V relay module; COM → GND, NO → GPIO5;
#   ДЗ 2: pot 10 kΩ → GPIO4 (ADC1); GPIO6 → R1 220 Ω → 2N2222, TT motor + 1N4007 + 100 nF from MB-102 +5 V.
WIRE = "#222"
C_IB, C_IC, C_GND, C_5V, C_SIG, C_33 = "#1565c0", "#e65100", "#2e7d32", "#c62828", "#6a1b9a", "#ef6c00"
out = []
def add(s): out.append(s)

def text(x, y, s, size=15, anchor="start", weight="normal", fill="#222", family="DejaVu Sans, Arial, sans-serif"):
    add(f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}" font-weight="{weight}" fill="{fill}" font-family="{family}">{s}</text>')

def mono(x, y, s, size=11, fill="#223"):
    text(x, y, s, size, "start", "normal", fill, "DejaVu Sans Mono, monospace")

def line(x1, y1, x2, y2, w=2, color=WIRE, dash=""):
    extra = f' stroke-dasharray="{dash}"' if dash else ""
    add(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{w}" stroke-linecap="round"{extra}/>')

def poly(points, color=WIRE, w=2):
    pts = " ".join(f"{x},{y}" for x, y in points)
    add(f'<polyline points="{pts}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linejoin="round"/>')

def dot(x, y, color=WIRE):
    add(f'<circle cx="{x}" cy="{y}" r="4.5" fill="{color}"/>')

def arrow(x1, y1, x2, y2, color, w=2.5):   # straight arrow, head at (x2, y2)
    line(x1, y1, x2, y2, w, color)
    a = math.atan2(y2 - y1, x2 - x1)
    p = [(x2, y2), (x2 - 12*math.cos(a - .4), y2 - 12*math.sin(a - .4)), (x2 - 12*math.cos(a + .4), y2 - 12*math.sin(a + .4))]
    add('<polygon points="' + " ".join(f"{x:.1f},{y:.1f}" for x, y in p) + f'" fill="{color}"/>')

def box(x, y, w, h, fill, stroke):
    add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="{fill}" stroke="{stroke}" stroke-width="2.5"/>')

def pad(x, y):
    add(f'<rect x="{x - 6}" y="{y - 6}" width="12" height="12" fill="#c9a227" stroke="#7a5f00" stroke-width="1.5"/>')

def pin_r(x, y, label, above=False):   # pin on the RIGHT edge of a box, stub to x+36
    pad(x, y); text(x - 12, y - 9 if above else y + 5, label, 15, "end", "bold", "#223"); line(x + 6, y, x + 36, y)

def pin_l(x, y, label):          # pin on the LEFT edge of a box, stub to x-36
    pad(x, y); text(x + 14, y + 5, label, 15, "start", "bold", "#223"); line(x - 6, y, x - 36, y)

def pin_b(x, y, label):          # terminal on the BOTTOM edge of a box, stub to y+30, label right of the stub
    pad(x, y); text(x + 9, y + 24, label, 13, "start", "bold", "#223"); line(x, y + 6, x, y + 30)

def res_h(x, y, name, value):    # horizontal resistor, body x..x+80 on wire y
    add(f'<rect x="{x}" y="{y-11}" width="80" height="22" fill="#fff6d5" stroke="{WIRE}" stroke-width="2"/>')
    text(x + 40, y - 20, f"{name}  {value}", 15, "middle", "bold")

def res_v(cx, y, name, value, h=60):   # vertical resistor, body y..y+h on wire cx
    add(f'<rect x="{cx-11}" y="{y}" width="22" height="{h}" fill="#fff6d5" stroke="{WIRE}" stroke-width="2"/>')
    text(cx + 22, y + h/2 - 4, name, 15, "start", "bold")
    text(cx + 22, y + h/2 + 16, value, 15, "start")

def npn(bx, cy):                 # base bar at x=bx, centred on y=cy; returns (coll_xy, emit_xy)
    add(f'<circle cx="{bx+22}" cy="{cy}" r="40" fill="#f4f7fb" stroke="{WIRE}" stroke-width="2"/>')
    line(bx, cy - 26, bx, cy + 26, 4)
    cx_ = bx + 40
    line(bx, cy - 12, cx_, cy - 34, 2.5); line(cx_, cy - 34, cx_, cy - 40, 2)
    line(bx, cy + 12, cx_, cy + 34, 2.5); line(cx_, cy + 34, cx_, cy + 40, 2)
    arrow(bx + 14, cy + 20, cx_ - 4, cy + 32, WIRE, 2.5)  # NPN: arrow points OUT of the emitter
    text(bx - 8, cy - 14, "B", 14, "end", "bold", "#223")
    text(cx_ + 12, cy - 30, "C", 14, "start", "bold", "#223")
    text(cx_ + 12, cy + 40, "E", 14, "start", "bold", "#223")
    return (cx_, cy - 40), (cx_, cy + 40)

def gnd(x, y):
    line(x, y, x, y + 14)
    for i, hw in enumerate((18, 11, 4)):
        line(x - hw, y + 14 + i*6, x + hw, y + 14 + i*6, 2.5)

def hop_v(x, y, color, w=2.5):   # vertical wire jumping over a horizontal one at (x, y): not connected
    add(f'<path d="M{x},{y-12} A12,12 0 0 1 {x},{y+12}" fill="none" stroke="#fff" stroke-width="7"/>')
    add(f'<path d="M{x},{y-12} A12,12 0 0 1 {x},{y+12}" fill="none" stroke="{color}" stroke-width="{w}"/>')

def dashed_box(x, y, w, h):
    add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="none" stroke="#7b8794" stroke-width="1.5" stroke-dasharray="6 5"/>')

def SUB(a, b, c):                # text with a subscript, e.g. I_B
    return f'{a}<tspan font-size="11" dy="4">{b}</tspan><tspan dy="-4">{c}</tspan>'

def to92(ix, iy, title, pins):   # TO-92 pinout inset, flat face towards the viewer
    text(ix + 40, iy - 6, title, 14, "middle", "bold", "#112")
    iy += 26
    add(f'<path d="M{ix},{iy+70} L{ix},{iy+30} A40,40 0 0 1 {ix+80},{iy+30} L{ix+80},{iy+70} Z" fill="#333" stroke="#000" stroke-width="1.5"/>')
    text(ix + 40, iy + 56, "плаский бік", 11, "middle", "normal", "#ddd")
    for i, l in enumerate(pins):
        lx = ix + 16 + i*24
        line(lx, iy + 70, lx, iy + 112, 3, "#9e9e9e")
        text(lx, iy + 130, l, 15, "middle", "bold", "#223")
    text(ix + 40, iy + 148, "звірте з даташитом", 12, "middle", "normal", "#7f1d1d")

def mb102(x, y, w, h, y5, yg):   # power module box with +5 V and GND on its left edge
    box(x, y, w, h, "#fff4f2", "#7f1d1d")
    tx = x + 22
    text(tx, y + 120, "MB-102", 20, "start", "bold", "#223")
    text(tx, y + 142, "модуль живлення", 15, "start", "normal", "#445")
    text(tx, y + 176, "перемичка цієї", 14, "start", "normal", "#52606d")
    text(tx, y + 196, "сторони: 5V,", 14, "start", "bold", "#52606d")
    text(tx, y + 216, "іншої — OFF", 14, "start", "bold", "#52606d")
    text(tx, y + 250, "кнопка: ON", 14, "start", "normal", "#52606d")
    pin_l(x, y5, "+5 В"); pin_l(x, yg, "GND (−)")

def esp32(x, y, w, h):
    box(x, y, w, h, "#eef2f7", "#334")
    text(x + 20, y + 36, "ESP32-S3", 20, "start", "bold", "#223")
    text(x + 20, y + 58, "YD-ESP32-S3 / DevKitC-1", 15, "start", "normal", "#445")
    text(x + 20, y + 92, "живлення: USB-C «USB» від ПК", 14, "start", "normal", "#52606d")
    text(x + 20, y + 114, "логіка 3,3 В", 14, "start", "normal", "#52606d")

def begin(w, h, title):
    out.clear()
    add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">')
    add(f'<rect width="{w}" height="{h}" fill="#ffffff"/>')
    text(40, 46, title, 20, "start", "bold", "#112")

def save(name):
    add('</svg>')
    open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', name), 'w').write("\n".join(out))

def notes(y, lines):             # (dy, text, size, weight, color)
    for dy, s, size, weight, fill in lines:
        text(40, y + dy, s, size, "start", weight, fill)




# =====================================================================================================
# ДЗ 1: relay
# =====================================================================================================
def relay():
    W, H = 1400, 900
    begin(W, H, "ДЗ 1: час спрацювання реле — GPIO2 → BC547B → модуль реле, контакт NO → GPIO5 (INPUT_PULLUP)")
    Y5V, YVCC, YIN, YB, YG, YNO = 120, 215, 275, 340, 470, 580

    # ---------------- ESP32 ----------------
    bx, by, bw, bh = 40, 90, 280, 540
    esp32(bx, by, bw, bh)
    for i, c in enumerate(("pinMode(5, INPUT_PULLUP);", "attachInterrupt(5, onContact, CHANGE);",
                           "t0 = micros(); digitalWrite(2, HIGH);", "ISR: firstEdge = micros();")):
        mono(bx + 14, 245 + i*18, c)
    text(bx + 14, 245 + 4*18 + 8, "час = firstEdge − t0", 13, "start", "bold", "#52606d")
    PX = bx + bw
    pin_r(PX, YB, "GPIO2"); pin_r(PX, YG, "GND"); pin_r(PX, YNO, "GPIO5", above=True)
    sx = PX + 36
    # internal pull-up of GPIO5
    PUX = 200
    dashed_box(bx + 70, YNO - 90, 140, 112)
    text(bx + 78, YNO - 74, "INPUT_PULLUP", 11, "start", "bold", "#52606d")
    text(PUX, YNO - 56, "3,3 В", 12, "middle", "bold", C_33)
    line(PUX, YNO - 50, PUX, YNO - 44, 2, C_33)
    res_v(PUX, YNO - 44, "", "", 34); text(PUX - 16, YNO - 22, "≈45 кОм", 12, "end", "normal", "#52606d")
    line(PUX, YNO - 10, PUX, YNO); line(PUX, YNO, PX - 6, YNO); dot(PUX, YNO)

    # ---------------- level shifter: GPIO2 → R1 → VT1, R2 to +5 V ----------------
    QX = 580
    (cxq, cyq), (exq, eyq) = npn(QX, YB)
    line(sx, YB, 410, YB, 2.5, C_IB); res_h(410, YB, "R1", "10 кОм"); line(490, YB, QX, YB, 2.5, C_IB)
    text(372, YB + 40, SUB("I", "B", " ≈ (3,3 − 0,7) / 10 кОм"), 14, "start", "bold", C_IB)
    text(372, YB + 60, "≈ 0,26 мА", 14, "start", "bold", C_IB)
    text(cxq + 40, YB - 2, "VT1  BC547B", 16, "start", "bold", "#112")
    text(cxq + 40, YB + 20, "NPN: 3,3 В → 5 В", 14, "start", "normal", "#445")
    line(cxq, Y5V, cxq, 150, 2.5, C_5V); res_v(cxq, 150, "R2", "10 кОм"); line(cxq, 210, cxq, cyq)
    dot(cxq, YIN)
    line(exq, eyq, exq, YG, 2.5); dot(exq, YG, C_GND)

    # ---------------- relay module ----------------
    mx, my, mw, mh = 860, 150, 260, 260
    add(f'<rect x="{mx}" y="{my}" width="{mw}" height="{mh}" rx="14" fill="#eaf4ff" stroke="#1e4f8a" stroke-width="2.5"/>')
    text(mx + 20, my + 26, "Модуль реле 5 В", 16, "start", "bold", "#112")
    text(mx + 20, my + 46, "активний рівень IN — LOW", 13, "start", "normal", "#445")
    pin_l(mx, YVCC, "VCC"); pin_l(mx, YIN, "IN")
    # coil K1 and the contact group it moves
    kx, ky = 1000, 215
    add(f'<rect x="{kx}" y="{ky}" width="70" height="34" fill="#fff" stroke="{WIRE}" stroke-width="2"/>')
    line(kx, ky + 34, kx + 70, ky, 1.5)
    text(kx + 76, ky + 22, "K1", 14, "start", "bold", "#223")
    text(mx + 46, 306, "PNP + діод", 12, "start", "normal", "#52606d")
    text(mx + 46, 322, "на платі модуля", 12, "start", "normal", "#52606d")
    GX, NOX, COMX, NCX, YT = 890, 950, 1020, 1090, my + mh
    for x in (NOX, NCX):
        line(x, YT - 6, x, 364); add(f'<circle cx="{x}" cy="360" r="4" fill="#fff" stroke="{WIRE}" stroke-width="2"/>')
    line(COMX, YT - 6, COMX, 386); dot(COMX, 386)
    line(COMX, 386, NCX - 6, 362, 3)                                          # at rest: COM–NC
    line(kx + 35, ky + 34, (COMX + NCX)/2, 372, 1.5, "#7b8794", "4 4")        # mechanical link coil → lever
    text(mx + 46, 340, "спокій: COM–NC", 12, "start", "normal", "#52606d")
    pin_b(GX, YT, "GND"); pin_b(NOX, YT, "NO"); pin_b(COMX, YT, "COM"); pin_b(NCX, YT, "NC")
    text(NCX + 9, YT + 40, "вільний", 12, "start", "normal", "#52606d")

    # wires to the module
    line(cxq, YIN, mx - 36, YIN, 2.5, C_SIG)
    text(cxq + 40, YIN + 22, "HIGH: IN ≈ 0 В → реле ON", 13, "start", "bold", C_SIG)
    poly([(mx - 36, YVCC), (mx - 64, YVCC), (mx - 64, Y5V)], C_5V, 2.5); dot(mx - 64, Y5V, C_5V)
    line(GX, YT + 30, GX, YG, 2.5, C_GND); dot(GX, YG, C_GND)
    line(COMX, YT + 30, COMX, YG, 2.5, C_GND); dot(COMX, YG, C_GND)
    # NO → GPIO5, hopping over the ground line
    line(NOX, YT + 30, NOX, YG - 12, 2.5, C_SIG); hop_v(NOX, YG, C_SIG); line(NOX, YG + 12, NOX, YNO, 2.5, C_SIG)
    line(sx, YNO, NOX, YNO, 2.5, C_SIG)
    text(sx + 16, YNO - 10, "NO → GPIO5: розімкнений = HIGH, замкнений на COM = LOW", 13, "start", "bold", C_SIG)
    text(NOX - 16, YG + 34, "місток: дроти не з'єднані", 12, "end", "normal", "#52606d")

    # ---------------- MB-102, +5 V and common ground ----------------
    mb102(1210, 90, 170, 420, Y5V, YG)
    line(cxq, Y5V, 1210 - 36, Y5V, 2.5, C_5V)
    text(cxq + 14, Y5V - 10, "+5 В (шина «+» макетки)", 14, "start", "bold", C_5V)
    line(sx, YG, 1210 - 36, YG, 4, C_GND)
    dot(sx + 40, YG, C_GND); gnd(sx + 40, YG)
    text(sx + 70, YG - 12, "СПІЛЬНА ЗЕМЛЯ", 14, "start", "bold", C_GND)

    ny = 680
    to92(1250, ny, "BC547B, TO-92", "CBE")
    notes(ny, [
        (0,   "Як це працює", 16, "bold", "#112"),
        (26,  "1.  GPIO2 = HIGH → VT1 відкритий → IN притягнутий до 0 В → котушка під струмом → COM перескакує з NC на NO. HIGH = реле ON.", 14, "normal", "#223"),
        (48,  "2.  NO замикається на COM = GND → GPIO5 падає в LOW. Переривання CHANGE ловить кожен фронт; час — від t0 до ПЕРШОГО фронту.", 14, "normal", "#223"),
        (70,  "3.  Через контакт тече лише ≈ 73 мкА (3,3 В / 45 кОм). Котушку (≈ 71 мА) живить транзистор модуля від MB-102, а не пін ESP32.", 14, "normal", "#223"),
        (92,  "4.  Логічний аналізатор (необов'язково): CH1 → GPIO2, CH2 → GPIO5, GND → GND — перевірка micros() незалежним приладом.", 14, "normal", "#223"),
        (128, "Перевірка перед увімкненням (перемикати лише при вимкненому живленні)", 16, "bold", "#112"),
        (152, "• З клем реле знято все від «Сутінкового перемикача»: ні +5 В на COM, ні LED на NO. 5 В на GPIO5 — зіпсований пін.", 14, "bold", "#7f1d1d"),
        (174, "• R2 — до +5 В (не до 3V3), інакше реле не вимкнеться.   • +5 В MB-102 не йде на 5V / VIN / піни ESP32.", 14, "bold", "#7f1d1d"),
        (196, "• GND ESP32, «−» MB-102 і GND модуля — спільні.   • BC547B: C-B-E пласким боком до себе (у 2N2222 навпаки, E-B-C).", 14, "bold", "#7f1d1d"),
    ])
    save("schematic-relay.svg")


# =====================================================================================================
# ДЗ 2: software PWM for the motor (the UART experiment uses the same circuit, GPIO6 = TX of UART1)
# =====================================================================================================
def motor():
    W, H = 1400, 900
    begin(W, H, "ДЗ 2: програмний ШІМ — потенціометр → GPIO4 (АЦП), GPIO6 → 2N2222 → мотор TT (5 В від MB-102)")
    Y5V, Y33, YPOT, YB, YG = 120, 160, 250, 440, 580

    # ---------------- ESP32 ----------------
    bx, by, bw, bh = 40, 90, 280, 540
    esp32(bx, by, bw, bh)
    for i, c in enumerate(("raw = analogRead(4);", "high = raw * 1000 / 4095;", "digitalWrite(6, HIGH);",
                           "delayMicroseconds(high);", "digitalWrite(6, LOW);", "delayMicroseconds(1000 - high);")):
        mono(bx + 14, 300 + i*17, c)
    text(bx + 14, 300 + 6*17 + 6, "період 1000 мкс = 1 кГц", 13, "start", "bold", "#52606d")
    text(bx + 14, 502, "експеримент uart-pwm:", 13, "start", "bold", "#52606d")
    mono(bx + 14, 522, "Serial1.begin(9600, SERIAL_8N1, -1, 6);")
    mono(bx + 14, 539, "// TX UART1 → GPIO6, той самий ключ")
    PX = bx + bw
    pin_r(PX, Y33, "3V3"); pin_r(PX, YPOT, "GPIO4"); pin_r(PX, YB, "GPIO6"); pin_r(PX, YG, "GND")
    sx = PX + 36

    # ---------------- potentiometer: 3V3 — RP1 — GND, wiper → GPIO4 ----------------
    PTX = 540
    poly([(sx, Y33), (PTX, Y33), (PTX, 190)], C_33, 2.5)
    add(f'<rect x="{PTX-11}" y="190" width="22" height="120" fill="#fff6d5" stroke="{WIRE}" stroke-width="2"/>')
    arrow(sx + 4, YPOT, PTX - 13, YPOT, C_SIG, 2.5)                          # wiper
    line(PTX, 310, PTX, 330); gnd(PTX, 330)
    text(sx + 14, YPOT - 10, "0…3,1 В → 0…4095", 13, "start", "bold", C_SIG)
    text(PTX + 24, 220, "RP1  10 кОм", 15, "start", "bold")
    text(PTX + 24, 242, "1 — 3V3, 3 — GND,", 13, "start", "normal", "#52606d")
    text(PTX + 24, 260, "2 (повзунок) → GPIO4", 13, "start", "normal", "#52606d")
    text(PTX + 24, 290, "лише від 3V3!", 13, "start", "bold", "#7f1d1d")

    # ---------------- key: GPIO6 → R1 220 Ω → VT1 2N2222 ----------------
    QX = 820
    (cxq, cyq), (exq, eyq) = npn(QX, YB)
    line(sx, YB, 560, YB, 2.5, C_IB); res_h(560, YB, "R1", "220 Ом"); line(640, YB, QX, YB, 2.5, C_IB)
    text(372, YB + 40, SUB("I", "B", " ≈ (3,3 − 0,9) / 220 ≈ 11 мА"), 14, "start", "bold", C_IB)
    text(cxq + 40, YB + 4, "VT1  2N2222", 16, "start", "bold", "#112")
    text(cxq + 40, YB + 26, "NPN, ключ «на землі»", 14, "start", "normal", "#445")
    line(exq, eyq, exq, YG, 2.5); dot(exq, YG, C_GND)

    # ---------------- motor M1 with C1 and D1 in parallel ----------------
    MT, MB = 150, 330                                # top and bottom nodes of the motor
    line(cxq, Y5V, cxq, MT, 2.5, C_5V); dot(cxq, MT)
    line(cxq, MT, cxq, 206); line(cxq, 274, cxq, MB); dot(cxq, MB); line(cxq, MB, cxq, cyq)
    add(f'<circle cx="{cxq}" cy="240" r="34" fill="#f4f7fb" stroke="{WIRE}" stroke-width="2.5"/>')
    text(cxq, 249, "M", 24, "middle", "bold", "#223")
    text(cxq - 48, 236, "M1", 15, "end", "bold"); text(cxq - 48, 256, "мотор TT", 13, "end", "normal", "#52606d")
    CX = cxq + 60                                    # C1 100 nF right on the motor terminals
    line(CX, MT, CX, 230); line(CX, 250, CX, MB)
    line(CX - 14, 230, CX + 14, 230, 3); line(CX - 14, 250, CX + 14, 250, 3)
    dot(CX, MT); dot(CX, MB)
    text(CX, MB + 22, "C1 100 нФ", 13, "middle", "bold")
    DX = cxq + 120                                   # D1: anode at the collector node, cathode (stripe) at +5 V
    poly([(cxq, MT), (DX, MT), (DX, 214)]); poly([(DX, 266), (DX, MB), (CX, MB)])
    add(f'<polygon points="{DX-17},266 {DX+17},266 {DX},234" fill="#cfd8dc" stroke="{WIRE}" stroke-width="2"/>')
    line(DX - 17, 232, DX + 17, 232, 3); line(DX, 214, DX, 232)
    text(DX + 26, 236, "D1  1N4007", 15, "start", "bold")
    text(DX + 26, 256, "смужка (K) → +5 В", 13, "start", "normal", "#52606d")
    text(cxq + 40, 380, SUB("I", "M", " ≈ 70–150 мА на ходу,"), 14, "start", "bold", C_IC)
    text(cxq + 40, 400, "сотні мА на старті", 14, "start", "bold", C_IC)

    # ---------------- C2 100 µF on the 5 V rail, MB-102, common ground ----------------
    C2X = 1160
    line(C2X, Y5V, C2X, 480, 2.5, C_5V); dot(C2X, Y5V, C_5V)
    add(f'<rect x="{C2X-16}" y="480" width="32" height="6" fill="{C_5V}"/>')
    add(f'<rect x="{C2X-16}" y="496" width="32" height="6" fill="#455a64"/>')
    text(C2X - 22, 486, "+", 15, "end", "bold", C_5V)
    line(C2X, 502, C2X, YG, 2.5); dot(C2X, YG, C_GND)
    text(C2X - 40, 488, "C2 100 мкФ", 13, "end", "bold"); text(C2X - 40, 506, "буфер 5 В", 12, "end", "normal", "#52606d")
    mb102(1210, 90, 170, 540, Y5V, YG)
    line(cxq, Y5V, 1210 - 36, Y5V, 2.5, C_5V)
    text(cxq + 14, Y5V - 10, "+5 В (шина «+» макетки)", 14, "start", "bold", C_5V)
    line(sx, YG, 1210 - 36, YG, 4, C_GND)
    dot(sx + 40, YG, C_GND); gnd(sx + 40, YG)
    text(sx + 70, YG - 12, "СПІЛЬНА ЗЕМЛЯ: GND ESP32 = «−» MB-102", 14, "start", "bold", C_GND)
    text(sx + 70, YG + 26, "логічний аналізатор: CH1 → GPIO6, GND → GND", 13, "start", "normal", "#52606d")

    ny = 680
    to92(1250, ny, "2N2222, TO-92", "EBC")
    notes(ny, [
        (0,   "Як це працює", 16, "bold", "#112"),
        (26,  "1.  Повзунок дає 0…3,1 В → analogRead() = 0…4095 → tHIGH = raw · 1000 / 4095 мкс, tLOW = 1000 − tHIGH. Частка HIGH = швидкість.", 14, "normal", "#223"),
        (48,  "2.  HIGH: ≈ 11 мА бази відкривають VT1, струм іде +5 В → M1 → C → E → GND. LOW: VT1 закритий, струм обмотки мотора йде через D1.", 14, "normal", "#223"),
        (70,  "3.  Експеримент uart-pwm: та сама схема, GPIO6 — TX UART1. Кадр 8N1 сам задає частку HIGH: 0x00 → 10 %, 0x0F і 0x55 → 50 %, 0xFF → 90 %.", 14, "normal", "#223"),
        (106, "Перевірка перед увімкненням (перемикати лише при вимкненому живленні)", 16, "bold", "#112"),
        (130, "• D1 смужкою до +5 В — навпаки він закоротить MB-102.   • Мотор — тільки від MB-102, не від 5V / 3V3 / пінів ESP32.", 14, "bold", "#7f1d1d"),
        (152, "• Вал рукою не тримати: загальмований мотор бере сотні мА, 2N2222 виходить з насичення й гріється.   • Спільна GND.", 14, "bold", "#7f1d1d"),
        (174, "• Краще для мотора: логічний MOSFET AO3400A (220 Ом на затвор, 100 кОм затвор → GND) і швидкий діод 1N5819, якщо є.", 14, "normal", "#52606d"),
    ])
    save("schematic-motor.svg")


relay()
motor()
print("ok")
