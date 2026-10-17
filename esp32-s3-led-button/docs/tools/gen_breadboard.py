# Generates docs/breadboard.svg — physical layout on a full-size (830-pt) breadboard,
# with an 8-channel FX2 logic analyzer (Saleae Logic clone) probing the LED and the button.
from yd_board import Svg, breadboard, esp32, resistor, led, rx, j1_row, j3_row, COL, RAIL, BANDS_220

s = Svg(1320, 860)
s.text(20, 34, "Макетна плата: YD-ESP32-S3 + світлодіод + кнопка S1 + логічний аналізатор", 19, "start", "bold", "#112")
breadboard(s)
s.text(rx(31)+9, 131, "розрив шини", 9, "middle", "normal", "#b91c1c")
# Headers in i/b instead of the usual h/a: one free hole stays on each side (j and a),
# so the bottom header (GPIO21, G) is reachable too.
esp32(s, 'i', 'b', used_top=("15", "G"), used_bot=("21", "G"))

def button(r1, r2):
    # 6x6 tactile switch straddling the center channel, legs in f/e of rows r1 and r2
    x1, x2 = rx(r1), rx(r2)
    for x in (x1, x2):
        for y in (COL['f'], COL['e']): s.add(f'<circle cx="{x}" cy="{y}" r="3.5" fill="#bbb" stroke="#555" stroke-width="1"/>')
    s.rect(x1-9, COL['f']+6, x2-x1+18, COL['e']-COL['f']-12, "#2b2b2b", "#000", 1, 3)
    s.add(f'<circle cx="{(x1+x2)/2}" cy="{(COL["f"]+COL["e"])/2}" r="10" fill="#555" stroke="#111" stroke-width="1.5"/>')
    s.text((x1+x2)/2, COL['e']+28, "S1", 11, "middle", "bold", "#333")

RED, BLK = "#d32f2f", "#222"
W15, W21 = "#ef6c00", "#7b1fa2"
P_LED, P_BTN = "#00897b", "#1565c0"          # analyzer probe wires

# --- LED: GPIO15 → R1 (rows 25…29) → LED (29/30) → GND rail -------------------
R1 = 25
resistor(s, R1, R1+4, COL['i'], BANDS_220, "R1 220 Ω")
led(s, R1+4, COL['h'], RED, "D1 ← GPIO15", "#333")
s.wire(rx(R1+5), COL['j'], rx(R1+5), RAIL['tn'], BLK)                   # cathode -> GND rail
BTN = 46
button(BTN, BTN+2)
s.wire(rx(BTN+2), COL['j'], rx(BTN+2), RAIL['tn'], BLK)                 # S1 diagonal leg -> GND rail
src = j1_row("15")
s.wire(rx(src), COL['j'], rx(R1), COL['j'], W15, bulge=40 + (R1-src)*2.2)   # GPIO15 -> resistor
s.wire(rx(j3_row("21")), COL['a'], rx(BTN), COL['a'], W21, bulge=-70)   # GPIO21 -> S1 (bottom half)
g = j1_row("G")
s.wire(rx(g), COL['j'], rx(g+1), RAIL['tn'], BLK)                       # ESP32 G -> rail (row 1 has no rail hole)
s.wire(rx(28), RAIL['tn'], rx(33), RAIL['tn'], BLK, bulge=30)           # bridge the split rail
s.text(rx(30.5), 48, "перемичка через розрив", 9, "middle", "normal", "#b91c1c")
s.text(rx(g+1)+8, 74-4, "G", 10, "start", "bold", "#222")

