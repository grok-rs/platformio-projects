# Generates docs/breadboard.svg — physical layout on a full-size (830-pt) breadboard
from yd_board import Svg, breadboard, esp32, resistor, led, rx, j1_row, COL, RAIL, BANDS_220, BANDS_100

s = Svg(1320, 700)
s.text(20, 34, "Макетна плата: YD-ESP32-S3 + 3 світлодіоди (режим двох GPIO, SINGLE_GPIO_MODE = 0)", 19, "start", "bold", "#112")
breadboard(s)
s.text(rx(31)+9, 131, "розрив шини", 9, "middle", "normal", "#b91c1c")
esp32(s, 'h', 'a', used_top=("4", "5", "6", "G"))

RED, BLUE, GREEN, BLK = "#d32f2f", "#1976d2", "#2e7d32", "#222"
# (GPIO name, resistor start row, colour, bands, labels)
circuits = [("4", 27, RED,   BANDS_220, "R1 220 Ω", "D1 червоний ← GPIO4"),
            ("5", 35, BLUE,  BANDS_100, "R2 100 Ω", "D2 синій ← GPIO5"),
            ("6", 43, GREEN, BANDS_220, "R3 220 Ω", "D3 зелений ← GPIO6")]
for gpio, dst, col, bands, rl, dl in circuits:
    resistor(s, dst, dst+4, COL['i'], bands, rl)
    led(s, dst+4, COL['h'], col, dl)
    s.wire(rx(dst+5), COL['j'], rx(dst+5), RAIL['tn'], BLK)             # cathode -> GND rail
for gpio, dst, col, bands, rl, dl in circuits:
    src = j1_row(gpio)
    s.wire(rx(src), COL['j'], rx(dst), COL['j'], col, bulge=40 + (dst-src)*2.2)   # GPIO -> resistor
g = j1_row("G")
s.wire(rx(g), COL['j'], rx(g+1), RAIL['tn'], BLK)                       # ESP32 G -> rail (row 1 has no rail hole)
s.wire(rx(30), RAIL['tn'], rx(33), RAIL['tn'], BLK, bulge=30)           # bridge the split rail
s.text(rx(31)+9, 48, "перемичка через розрив", 9, "middle", "normal", "#b91c1c")
s.text(rx(g+1)+8, 74-4, "G", 10, "start", "bold", "#222")
s.rect(rx(25), COL['e']+4, rx(62)-rx(25), 46, "#ffffff", "#b91c1c", 1.2, 5, 'opacity="0.96"')
s.text(rx(43.5), COL['e']+22, "Шина «+» (червона лінія) у цій схемі не використовується:", 12, "middle", "bold", "#b91c1c")
s.text(rx(43.5), COL['e']+40, "«плюс» для кожного світлодіода дає сам вивід GPIO (HIGH = 3.3 В), тому потрібна лише шина «−» (GND).", 12, "middle", "normal", "#b91c1c")

ny = 500
def note(t, dy, bold=False): s.text(20, ny+dy, t, 13, "start", "bold" if bold else "normal", "#222")
note("1.  ESP32 ставимо через центральний канал так, щоб над верхнім гребінцем (3V3, 3V3, RST, 4, 5, 6, 7, …, 5V, G) лишалося 1–2 вільні отвори.", 0)
note("2.  Світлодіод: довга ніжка (+) — до резистора (і далі до GPIO), коротка ніжка (−, зріз на корпусі) — чорною перемичкою на шину «−».", 24)
note("3.  Чорна перемичка: пін G (останній на гребінці, біля USB-C; поруч 5V — не переплутати!) → шина «−». Шина розірвана посередині — перемичка 30→33.", 48)
note("4.  Живлення всієї схеми — один USB-кабель у роз'єм «USB» (нативний USB, не «COM»); через нього ж іде прошивка та Serial-монітор.", 72, True)
note("5.  Струм світлодіодів (≈5 мА кожен через 220/100 Ω) віддає сам вивід GPIO (HIGH = 3.3 В), тому зовнішнє живлення для них зайве.", 96)
note("6.  Режим одного GPIO (єдиний випадок, де потрібен 3V3): 3V3 ESP32 (пін 2) → 100 Ω → анод синього, катод синього — у ряд GPIO7; червоний — як D1, але від GPIO7.", 120)
lx, ly = 20, ny+156
for c, l, dx in ((RED, "GPIO4 → R1", 0), (BLUE, "GPIO5 → R2", 130), (GREEN, "GPIO6 → R3", 260), (BLK, "GND", 390)):
    s.line(lx+dx, ly, lx+dx+28, ly, 4.5, c); s.text(lx+dx+36, ly+4, l, 12)

s.save('breadboard.svg')
