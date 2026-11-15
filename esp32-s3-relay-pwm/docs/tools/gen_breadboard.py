# Generates ../breadboard-relay.svg and ../breadboard-motor.svg — the same circuits as the schematics
# on a full-size breadboard: YD-ESP32-S3 on the left (headers in i/b), MB-102 on the right end.
#   relay: key in the top half (top rails = 5 V), relay module above the board;
#   motor: pot in the top half, key in the bottom half (bottom rails = 5 V), TT motor below the board.
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..',
                                'esp32-s3-bounce-test', 'docs', 'tools'))
from yd_board import Svg, breadboard, esp32, rx, j1_row, j3_row, COL, RAIL

BLK, RED, GRN, ORG, PUR, BLU, TEAL = "#222", "#d32f2f", "#2e7d32", "#ef6c00", "#6a1b9a", "#1565c0", "#00897b"
HERE = os.path.dirname(os.path.abspath(__file__))


def mb102(s, top, bottom):
    """MB-102 on the right end, plugged into both rail pairs; top/bottom — jumper position ("5V"/"OFF")."""
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
    jumper(150, top, "верх: " + ("5 В" if top == "5V" else top))
    jumper(338, bottom, "низ: " + ("5 В" if bottom == "5V" else bottom))


def resistor_v(s, r, y1, y2, bands, label, side="end"):
    x = rx(r)
    s.line(x, y1, x, y1 + 10, 2, "#888"); s.line(x, y2 - 10, x, y2, 2, "#888")
    s.rect(x - 7, y1 + 10, 14, y2 - y1 - 20, "#e9dcb8", "#7a6a4a", 1.2, 3)
    for i, c in enumerate(bands): s.rect(x - 7, y1 + 14 + i * 7, 14, 3.5, c)
    for y in (y1, y2): s.add(f'<circle cx="{x}" cy="{y}" r="2.5" fill="#bbb"/>')
    if label: s.text(x - 12 if side == "end" else x + 12, (y1 + y2) / 2 + 4, label, 11, side, "bold", "#333")


def standing_resistor(s, r, y1, y2, bands):
    """Short resistor standing upright between two holes of one column (e.g. j-hole → rail)."""
    x = rx(r)
    s.line(x, y1, x, y2, 2, "#888")
    s.rect(x - 6, y1 + 6, 12, y2 - y1 - 12, "#e9dcb8", "#7a6a4a", 1.2, 3)
    for i, c in enumerate(bands): s.rect(x - 6, y1 + 9 + i * 6, 12, 3, c)
    for y in (y1, y2): s.add(f'<circle cx="{x}" cy="{y}" r="2.5" fill="#bbb"/>')


def to92(s, rows, y, letters, name, up=True, R=26):
    """TO-92, flat face towards the viewer (bottom of the picture); legs in `rows` at height y."""
    for r in rows: s.add(f'<circle cx="{rx(r)}" cy="{y}" r="3" fill="#bbb" stroke="#555"/>')
    xc = rx(rows[1])
    s.add(f'<path d="M{xc - R},{y - 8} A{R},{R} 0 0 1 {xc + R},{y - 8} Z" fill="#333" stroke="#000" stroke-width="1"/>')
    for r in rows: s.line(rx(r), y - 8, rx(r), y, 2, "#9e9e9e")
    for r, l in zip(rows, letters): s.text(rx(r), y - 12, l, 9, "middle", "bold", "#fff")
    s.text(xc, y - 23, name, 7, "middle", "bold", "#ddd")



# Wires run only vertically and horizontally. Horizontal runs lie halfway between hole lines,
# so they never cover a hole they don't plug into.
Y_TOP2, Y_TOP1 = 14, 38                                    # above the board (two levels, 24 px apart)
Y_TP_J = (117 + COL['j']) / 2                              # between the red «+» line and line j
Y_J_I = (COL['j'] + COL['i']) / 2                          # between lines j and i
Y_A_BP = (COL['a'] + 373) / 2                              # between line a and the red «+» line
Y_LOW = (416 + 432) / 2                                    # between the blue «−» line and the board edge