# --- Logic analyzer -----------------------------------------------------------
# One 10-pin header: GND, CH1…CH8, CLK. PulseView calls CH1…CH8 "D0…D7".
LX0, LX1, LY = rx(19)-40, rx(56)+10, 560
s.rect(LX0, LY, LX1-LX0, 92, "#263238", "#000", 1.5, 8)
s.text(LX0+16, LY+58, "Логічний аналізатор 24 MHz 8CH", 15, "start", "bold", "#eceff1")
s.text(LX0+16, LY+80, "(клон Saleae Logic, драйвер fx2lafw у PulseView)", 11, "start", "normal", "#b0bec5")
s.rect(LX1-60, LY+38, 50, 30, "#c0c0c0", "#666", 1, 5)
s.text(LX1-35, LY+86, "USB → ПК", 10, "middle", "bold", "#eceff1")
pins = ["GND", "CH1", "CH2", "CH3", "CH4", "CH5", "CH6", "CH7", "CH8", "CLK"]
PX0, PSTEP = LX0+60, 38
px = {n: PX0 + i*PSTEP for i, n in enumerate(pins)}
used = {"CH1": P_LED, "CH2": P_BTN, "GND": BLK}
for n, x in px.items():
    s.rect(x-5, LY-5, 10, 10, "#d4af37", "#7a5f00", 1)
    hi = n in used
    s.text(x, LY+22, n, 10 if hi else 9, "middle", "bold" if hi else "normal", "#ffffff" if hi else "#90a4ae")
    if n in ("CH1", "CH2"):
        s.text(x, LY+36, "D0" if n == "CH1" else "D1", 9, "middle", "normal", "#80cbc4")

# Probe points: free holes on the same rows as the signals.
#   LED net    — row 25 (f): GPIO15 jumper + R1 already sit in j/i of this row
#   button net — row 46 (c): GPIO21 jumper in a, S1 leg in e
#   GND        — row 2 (a):  the ESP32 bottom-header G pin sits in b
s.wire(rx(R1), COL['f'], px["CH1"], LY, P_LED, bulge=-60)
s.wire(rx(BTN), COL['c'], px["CH2"], LY, P_BTN, bulge=-60)
s.wire(rx(2), COL['a'], px["GND"], LY, BLK, bulge=-80)
s.text(rx(R1)-8, COL['f']-6, "щуп CH1", 9, "end", "bold", P_LED)
s.text(rx(BTN)+8, COL['c']+4, "щуп CH2", 9, "start", "bold", P_BTN)
s.text(rx(2)+8, COL['a']+18, "GND аналізатора", 9, "start", "bold", BLK)

ny = 690
def note(t, dy, bold=False): s.text(20, ny+dy, t, 13, "start", "bold" if bold else "normal", "#222")
note("1.  ESP32 — через центральний канал: верхній гребінець у колонці i, нижній — у b. Так лишається по одному вільному отвору з кожного боку (j та a).", 0)
note("2.  Світлодіод: довга ніжка (+) — до резистора (і далі до GPIO15), коротка ніжка (−) — чорною перемичкою на шину «−». Шина розірвана посередині — перемичка 28→33.", 24)
note("3.  Кнопка S1 над центральним каналом: GPIO21 і GND — до ДІАГОНАЛЬНИХ ніжок (a46 → e46, f48 → j48). Резистор не потрібен — підтяжку дає INPUT_PULLUP.", 48)
note("4.  Аналізатор: CH1 → f25 (сигнал LED), CH2 → c46 (сигнал кнопки), GND → a2 (пін G плати). Без спільної землі запис — сміття.", 72, True)
note("     Підпис виводів на корпусі аналізатора може відрізнятися (CH0…CH7 замість CH1…CH8) — звіряйтеся з написами на вашому екземплярі.", 96)
lx, ly = 20, ny+136
for c, l, dx in ((W15, "GPIO15 → R1", 0), (W21, "GPIO21 → S1", 150), (BLK, "GND", 300),
                 (P_LED, "CH1 (D0) — LED", 400), (P_BTN, "CH2 (D1) — кнопка", 580)):
    s.line(lx+dx, ly, lx+dx+28, ly, 4.5, c); s.text(lx+dx+36, ly+4, l, 12)

s.save('breadboard.svg')
