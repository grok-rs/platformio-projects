# Generates ../timing.svg (the cycle, the button, the watchdog) and ../architecture.svg (who does what).
import math, os
out = []
def add(s): out.append(s)
def esc(s): return str(s).replace('&', '&amp;').replace('<', '&lt;')
def text(x, y, s, size=14, anchor="start", weight="normal", fill="#222", mono=False):
    fam = "DejaVu Sans Mono, monospace" if mono else "DejaVu Sans, Arial, sans-serif"
    add(f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" text-anchor="{anchor}" font-weight="{weight}" fill="{fill}" font-family="{fam}">{esc(s)}</text>')
def line(x1, y1, x2, y2, w=2, c="#222", dash=""):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    add(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{c}" stroke-width="{w}" stroke-linecap="round"{d}/>')
def path(pts, w=2.5, c="#222", fill="none"):
    add('<polyline points="' + " ".join(f"{x:.1f},{y:.1f}" for x, y in pts) + f'" fill="{fill}" stroke="{c}" stroke-width="{w}" stroke-linejoin="round"/>')
def rect(x, y, w, h, fill="#fff", stroke="#222", sw=2, r=8, dash=""):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    add(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d}/>')
def arrow(x1, y1, x2, y2, c="#222", w=2.2, head=11):
    line(x1, y1, x2, y2, w, c)
    a = math.atan2(y2 - y1, x2 - x1)
    p = [(x2, y2), (x2 - head*math.cos(a-.42), y2 - head*math.sin(a-.42)), (x2 - head*math.cos(a+.42), y2 - head*math.sin(a+.42))]
    add('<polygon points="' + " ".join(f"{x:.1f},{y:.1f}" for x, y in p) + f'" fill="{c}"/>')
def begin(w, h, title):
    out.clear()
    add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">')
    add(f'<rect width="{w}" height="{h}" fill="#ffffff"/>')
    text(40, 42, title, 20, "start", "bold", "#112")
def save(name):
    add('</svg>')
    open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', name), 'w').write("\n".join(out))

RED, GREEN, BLUE, PURPLE, ORANGE, GREY, TEAL = "#c62828", "#2e7d32", "#1565c0", "#6a1b9a", "#e65100", "#52606d", "#00796b"

# ===================================================================================== timing
W, H = 1320, 950
begin(W, H, "Часові діаграми: цикл вентилятора, кнопка і сторож")
X0, X1 = 240, 1280

def lane(y, label, sub=""):
    text(40, y + 4, label, 14, "start", "bold")
    if sub: text(40, y + 22, sub, 12, "start", "normal", GREY)

def square(y, h, spans, tx, c, fill):
    pts = [(X0, y)]
    for a, b in spans:
        xa, xb = tx(a), tx(b)
        add(f'<rect x="{xa:.1f}" y="{y-h:.1f}" width="{xb-xa:.1f}" height="{h}" fill="{fill}"/>')
        pts += [(xa, y), (xa, y - h), (xb, y - h), (xb, y)]
    pts.append((X1, y)); path(pts, 2.5, c)

# ---- A. normal cycle, 0…140 minutes
text(40, 82, "А. Звичайний цикл: кожну годину 15 хвилин роботи", 16, "start", "bold", "#112")
t = lambda m: X0 + (X1 - X0) * m / 140
for m in range(0, 141, 15):
    major = m % 60 == 0
    line(t(m), 100, t(m), 300, 1.4 if major else .7, "#9aa5b1" if major else "#dde3e8", "" if major else "4 4")
    text(t(m), 318, f"{m}", 12, "middle", "bold" if major else "normal", GREY)
text(X1, 336, "хвилини", 12, "end", "normal", GREY)
sp = [(0, 15), (60, 75), (120, 135)]
lane(150, "GPIO2, вентилятор"); square(150, 34, sp, t, RED, "#fde8e8")
lane(205, "GPIO15, червоний"); square(205, 26, sp, t, RED, "#fde8e8")
lane(258, "GPIO16, зелений"); square(258, 26, [(15, 60), (75, 120), (135, 140)], t, GREEN, "#e6f4ea")
ty = 298
lane(ty, "second")
path([(t(0), ty), (t(60), ty - 26), (t(60), ty), (t(120), ty - 26), (t(120), ty), (t(140), ty - 8.7)], 2, BLUE)
line(t(15), ty - 6.5, t(15), ty, 1.5, RED, "3 3"); text(t(15) + 6, ty - 12, "900 = ON_S", 11, "start", "bold", RED)
text(t(60) - 6, ty - 28, "3599 → 0", 11, "end", "bold", BLUE)

# ---- B. button
text(40, 372, "Б. Кнопка S1: під час чекання починає цикл, під час роботи ігнорується", 16, "start", "bold", "#112")
for m in range(0, 141, 15):
    line(t(m), 392, t(m), 498, .7, "#dde3e8", "4 4"); text(t(m), 514, f"{m}", 12, "middle", "normal", GREY)
lane(420, "S1")
for m, c in ((30, GREEN), (38, RED)):
    arrow(t(m), 396, t(m), 420, c)
text(t(30) - 6, 410, "чекає: цикл спочатку", 12, "end", "bold", GREEN)
text(t(38) + 8, 410, "працює: нічого не змінює, 15 хвилин не подовжуються", 12, "start", "bold", RED)
lane(482, "GPIO2, вентилятор"); square(482, 34, [(0, 15), (30, 45), (90, 105)], t, RED, "#fde8e8")
text(t(90) - 8, 472, "наступна робота через годину від натискання", 12, "end", "normal", GREY)

# ---- C. watchdog
text(40, 560, "В. Сторож: годуємо, лише коли таймер цокає. Зупинилось щось одне, і через 5 с плата перезавантажується", 16, "start", "bold", "#112")
s = lambda c: X0 + (X1 - X0) * c / 14
for c in range(0, 15):
    line(s(c), 580, s(c), 736, .7, "#dde3e8", "4 4"); text(s(c), 752, f"{c}", 12, "middle", "normal", GREY)
text(X1, 770, "секунди, SPEEDUP = 1", 12, "end", "normal", GREY)
lane(610, "тіки таймера")
lane(660, "годування", "esp_task_wdt_reset()")
lane(712, "лічильник сторожа")
STOP = 6
for c in range(1, STOP + 1):
    line(s(c), 610, s(c), 590, 2.5, BLUE); arrow(s(c), 636, s(c), 660, TEAL, 2, 9)
line(s(STOP) + 14, 588, s(STOP) + 50, 612, 2.5, RED); line(s(STOP) + 50, 588, s(STOP) + 14, 612, 2.5, RED)
text(s(STOP) + 58, 604, "завис таймер або цикл", 13, "start", "bold", RED)
pts = [(s(0), 712)]
for c in range(1, STOP + 1):
    pts += [(s(c), 712 - 26*1/5), (s(c), 712)]
TO = STOP + 5
pts += [(s(TO), 712 - 26)]
path(pts, 2.5, ORANGE)
line(s(0), 686, s(TO), 686, 1.2, ORANGE, "5 4"); text(s(0) + 4, 681, "5 с", 12, "start", "bold", ORANGE)
line(s(TO), 582, s(TO), 736, 3, RED); text(s(TO) + 8, 730, "RESET", 13, "start", "bold", RED)
text(s(TO) + 8, 612, "старт: після", 12, "start", "normal", RED); text(s(TO) + 8, 628, "сторожа", 12, "start", "normal", RED)

# ---- D. numbers
text(40, 808, "Г. Звідки числа", 16, "start", "bold", "#112")
for i, s_ in enumerate(("Тік лічильника: resolution_hz = 1 000 000, ESP-IDF ставить дільник 80 МГц / 80 = 1 МГц, тобто 1 мкс.",
                        "У роботі (SPEEDUP 1): будильник 1 000 000 тіків = 1 с. Цикл 3600 с = 1 год, робота 900 с = 15 хв.",
                        "Налагодження (SPEEDUP 300): будильник 1 000 000 / 300 = 3333 тіки ≈ 3,33 мс. Цикл ≈ 12 с, робота ≈ 3 с, форма та сама.",
                        "Автоперезавантаження робить залізо, тому затримка входу в on_tick() не накопичується: точність задає лише кварц плати.")):
    text(40, 834 + i * 24, s_, 14)
save('timing.svg')

# ===================================================================================== architecture
W, H = 1320, 640
begin(W, H, "Хто що робить: цикл живе в таймері gptimer, а не в app_main()")
BX, BY, BW, BH = 40, 80, 1240, 200
rect(BX, BY, BW, BH, "#eef6ff", BLUE, 2.5, 14)
text(BX + 18, BY + 28, "ЗАЛІЗО: працює саме, хоч би чим був зайнятий код", 14, "start", "bold", BLUE)
y = 180
blocks = [("Такти APB", "80 МГц"), ("Дільник", "÷ 80"), ("Лічильник, 54 біти", "+1 кожну мкс"), ("Будильник", "1 000 000 / SPEEDUP")]
x = 70; xs = []
for i, (a, b) in enumerate(blocks):
    w = 210 if i > 1 else 150
    rect(x, y - 42, w, 84, "#fff", BLUE); text(x + w/2, y - 8, a, 14, "middle", "bold"); text(x + w/2, y + 18, b, 13, "middle", "normal", GREY, True)
    xs.append((x, w))
    if i < 3: arrow(x + w, y, x + w + 40, y, BLUE)
    x += w + 40
ax, aw = xs[3]
arrow(ax + 60, y + 42, ax + 60, y + 72, BLUE, 2); line(ax + 60, y + 72, xs[2][0] + 100, y + 72, 2, BLUE); arrow(xs[2][0] + 100, y + 72, xs[2][0] + 100, y + 44, BLUE, 2)
text(ax - 14, y + 90, "автоперезавантаження: лічильник з нуля", 12, "end", "normal", BLUE)
rect(x, y - 42, 200, 84, "#fff4e5", ORANGE); text(x + 100, y - 8, "Переривання", 14, "middle", "bold"); text(x + 100, y + 18, "ядро 0", 13, "middle", "normal", GREY)
arrow(ax + aw, y, x, y, ORANGE); isr_x = x + 100
# ISR box
ix, iy, iw, ih = 440, 320, 500, 170
rect(ix, iy, iw, ih, "#fff4e5", ORANGE, 2.5, 14)
text(ix + 18, iy + 28, "on_tick(): обробник gptimer, весь цикл вентилятора", 14, "start", "bold", ORANGE)
for i, s_ in enumerate(("ticks++;", "if (++second >= PERIOD_S) second = 0;", "bool on = second < ON_S;", "gpio_set_level(FAN, on);  // і два LED")):
    text(ix + 22, iy + 62 + i * 25, s_, 14, "start", "normal", "#222", True)
path([(isr_x, y + 42), (isr_x, 300), (ix + iw - 60, 300)], 2.5, ORANGE); arrow(ix + iw - 60, 300, ix + iw - 60, iy, ORANGE)
# outputs
ox = 1020
rect(ox, 320, 260, 170, "#fde8e8", RED, 2.5, 14)
text(ox + 16, 348, "Виходи", 14, "start", "bold", RED)
for i, s_ in enumerate(("GPIO2 → BC547B → реле → мотор", "GPIO15: червоний LED", "GPIO16: зелений LED")):
    text(ox + 16, 382 + i * 26, s_, 13)
arrow(ix + iw, 405, ox, 405, RED)
# button
rect(40, 320, 330, 170, "#f3e8ff", PURPLE, 2.5, 14)
text(58, 348, "on_button(): кнопка S1, GPIO21", 14, "start", "bold", PURPLE)
for i, s_ in enumerate(("if (second >= ON_S)", "  second = PERIOD_S - 1;")):
    text(58, 384 + i * 25, s_, 14, "start", "normal", "#222", True)
text(58, 458, "наступний тік почне цикл спочатку", 13, "start", "normal", GREY)
arrow(370, 405, ix, 405, PURPLE); text(404, 396, "second", 12, "middle", "bold", PURPLE)
# loop
rect(40, 522, 1240, 88, "#f1f5f4", TEAL, 2.5, 14)
text(58, 550, "while (1) в app_main(): необов'язковий спостерігач, циклу не потрібен", 14, "start", "bold", TEAL)
text(58, 578, "друкує кожне перемикання і годує сторожа, лише якщо ticks змінився", 13)
text(1262, 578, "порожній цикл не зупинить вентилятор", 13, "end", "bold", TEAL)
arrow(690, 522, 690, 494, TEAL); text(702, 512, "читає ticks, second", 12, "start", "normal", TEAL)
save('architecture.svg')
print("ok")