def route(s, pts, c, r=8):
    """Orthogonal wire through pts with rounded corners; end points get a plug circle."""
    d = f"M{pts[0][0]},{pts[0][1]}"
    for (x0, y0), (x1, y1), (x2, y2) in zip(pts, pts[1:], pts[2:]):
        ax = x1 - r * (x1 > x0) + r * (x1 < x0); ay = y1 - r * (y1 > y0) + r * (y1 < y0)
        bx = x1 + r * (x2 > x1) - r * (x2 < x1); by = y1 + r * (y2 > y1) - r * (y2 < y1)
        d += f" L{ax},{ay} Q{x1},{y1} {bx},{by}"
    d += f" L{pts[-1][0]},{pts[-1][1]}"
    s.add(f'<path d="{d}" fill="none" stroke="{c}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>')
    for x, y in (pts[0], pts[-1]):
        s.add(f'<circle cx="{x}" cy="{y}" r="3.2" fill="#ddd" stroke="{c}" stroke-width="1.5"/>')


def straight(s, r, y1, y2, c):
    route(s, [(rx(r), y1), (rx(r), y2)], c)


def notes(s, y0, lines, extra):
    """Numbered steps 24 px apart, then the `extra` lines after a 12 px gap."""
    for i, (t, weight, fill) in enumerate(lines):
        s.text(20, y0 + i * 24, t, 13, "start", weight, fill)
    y = y0 + len(lines) * 24 + 12
    for i, t in enumerate(extra):
        s.text(20, y + i * 24, t, 13, "start", "normal", "#445")
    return y + len(extra) * 24 + 14


def legend(s, y, items, gap=36):
    x = 20
    for c, l in items:
        s.line(x, y, x + 28, y, 4.5, c); s.text(x + 36, y + 4, l, 12)
        x += 36 + round(len(l) * 7.2) + gap                # equal gaps between the entries


def save(s, name):
    s.add('</svg>')
    open(os.path.join(HERE, '..', name), 'w').write("\n".join(s.out))


def common_ground(s):
    # G of the bottom header (pin 21 of J3 = b2) → a2 → along the board edge → «−» of the bottom rail, row 32
    # (right of the split). The left half of the rails is not powered, so crossing it at row 2 is harmless.
    g = 2
    route(s, [(rx(g), COL['a']), (rx(g), Y_LOW), (rx(32), Y_LOW), (rx(32), RAIL['bn'])], BLK)
    s.text(rx(g) + 6, COL['a'] + 16, "G", 10, "start", "bold", BLK)


