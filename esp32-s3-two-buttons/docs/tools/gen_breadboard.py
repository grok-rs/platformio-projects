# Generates docs/breadboard.svg — physical layout on a full-size (830-pt) breadboard
from yd_board import Svg, breadboard, esp32, resistor, led, rx, j1_row, j3_row, COL, RAIL, BANDS_220

s = Svg(1320, 700)
s.text(20, 34, "Макетна плата: YD-ESP32-S3 + 2 світлодіоди + кнопка S1 (BOOT — на самій платі)", 19, "start", "bold", "#112")
breadboard(s)
s.text(rx(31)+9, 131, "розрив шини", 9, "middle", "normal", "#b91c1c")
# Headers in i/b instead of the usual h/a: one free hole stays on each side (j and a),
# so the bottom header (GPIO21) is reachable too.
esp32(s, 'i', 'b', used_top=("15", "16", "G"), used_bot=("21",), highlight_boot=True)

def button(r1, r2):
    # 6x6 tactile switch straddling the center channel, legs in f/e of rows r1 and r2
    x1, x2 = rx(r1), rx(r2)
    for x in (x1, x2):
        for y in (COL['f'], COL['e']): s.add(f'<circle cx="{x}" cy="{y}" r="3.5" fill="#bbb" stroke="#555" stroke-width="1"/>')
    s.rect(x1-9, COL['f']+6, x2-x1+18, COL['e']-COL['f']-12, "#2b2b2b", "#000", 1, 3)
    s.add(f'<circle cx="{(x1+x2)/2}" cy="{(COL["f"]+COL["e"])/2}" r="10" fill="#555" stroke="#111" stroke-width="1.5"/>')
    s.text((x1+x2)/2, COL['e']+28, "S1", 11, "middle", "bold", "#333")

RED, BLK = "#d32f2f", "#222"
W15, W16, W21 = "#ef6c00", "#fbc02d", "#7b1fa2"
# (GPIO name, resistor start row, wire colour, labels)
circuits = [("15", 25, W15, "R1 220 Ω", "D1 ← GPIO15"),
            ("16", 34, W16, "R2 220 Ω", "D2 ← GPIO16")]
for gpio, dst, col, rl, dl in circuits:
    resistor(s, dst, dst+4, COL['i'], BANDS_220, rl)
    led(s, dst+4, COL['h'], RED, dl, "#333")
    s.wire(rx(dst+5), COL['j'], rx(dst+5), RAIL['tn'], BLK)             # cathode -> GND rail
BTN = 46
button(BTN, BTN+2)
s.wire(rx(BTN+2), COL['j'], rx(BTN+2), RAIL['tn'], BLK)                 # S1 diagonal leg -> GND rail
for gpio, dst, col, rl, dl in circuits:
    src = j1_row(gpio)
    s.wire(rx(src), COL['j'], rx(dst), COL['j'], col, bulge=40 + (dst-src)*2.2)   # GPIO -> resistor
s.wire(rx(j3_row("21")), COL['a'], rx(BTN), COL['a'], W21, bulge=-70)   # GPIO21 -> S1 (bottom half)
g = j1_row("G")
s.wire(rx(g), COL['j'], rx(g+1), RAIL['tn'], BLK)                       # ESP32 G -> rail (row 1 has no rail hole)
s.wire(rx(28), RAIL['tn'], rx(33), RAIL['tn'], BLK, bulge=30)           # bridge the split rail
s.text(rx(30.5), 48, "перемичка через розрив", 9, "middle", "normal", "#b91c1c")
s.text(rx(g+1)+8, 74-4, "G", 10, "start", "bold", "#222")

ny = 500
def note(t, dy, bold=False): s.text(20, ny+dy, t, 13, "start", "bold" if bold else "normal", "#222")
note("1.  ESP32 — через центральний канал: верхній гребінець у колонці i, нижній — у b. Так лишається по одному вільному отвору з кожного боку (j та a).", 0)
note("2.  Світлодіод: довга ніжка (+) — до резистора (і далі до GPIO), коротка ніжка (−, зріз на корпусі) — чорною перемичкою на шину «−».", 24)
note("3.  Пін G (останній на верхньому гребінці, біля USB-C; поруч 5V — не переплутати!) → шина «−». Шина розірвана посередині — перемичка 28→33.", 48)
note("4.  Кнопка S1 стоїть над центральним каналом. GPIO21 (нижній гребінець) і GND — до ДІАГОНАЛЬНИХ ніжок (a46 → e46, f48 → j48):", 72, True)
note("     так кнопка працює за будь-якої орієнтації корпусу. Резистор для кнопки не потрібен — підтяжку дає INPUT_PULLUP.", 96)
note("5.  Кнопка BOOT (GPIO0) уже розпаяна на платі — жодних проводів. Живлення та прошивка — USB-кабель у роз'єм «USB» (не «COM»).", 120)
lx, ly = 20, ny+160
for c, l, dx in ((W15, "GPIO15 → R1", 0), (W16, "GPIO16 → R2", 140), (W21, "GPIO21 → S1", 280), (BLK, "GND", 420)):
    s.line(lx+dx, ly, lx+dx+28, ly, 4.5, c); s.text(lx+dx+36, ly+4, l, 12)

s.save('breadboard.svg')
