# Generates docs/breadboard_step1.svg — minimal check: one LED, no power rails
from yd_board import Svg, breadboard, esp32, resistor, led, rx, j1_row, COL, BANDS_220

s = Svg(1320, 640)
s.text(20, 34, "Крок 1: лише червоний світлодіод від GPIO4 — без шин живлення", 19, "start", "bold", "#112")
breadboard(s)
esp32(s, 'h', 'a', used_top=("4", "G"))

RED, BLK = "#d32f2f", "#222"
p4, g = j1_row("4"), j1_row("G")
resistor(s, 27, 31, COL['i'], BANDS_220, "R1 220 Ω  (ряд 27 → 31)")
led(s, 31, COL['h'], RED, "D1 червоний: «+» ряд 31, «−» ряд 32")
s.wire(rx(p4), COL['j'], rx(27), COL['j'], RED, bulge=38)              # GPIO4 row -> resistor
s.wire(rx(32), COL['i'], rx(g), COL['i'], BLK, bulge=120)              # LED cathode row -> G row
s.text(rx(p4)-8, COL['j']+4, "пін 4", 11, "end", "bold", RED)
s.text(rx(g)+8, COL['i']+4, "пін G", 11, "start", "bold", BLK)
s.rect(rx(25), COL['e']+4, rx(62)-rx(25), 46, "#ffffff", "#b91c1c", 1.2, 5, 'opacity="0.96"')
s.text(rx(43.5), COL['e']+22, "Шини «+» і «−» поки не використовуємо взагалі:", 12, "middle", "bold", "#b91c1c")
s.text(rx(43.5), COL['e']+40, "катод світлодіода йде чорною перемичкою прямо в ряд піна G (GND) на ESP32.", 12, "middle", "normal", "#b91c1c")

ny = 490
def note(t, dy, bold=False): s.text(20, ny+dy, t, 13, "start", "bold" if bold else "normal", "#222")
note("1.  Зніміть з макетки все інше. Знайдіть на платі написи «4» (біля антени: 3V3, 3V3, RST, 4, 5, 6, 7) і «G» (той самий гребінець, останній пін біля USB-C).", 0)
note("2.  Червона перемичка: вільний отвір ряду піна «4» → ряд 27.   Резистор 220 Ω: ряд 27 → ряд 31.", 24)
note("3.  Світлодіод: довга ніжка (+) у ряд 31, коротка (−) у ряд 32.   Чорна перемичка: ряд 32 → вільний отвір ряду піна «G».", 48)
note("4.  Усі деталі — з того ж боку центрального каналу, що й піни ESP32 (у тій самій п'ятірці отворів).", 72)
note("5.  Перевірка: у моніторі набрати 1 → світлодіод горить постійно. Мультиметр (чорний щуп на пін G): пін 4 = 3.3 В, довга ніжка LED ≈ 1.9 В, коротка = 0 В.", 96, True)

s.save('breadboard_step1.svg')