# =====================================================================================================
# ДЗ 1: relay
# =====================================================================================================
def relay():
    DY = 220                                    # the board is shifted down: the relay module sits above it
    s = Svg(1320, 1000)
    s.text(20, 34, "ДЗ 1 на макетці: GPIO2 → R1 → BC547B → IN модуля реле, контакт NO → GPIO5 (INPUT_PULLUP), COM → G", 19, "start", "bold", "#112")
    s.add(f'<g transform="translate(0,{DY})">')
    breadboard(s)
    esp32(s, 'i', 'b', used_top=("5", "G"), used_bot=("2", "G"))
    mb102(s, "5V", "OFF")
    s.text(rx(31) + 9.5, (RAIL["bp"] + RAIL["bn"]) / 2 + 3, "розрив", 9, "middle", "normal", "#b91c1c")

    # --- relay module above the board: screw terminal (NC, COM, NO; 5 mm = 2 holes) left,
    #     header (IN, GND, VCC; 2,54 mm = 1 hole) right — every pin stands exactly over a breadboard row
    MY0, MY1 = -170, -12
    s.rect(rx(3), MY0, rx(39) - rx(3), MY1 - MY0, "#1565c0", "#0d3c78", 1.5, 6)
    s.text(rx(21), MY0 + 22, "Модуль реле 5 В  ·  IN активний LOW", 13, "middle", "bold", "#fff")
    s.rect(rx(4) - 12, MY0 + 46, rx(10) - rx(4) + 24, 76, "#0277bd", "#01579b", 1.5, 3)     # screw terminal
    for r, l in ((6, "NC"), (8, "COM"), (10, "NO")):
        s.add(f'<circle cx="{rx(r)}" cy="{MY0 + 74}" r="8" fill="#cfd8dc" stroke="#455a64" stroke-width="1.5"/>')
        s.line(rx(r) - 5, MY0 + 74, rx(r) + 5, MY0 + 74, 2, "#455a64")
        s.text(rx(r), MY0 + 106, l, 9, "middle", "bold", "#fff")
    CX0, CX1 = rx(13), rx(23)                                                              # relay cube
    s.rect(CX0, MY0 + 46, CX1 - CX0, 76, "#1e88e5", "#0b3d91", 1.5, 3)
    s.text((CX0 + CX1) / 2, MY0 + 72, "SONGLE", 11, "middle", "bold", "#e3f2fd")
    s.text((CX0 + CX1) / 2, MY0 + 90, "SRD-05VDC-SL-C", 10, "middle", "bold", "#e3f2fd")
    s.text((CX0 + CX1) / 2, MY0 + 108, "K1: котушка 5 В, ≈ 71 мА", 9, "middle", "normal", "#bbdefb")
    for i, (c, l) in enumerate((("#ef5350", "живлення"), ("#66bb6a", "реле ON"))):
        s.add(f'<circle cx="{rx(26)}" cy="{MY0 + 58 + i * 22}" r="5" fill="{c}"/>')
        s.text(rx(26) + 12, MY0 + 62 + i * 22, l, 9, "start", "normal", "#e3f2fd")
    s.text(rx(26) - 5, MY0 + 106, "PNP + діод на платі", 9, "start", "normal", "#bbdefb")
    for r, l in ((33, "IN"), (34, "GND"), (35, "VCC")):
        s.rect(rx(r) - 4, MY1 - 8, 8, 8, "#d4af37", "#7a5f00", 1)
        s.text(rx(r) + 3, MY1 - 14, l, 9, "start", "bold", "#fff", f'transform="rotate(-90 {rx(r) + 3} {MY1 - 14})"')
    for r in (6, 8, 10):
        s.rect(rx(r) - 4, MY1 - 8, 8, 8, "#90a4ae", "#455a64", 1)

    # --- GPIO2 (b18) → a18 → a37 just above the rails; R1 10 kΩ across the channel e37 → f37 -------------
    g2 = j3_row("2")
    route(s, [(rx(g2), COL['a']), (rx(g2), Y_A_BP), (rx(37), Y_A_BP), (rx(37), COL['a'])], GRN)
    resistor_v(s, 37, COL['f'], COL['e'], ("#8b4513", "#000", "#ef6c00"), "R1 10 кОм")   # brown-black-orange

    # --- VT1 BC547B, flat face towards you: C g36, B g37, E g38 -----------------------------------------
    to92(s, (36, 37, 38), COL['g'], "CBE", "BC547B")
    s.text(rx(38) + 30, COL['g'] - 4, "VT1", 11, "start", "bold", "#333")
    standing_resistor(s, 36, RAIL['tp'], COL['j'], ("#8b4513", "#000", "#ef6c00"))       # R2: j36 → «+»
    s.text(rx(36) + 10, Y_TP_J + 4, "R2", 10, "start", "bold", "#333")
    straight(s, 38, COL['j'], RAIL['tn'], BLK)                                           # E → «−»

    # --- module header: IN → i36 (collector), GND → «−», VCC → «+» ---------------------------------------
    route(s, [(rx(33), MY1), (rx(33), Y_J_I), (rx(36), Y_J_I), (rx(36), COL['i'])], PUR)
    straight(s, 34, MY1, RAIL['tn'], BLK)
    straight(s, 35, MY1, RAIL['tp'], RED)

    # --- dry contact: COM → j1 (G of the top header), NO → j18 (GPIO5) -----------------------------------
    route(s, [(rx(8), MY1), (rx(8), Y_TOP2 + 10), (rx(j1_row("G")), Y_TOP2 + 10), (rx(j1_row("G")), COL['j'])], BLK)
    route(s, [(rx(10), MY1), (rx(10), Y_TOP2 + 10), (rx(j1_row("5")), Y_TOP2 + 10), (rx(j1_row("5")), COL['j'])], BLU)
    s.text(rx(1) + 8, COL['j'] - 6, "G", 10, "start", "bold", BLK)

    common_ground(s)
    s.add('</g>')

    y = notes(s, DY + 486, [
        ("0.  Збирайте й перемикайте схему лише при вимкненому живленні (USB ESP32 від'єднано, MB-102 — OFF).", "bold", "#b71c1c"),
        ("1.  MB-102 — на правий край, штирі в обидві пари шин. ВЕРХНЯ перемичка — 5V (живить модуль реле), нижня — OFF. «−» обох шин — земля MB-102.", "normal", "#222"),
        ("2.  GPIO2 (b18, гребінець J3) → a18 → зелений дріт над шинами → a37. R1 10 кОм (коричневий-чорний-помаранчевий) — ЧЕРЕЗ канал: e37 → f37.", "normal", "#222"),
        ("3.  VT1 BC547B пласким боком до себе: C — g36, B — g37 (той самий ряд, що й R1), E — g38. Емітер: j38 → шина «−». У 2N2222 порядок інший — E-B-C!", "normal", "#222"),
        ("4.  R2 10 кОм стоїть вертикально: j36 → шина «+» 5 В. Фіолетовий дріт: i36 (колектор) → IN модуля. GND модуля → «−», VCC → «+».", "normal", "#222"),
        ("5.  Сухий контакт: COM → j1 (пін G верхнього гребінця), NO → j18 (GPIO5, INPUT_PULLUP). NC — вільний. Ніяких 5 В на клемах реле!", "bold", BLU),
        ("6.  СПІЛЬНА ЗЕМЛЯ: пін G нижнього гребінця (b2) → a2 → уздовж краю → шина «−» праворуч від розриву (ряд 32). Без неї VT1 не відкриється.", "bold", GRN),
        ("7.  ESP32 живиться від USB-C «USB» комп'ютера. +5 В MB-102 НЕ подавати на 5V / VIN / піни ESP32.", "bold", "#b71c1c"),
    ], [
        "Перевірка: GPIO2 = HIGH → червоний і зелений світлодіоди модуля, клац; GPIO5 = LOW. Порядок пінів IN/GND/VCC на вашому модулі може бути іншим — читайте напис.",
        "Аналізатор (необов'язково): CH1 → c37 (ряд GPIO2, до R1), CH2 → клема NO модуля (провід GPIO5), GND → шина «−».",
    ])
    legend(s, y, ((GRN, "GPIO2 → R1"), (PUR, "колектор → IN"), (RED, "+5 В"), (BLK, "GND"), (BLU, "NO → GPIO5")))
    save(s, "breadboard-relay.svg")


