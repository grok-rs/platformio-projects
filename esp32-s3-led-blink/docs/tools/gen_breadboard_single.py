# Generates docs/breadboard_single_gpio.svg — both LEDs driven from one GPIO
from yd_board import Svg, breadboard, esp32, resistor, led, rx, j1_row, COL, BANDS_220, BANDS_100

s = Svg(1320, 690)
s.text(20, 34, "Один GPIO: червоний і синій по черзі від піна 7  (env: esp32-s3-single-gpio, SINGLE_GPIO_MODE = 1)", 19, "start", "bold", "#112")
breadboard(s)
esp32(s, 'h', 'a', used_top=("3V3", "7", "G"))

RED, BLUE, ORG, BLK = "#d32f2f", "#1976d2", "#f57c00", "#222"
def tag(x, y, t, color, anchor="start"):
    w = len(t)*7+8; x0 = x if anchor == "start" else x-w
    s.rect(x0, y-11, w, 15, "#ffffff", color, 1, 3, 'opacity="0.95"'); s.text(x0+4, y, t, 10, "start", "bold", color)

p7, p3v3, g = j1_row("7"), j1_row("3V3"), j1_row("G")      # 3V3: pin 1/2 — use pin 2
p3v3 -= 1
# --- червоний: пін 7 -> R1 -> D1 -> G
resistor(s, 27, 31, COL['i'], BANDS_220, "R1 220 Ω")
led(s, 31, COL['h'], RED, "D1 червоний")
s.wire(rx(p7), COL['j'], rx(27), COL['j'], RED, bulge=40)
s.wire(rx(32), COL['i'], rx(g), COL['i'], BLK, bulge=120)
# --- синій: 3V3 -> R2 -> D2 -> назад у ряд піна 7
resistor(s, 40, 44, COL['i'], BANDS_100, "R2 100 Ω")
led(s, 44, COL['h'], BLUE, "D2 синій")
s.wire(rx(p3v3), COL['j'], rx(40), COL['j'], ORG, bulge=65)
s.wire(rx(45), COL['i'], rx(p7), COL['i'], BLUE, bulge=100)
tag(rx(p7)-10, COL['j']+4, "пін 7", RED, "end")
tag(rx(p3v3)+10, COL['j']+4, "пін 3V3", ORG)
tag(rx(g)+10, COL['i']+4, "пін G", BLK)
tag(rx(45)+10, COL['i']+4, "катод синього → у ряд піна 7, НЕ в GND", BLUE)

# --- пояснення
s.rect(rx(25), COL['e']+2, rx(63)-rx(25), 64, "#ffffff", "#334", 1.2, 5, 'opacity="0.96"')
s.text(rx(25.5), COL['e']+18, "пін 7 = HIGH (3.3 В):  пін 7 → R1 → D1 → G — світить червоний;  синій: обидва кінці на 3.3 В — вимкнений", 12, "start", "normal", "#222")
s.text(rx(25.5), COL['e']+36, "пін 7 = LOW (0 В):      3V3 → R2 → D2 → пін 7 — світить синій;  червоний: обидва кінці на 0 В — вимкнений", 12, "start", "normal", "#222")
s.text(rx(25.5), COL['e']+54, "пін 7 = INPUT (Hi-Z):  обидва вимкнені (для ланцюга 3V3→D2→D1→G треба ≈4.7 В, а є 3.3 В)", 12, "start", "normal", "#222")

ny = 490
def note(t, dy, bold=False): s.text(20, ny+dy, t, 13, "start", "bold" if bold else "normal", "#222")
note("1.  Червоний: перемичка ряд піна «7» → ряд 27;  R1 220 Ω: 27 → 31;  LED «+» ряд 31, «−» ряд 32;  чорна перемичка: 32 → ряд піна «G» (біля USB-C).", 0)
note("2.  Синій: перемичка ряд піна «3V3» (другий від антени) → ряд 40;  R2 100 Ω: 40 → 44;  LED «+» ряд 44, «−» ряд 45;  синя перемичка: 45 → ряд піна «7».", 24)
note("3.  Шини «+»/«−» не потрібні. Усі деталі — з боку пінів ESP32 (у тій самій п'ятірці отворів).", 48)
note("4.  Прошивка:  pio run -e esp32-s3-single-gpio -t upload   (або вибрати env esp32-s3-single-gpio у рядку стану VS Code).", 72, True)
note("5.  Перевірка: у моніторі 1 → червоний, 2 → синій, 0 → обидва вимкнені. Патерн alternate = HIGH/LOW по черзі = червоний/синій по черзі.", 96)
note("6.  Мультиметр (чорний щуп на G): пін 7 = 3.3 В при «1», ≈0 В при «2»; пін 3V3 = 3.3 В завжди.", 120)

s.save('breadboard_single_gpio.svg')
