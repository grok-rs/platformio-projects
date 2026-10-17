# Generates docs/breadboard.svg — physical layout on a full-size (830-pt) breadboard,
# with an 8-channel FX2 logic analyzer (Saleae Logic clone) probing the PWM signal on GPIO15.
from yd_board import Svg, breadboard, esp32, resistor, led, rx, j1_row, COL, RAIL, BANDS_220

s = Svg(1320, 840)
s.text(20, 34, "Макетна плата: YD-ESP32-S3 + світлодіод на ШІМ (GPIO15) + логічний аналізатор", 19, "start", "bold", "#112")
breadboard(s)
s.text(rx(31)+9, 131, "розрив шини", 9, "middle", "normal", "#b91c1c")
# Headers in i/b instead of the usual h/a: one free hole stays on each side (j and a),
# so the bottom-header G pin is reachable for the analyzer ground.
esp32(s, 'i', 'b', used_top=("15", "G"), used_bot=("G",))

RED, BLK = "#d32f2f", "#222"
W15, P_LED = "#ef6c00", "#00897b"

# --- LED: GPIO15 → R1 (rows 25…29) → LED (29/30) → GND rail -------------------
R1 = 25
resistor(s, R1, R1+4, COL['i'], BANDS_220, "R1 220 Ω")
led(s, R1+4, COL['h'], RED, "D1 ← GPIO15 (ШІМ)", "#333")
s.wire(rx(R1+5), COL['j'], rx(R1+5), RAIL['tn'], BLK)                   # cathode -> GND rail
src = j1_row("15")
s.wire(rx(src), COL['j'], rx(R1), COL['j'], W15, bulge=40 + (R1-src)*2.2)   # GPIO15 -> resistor
g = j1_row("G")
s.wire(rx(g), COL['j'], rx(g+1), RAIL['tn'], BLK)                       # ESP32 G -> rail (row 1 has no rail hole)
s.text(rx(g+1)+8, 74-4, "G", 10, "start", "bold", "#222")

# --- Logic analyzer -----------------------------------------------------------
# One 10-pin header: GND, CH1…CH8, CLK. PulseView calls CH1…CH8 "D0…D7".
LX0 = rx(25) - 98                           # puts CH1 right under the probe row
LX1, LY = LX0 + 520, 540
s.rect(LX0, LY, LX1-LX0, 92, "#263238", "#000", 1.5, 8)
s.text(LX0+16, LY+58, "Логічний аналізатор 24 MHz 8CH", 15, "start", "bold", "#eceff1")
s.text(LX0+16, LY+80, "(клон Saleae Logic, драйвер fx2lafw у PulseView)", 11, "start", "normal", "#b0bec5")
s.rect(LX1-60, LY+38, 50, 30, "#c0c0c0", "#666", 1, 5)
s.text(LX1-35, LY+86, "USB → ПК", 10, "middle", "bold", "#eceff1")
pins = ["GND", "CH1", "CH2", "CH3", "CH4", "CH5", "CH6", "CH7", "CH8", "CLK"]
PX0, PSTEP = LX0+60, 38
px = {n: PX0 + i*PSTEP for i, n in enumerate(pins)}
used = {"CH1": P_LED, "GND": BLK}
for n, x in px.items():
    s.rect(x-5, LY-5, 10, 10, "#d4af37", "#7a5f00", 1)
    hi = n in used
    s.text(x, LY+22, n, 10 if hi else 9, "middle", "bold" if hi else "normal", "#ffffff" if hi else "#90a4ae")
    if n == "CH1": s.text(x, LY+36, "D0", 9, "middle", "normal", "#80cbc4")

# Probe points: free holes on the same rows as the signals.
#   LED net — row 25 (f): GPIO15 jumper + R1 already sit in j/i of this row
#   GND     — row 2 (a):  the ESP32 bottom-header G pin sits in b
s.wire(rx(R1), COL['f'], px["CH1"], LY, P_LED, bulge=-60)
s.wire(rx(2), COL['a'], px["GND"], LY, BLK, bulge=-60)
s.text(rx(R1)-8, COL['f']-6, "щуп CH1", 9, "end", "bold", P_LED)
s.text(rx(2)+8, COL['a']+18, "GND аналізатора", 9, "start", "bold", BLK)

# --- What CH1 shows: 25 % duty at 5 kHz ---------------------------------------
wx, wy, ww, wh = LX1 + 40, 560, 300, 50
s.text(wx, wy-14, "CH1 у PulseView: ledcWrite(64) → 25 %", 12, "start", "bold", P_LED)
period = ww / 3
pts = []
for k in range(3):
    x0 = wx + k*period
    pts += [(x0, wy+wh), (x0, wy), (x0 + period/4, wy), (x0 + period/4, wy+wh), (x0 + period, wy+wh)]
s.add('<polyline points="' + " ".join(f"{x:.1f},{y}" for x, y in pts) + f'" fill="none" stroke="{P_LED}" stroke-width="2.5"/>')
s.line(wx, wy+wh+14, wx+period, wy+wh+14, 1.2, "#555")
s.text(wx+period/2, wy+wh+28, "200 мкс (5 кГц)", 10, "middle", "normal", "#333")
s.text(wx+period/8+4, wy+wh/2+4, "50 мкс", 10, "start", "bold", "#333")

ny = 680
def note(t, dy, bold=False): s.text(20, ny+dy, t, 13, "start", "bold" if bold else "normal", "#222")
note("1.  ESP32 — через центральний канал: верхній гребінець у колонці i, нижній — у b. Так лишається по одному вільному отвору з кожного боку (j та a).", 0)
note("2.  GPIO15 (8-й пін верхнього гребінця від антени) → ряд 25; резистор 220 Ω — ряди 25…29; довга ніжка LED (+) — ряд 29, коротка (−) — ряд 30.", 24)
note("3.  Ряд 30 → шина «−» чорною перемичкою; пін G (останній на верхньому гребінці, біля USB-C; поруч 5V — не переплутати!) → шина «−».", 48)
note("4.  Аналізатор: CH1 → f25 (сигнал ШІМ на GPIO15), GND → a2 (пін G плати). Без спільної землі запис — сміття.", 72, True)
note("     Підпис виводів на корпусі аналізатора може відрізнятися (CH0…CH7 замість CH1…CH8) — звіряйтеся з написами на вашому екземплярі.", 96)
lx, ly = 20, ny+136
for c, l, dx in ((W15, "GPIO15 → R1", 0), (BLK, "GND", 150), (P_LED, "CH1 (D0) — ШІМ", 250)):
    s.line(lx+dx, ly, lx+dx+28, ly, 4.5, c); s.text(lx+dx+36, ly+4, l, 12)

s.save('breadboard.svg')