# =====================================================================================================
# ДЗ 2: motor (uart-pwm uses the same wiring: GPIO6 = TX of UART1)
# =====================================================================================================
def motor():
    DY = 60
    s = Svg(1320, 910)
    s.text(20, 34, "ДЗ 2 на макетці: потенціометр → GPIO4, GPIO6 → R1 220 Ом → 2N2222 → мотор TT (5 В від MB-102)", 19, "start", "bold", "#112")
    s.add(f'<g transform="translate(0,{DY})">')
    breadboard(s)
    esp32(s, 'i', 'b', used_top=("3V3", "4", "6"), used_bot=("G",))
    mb102(s, "OFF", "5V")
    s.text(rx(31) + 9.5, (RAIL["bp"] + RAIL["bn"]) / 2 + 3, "розрив", 9, "middle", "normal", "#b91c1c")

    # --- RP1 10 kΩ: legs f26 (1 → 3V3), f28 (2, wiper → GPIO4), f30 (3 → GND) ------------------------
    for r in (26, 28, 30): s.add(f'<circle cx="{rx(r)}" cy="{COL["f"]}" r="3" fill="#bbb" stroke="#555"/>')
    s.rect(rx(26) - 14, COL['i'] - 8, rx(30) - rx(26) + 28, COL['f'] - COL['i'], "#1565c0", "#0d3c78", 1.5, 4)
    s.add(f'<circle cx="{rx(28)}" cy="{COL["h"] - 2}" r="15" fill="#eceff1" stroke="#90a4ae" stroke-width="1.5"/>')
    s.line(rx(28), COL['h'] - 2, rx(28) + 8, COL['h'] - 12, 3, "#455a64")
    for r, l in ((26, "1"), (28, "2"), (30, "3")): s.text(rx(r), COL['f'] - 12, l, 9, "middle", "bold", "#fff")
    s.text(rx(30) + 22, COL['h'], "RP1", 11, "start", "bold", "#333")
    s.text(rx(30) + 22, COL['h'] + 14, "10 кОм", 10, "start", "normal", "#333")
    # three nested brackets: 3V3 (j22 → j26), GPIO4 (j19 → j28), GPIO6 (j17 → j37)
    route(s, [(rx(j1_row("3V3")), COL['j']), (rx(j1_row("3V3")), Y_TP_J), (rx(26), Y_TP_J), (rx(26), COL['j'])], ORG)
    route(s, [(rx(j1_row("4")), COL['j']), (rx(j1_row("4")), Y_TOP1), (rx(28), Y_TOP1), (rx(28), COL['j'])], PUR)
    route(s, [(rx(j1_row("6")), COL['j']), (rx(j1_row("6")), Y_TOP2), (rx(37), Y_TOP2), (rx(37), COL['j'])], GRN)
    straight(s, 30, COL['j'], RAIL['tn'], BLK)                                          # pin 3 → «−» (top)

    # --- R1 220 Ω across the channel f37 → e37 → base ---------------------------------------------------
    resistor_v(s, 37, COL['f'], COL['e'], ("#d00", "#d00", "#8b4513"), "R1 220 Ом")          # red-red-brown

    # --- VT1 2N2222, flat face towards you: E c36, B c37, C c38 ------------------------------------------
    to92(s, (36, 37, 38), COL['c'], "EBC", "2N2222", R=27)
    s.text(rx(36) - 32, COL['c'] - 12, "VT1", 11, "end", "bold", "#333")
    straight(s, 36, COL['a'], RAIL['bn'], BLK)                                          # E → «−»

    # --- D1 1N4007: anode b38 (collector), cathode b42 (stripe) → a42 → «+» ---------------------------
    y = COL['b']
    s.line(rx(38), y, rx(42), y, 2, "#888")
    s.rect(rx(38) + 14, y - 7, rx(42) - rx(38) - 28, 14, "#222", "#000", 1, 3)
    s.rect(rx(42) - 24, y - 7, 5, 14, "#cfd8dc")
    for r in (38, 42): s.add(f'<circle cx="{rx(r)}" cy="{y}" r="2.5" fill="#bbb"/>')
    s.text(rx(42) + 10, y + 4, "D1 1N4007", 10, "start", "bold", "#333")
    straight(s, 42, COL['a'], RAIL['bp'], RED)

    # --- C2 100 µF across the 5 V rails (row 50): «+» long leg in bp, stripe «−» in bn -------------------
    cx, cy = rx(50) + 16, (RAIL['bp'] + RAIL['bn']) / 2
    for yy in (RAIL['bp'], RAIL['bn']):
        s.line(rx(50), yy, cx - 8, yy, 2, "#9e9e9e"); s.add(f'<circle cx="{rx(50)}" cy="{yy}" r="2.5" fill="#bbb"/>')
    s.add(f'<circle cx="{cx}" cy="{cy}" r="15" fill="#1a237e" stroke="#000" stroke-width="1"/>')
    s.add(f'<path d="M{cx - 11},{cy + 10} A15,15 0 0 0 {cx + 11},{cy + 10}" fill="none" stroke="#cfd8dc" stroke-width="4"/>')
    s.text(cx, cy + 30, "C2 100 мкФ", 10, "middle", "bold", "#333")

    # --- TT motor below the board, tabs right under rows 38 (−) and 44 (+), C1 100 nF across them -------
    tm, tp = rx(38), rx(44)
    MX, MYt = tm - 38, 492
    s.rect(MX, MYt, 250, 70, "#fdd835", "#f9a825", 1.5, 6)
    s.text(MX + 125, MYt + 32, "мотор TT (редуктор)", 12, "middle", "bold", "#5d4037")
    s.text(MX + 125, MYt + 50, "M1, 3–6 В", 10, "middle", "normal", "#5d4037")
    s.rect(MX + 250, MYt + 20, 40, 30, "#fff176", "#f9a825", 1.5, 3)                       # shaft side
    for x, l in ((tm, "−"), (tp, "+")):
        s.rect(x - 5, MYt - 12, 10, 14, "#bdbdbd", "#616161", 1)
        s.text(x + (-10 if l == "−" else 10), MYt - 2, l, 11, "end" if l == "−" else "start", "bold", "#333")
    s.line(tm + 5, MYt - 6, tm + 30, MYt - 6, 1.5, "#888"); s.line(tp - 5, MYt - 6, tp - 30, MYt - 6, 1.5, "#888")
    s.add(f'<ellipse cx="{(tm + tp) / 2}" cy="{MYt - 6}" rx="22" ry="10" fill="#ff9800" stroke="#e65100" stroke-width="1"/>')
    s.text((tm + tp) / 2, MYt - 2, "104", 9, "middle", "bold", "#3e2723")
    s.text((tm + tp) / 2, MYt - 22, "C1 100 нФ", 10, "middle", "bold", "#333")
    straight(s, 38, MYt - 12, COL['a'], TEAL)                                           # − → a38 (collector)
    straight(s, 44, MYt - 12, RAIL['bp'], RED)                                          # + → «+» row 44

    common_ground(s)
    s.add('</g>')

    y = notes(s, DY + 586, [
        ("0.  Збирайте й перемикайте схему лише при вимкненому живленні (USB ESP32 від'єднано, MB-102 — OFF).", "bold", "#b71c1c"),
        ("1.  MB-102 — на правий край. НИЖНЯ перемичка — 5V (мотор), верхня — OFF: верхня шина «+» мертва, «−» — земля MB-102 (для RP1).", "normal", "#222"),
        ("2.  RP1 у f26 / f28 / f30: вивід 1 ← 3V3 (j22, помаранчевий), повзунок 2 → GPIO4 (j19, фіолетовий), вивід 3 → j30 → шина «−». Лише 3V3, не 5 В!", "normal", "#222"),
        ("3.  GPIO6 (j17) → зелений дріт → j37. R1 220 Ом (червоний-червоний-коричневий) — через канал: f37 → e37.", "normal", "#222"),
        ("4.  VT1 2N2222 пласким боком до себе: E — c36, B — c37, C — c38. Емітер: a36 → шина «−». У BC547B порядок інший — C-B-E!", "normal", "#222"),
        ("5.  D1 1N4007: анод b38 (колектор), СМУЖКА (катод) b42 → a42 → «+». Мотор: «−» → a38, «+» → шина «+». C1 100 нФ — просто на клемах мотора.", "bold", "#b71c1c"),
        ("6.  C2 100 мкФ на шинах 5 В (ряд 50): довга ніжка — «+», смужка на корпусі — «−». СПІЛЬНА ЗЕМЛЯ: G (b2) → a2 → «−» (ряд 32).", "bold", GRN),
    ], [
        "Експеримент uart-pwm — та сама схема: TX UART1 виведено на GPIO6. Аналізатор: CH1 → h37 (ряд GPIO6), GND → шина «−».",
        "Вал не тримати рукою: загальмований мотор бере сотні мА. Мотор не крутиться — спільна земля, E-B-C транзистора, перемичка 5V на MB-102.",
    ])
    legend(s, y, ((ORG, "3V3 → RP1"), (PUR, "повзунок → GPIO4"), (GRN, "GPIO6 → R1"),
                  (RED, "+5 В від MB-102"), (TEAL, "мотор «−» → колектор"), (BLK, "GND")))
    save(s, "breadboard-motor.svg")


relay()
motor()
print("ok")
