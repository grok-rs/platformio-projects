# Generates ../timing.svg (one press through every method), ../fsm.svg (the state machine of task 4),
# ../rc-curve.svg (task 5) and ../flow.svg (how an event travels in each firmware).
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
W, H = 1320, 900
begin(W, H, "Одне натискання очима кожної прошивки")
text(40, 66, "Масштаб умовний: брязкіт показано розтягнутим, щоб було видно окремі фронти. Вікно 50 мс, опитування 10 мс.", 13, "start", "normal", GREY)
X0, XB1, XB2, X1 = 190, 660, 760, 1280            # press zone, break, release zone
tp = lambda ms: X0 + (XB1 - X0) * ms / 75         # press zone 0…75 ms
tr = lambda ms: XB2 + (X1 - XB2) * ms / 75        # release zone 0…75 ms (from the moment of release)
def brk(y1, y2):
    add(f'<rect x="{XB1+1}" y="{y1}" width="{XB2-XB1-2}" height="{y2-y1}" fill="#fff"/>')
def lane(y, a, b=""):
    text(40, y, a, 14, "start", "bold")
    if b: text(40, y + 18, b, 12, "start", "normal", GREY)
for ms in range(0, 76, 25):
    for f in (tp, tr):
        line(f(ms), 92, f(ms), 800, .7, "#dde3e8", "4 4"); text(f(ms), 816, f"{ms}", 12, "middle", "normal", GREY)
text(tp(37), 836, "мс від першого фронту натискання", 12, "middle", "normal", GREY)
text(tr(37), 836, "мс від першого фронту відпускання", 12, "middle", "normal", GREY)
text((XB1 + XB2) / 2, 176, "утримання", 12, "middle", "bold", GREY); text((XB1 + XB2) / 2, 194, "0,3 с", 12, "middle", "normal", GREY)

# GPIO7 waveform with bounce: (ms, level)
press = [(0, 0), (1.5, 1), (2.5, 0), (4, 1), (4.8, 0), (6, 1), (6.6, 0)]
rel = [(0, 1), (0.9, 0), (1.6, 1), (2.7, 0), (3.2, 1)]
HI, LO = 112, 150
def wave(f, start, edges, end):
    pts = []; lvl = start
    pts.append((f(-4) if False else f(0) - 40, HI if lvl else LO))
    for ms, l in edges:
        pts += [(f(ms), HI if lvl else LO), (f(ms), HI if l else LO)]; lvl = l
    pts.append((f(end), HI if lvl else LO)); return pts
lane(128, "GPIO7", "рівень на вході")
path(wave(tp, 1, press, 75), 2.5, BLUE); path(wave(tr, 0, rel, 75), 2.5, BLUE)
fall_p = [m for m, l in press if l == 0]; fall_r = [m for m, l in rel if l == 0]
def mark(x, y, c, up=True):
    d = -1 if up else 1
    add(f'<polygon points="{x-6},{y} {x+6},{y} {x},{y+12*d}" fill="{c}"/>')
def react(x, y1, y2, c=GREEN, label=None):
    rect(x - 7, y1, 14, y2 - y1, c, c, 1, 3)

# rows
Y = {'raw': 200, 'time': 300, 'state': 410, 'poll': 530, 'rc': 680}
# ---- raw
lane(Y['raw'], "raw", "завдання 1")
for m in fall_p: mark(tp(m), Y['raw'] + 16, RED if m else GREEN)
for m in fall_r: mark(tr(m), Y['raw'] + 16, RED)
text(tp(16), Y['raw'] + 12, "кожен спадаючий фронт — це +1", 13, "start", "bold", RED)
text(tr(12), Y['raw'] + 12, "і при відпусканні теж", 13, "start", "bold", RED)
# ---- time
lane(Y['time'], "time", "завдання 2")
y = Y['time'] + 16
mark(tp(0), y, GREEN)
for m in fall_p[1:]: mark(tp(m), y, "#b0b8c1")
line(tp(0), y + 12, tp(50), y + 12, 2, ORANGE); line(tp(50), y + 4, tp(50), y + 20, 2, ORANGE)
text(tp(10), y + 32, "ближче ніж 50 мс: ігнор", 12, "start", "normal", ORANGE)
mark(tr(fall_r[0]), y, RED); mark(tr(fall_r[1]), y, "#b0b8c1")
text(tr(10), y - 2, "минуло 0,3 с: «натискання»", 13, "start", "bold", RED)
text(tr(10), y + 16, "це і є фантом при відпусканні", 12, "start", "normal", RED)
# ---- state
lane(Y['state'], "state", "завдання 3")
y = Y['state'] + 8
rect(tp(0), y - 12, tp(50) - tp(0), 22, "#fff4e5", ORANGE, 1.5, 4); text(tp(25), y + 4, "vTaskDelay(50 мс)", 12, "middle", "normal", ORANGE)
react(tp(50), y - 16, y + 14); text(tp(50) + 12, y + 4, "LOW: реакція", 13, "start", "bold", GREEN)
rect(tr(1.2), y - 12, tr(51.2) - tr(1.2), 22, "#fff4e5", ORANGE, 1.5, 4); text(tr(26), y + 4, "подія теж чекає", 12, "middle", "normal", ORANGE)
line(tr(51.2), y - 16, tr(51.2), y + 14, 3, GREY); text(tr(51.2) + 8, y + 4, "HIGH: нічого", 13, "start", "bold", GREY)
# ---- poll
lane(Y['poll'], "poll", "завдання 4")
y = Y['poll']
for f in (tp, tr):
    for ms in range(0, 76, 10): line(f(ms), y - 22, f(ms), y - 12, 1.6, TEAL)
text(tp(0) - 6, y - 12, "опитування", 11, "end", "normal", TEAL) if False else None
def band(f, a, b, c, s):
    rect(f(a), y - 6, f(b) - f(a), 24, c, "#556", 1, 3); text((f(a) + f(b)) / 2, y + 11, s, 12, "middle", "bold", "#223", True)
band(tp, 0, 10, "#eef2f7", "I"); band(tp, 10, 60, "#fff4e5", "PRESSED"); band(tp, 60, 75, "#fde8e8", "HELD")
band(tr, 0, 10, "#fde8e8", "HELD"); band(tr, 10, 60, "#e8f0fe", "RELEASE"); band(tr, 60, 75, "#eef2f7", "IDLE")
react(tp(60), y - 26, y + 22); text(tp(60), y + 38, "реакція", 13, "middle", "bold", GREEN)
text(tp(10), y + 38, "LOW стабільний 50 мс", 12, "start", "normal", GREY); text(tr(10), y + 38, "HIGH стабільний 50 мс, реакції немає", 12, "start", "normal", GREY)
# ---- rc
lane(Y['rc'] - 26, "вузол з RC", "завдання 5")
TOP, BOT = Y['rc'] - 52, Y['rc'] + 30
vy = lambda v: BOT - (BOT - TOP) * v / 3.3
for v, s_, c in ((0.75 * 3.3, "0,75·VDD: HIGH", GREEN), (0.25 * 3.3, "0,25·VDD: LOW", RED)):
    line(X0, vy(v), XB1, vy(v), 1.2, c, "6 4"); line(XB2, vy(v), X1, vy(v), 1.2, c, "6 4"); text(XB1 - 4, vy(v) - 5, s_, 11, "end", "normal", c)
# press: fast discharge to 33 mV, tiny bumps in the gaps
TAU = 1.0
def rc_trace(f, start, edges, end, closed0):
    pts = []; t = -3.0; v = start; closed = closed0; tl = t
    ev = edges + [(end, None)]
    for ms, l in ev:
        n = 40
        for i in range(1, n + 1):
            tt = tl + (ms - tl) * i / n; dt = (ms - tl) / n
            if closed: v = v * math.exp(-dt / 0.01) + 0.033 * (1 - math.exp(-dt / 0.01))
            else: v = 3.3 - (3.3 - v) * math.exp(-dt / TAU)
            pts.append((f(max(tt, -5)), vy(v)))
        tl = ms
        if l is not None: closed = l == 0
    return pts
path(rc_trace(tp, 3.3, press, 75, False), 2.5, PURPLE); path(rc_trace(tr, 0.033, rel, 75, True), 2.5, PURPLE)
text(tp(11), vy(1.75), "натискання: τ = 10 мкс, майже відразу", 12, "start", "bold", PURPLE)
text(tr(10), vy(1.75), "відпускання: τ = 1 мс, паузи брязкоту не доходять до HIGH", 12, "start", "bold", PURPLE)
for x in (XB1, XB2):
    line(x, 92, x, 800, 1.2, "#9aa5b1")
save('timing.svg')

# ===================================================================================== fsm
W, H = 1320, 720
begin(W, H, "Завдання 4: машина станів кнопки, poll.c")
text(40, 66, "Крок кожні 10 мс: прочитати рівень, подивитися на state, вирішити, куди далі. Ніхто не чекає. down — кнопка натиснута (LOW), up — відпущена (HIGH).", 13, "start", "normal", GREY)
P = {'IDLE': (230, 260), 'PRESSED': (660, 260), 'HELD': (1090, 260), 'RELEASE': (660, 540)}
C = {'IDLE': ("#eef2f7", "#445"), 'PRESSED': ("#fff4e5", ORANGE), 'HELD': ("#fde8e8", RED), 'RELEASE': ("#e8f0fe", BLUE)}
SUB = {'IDLE': "кнопка відпущена", 'PRESSED': "може, натискання,\nможе, брязкіт", 'HELD': "натискання зараховане", 'RELEASE': "може, відпускання,\nможе, брязкіт"}
RX, RY = 130, 66
for k, (x, y) in P.items():
    f, s_ = C[k]
    add(f'<ellipse cx="{x}" cy="{y}" rx="{RX}" ry="{RY}" fill="{f}" stroke="{s_}" stroke-width="3"/>')
    text(x, y - 12, k, 19, "middle", "bold", "#112", True)
    for i, l in enumerate(SUB[k].split("\n")): text(x, y + 14 + i * 18, l, 13, "middle", "normal", GREY)
# forward
arrow(360, 240, 530, 240, "#222"); text(445, 228, "down", 14, "middle", "bold", "#222", True); text(445, 212, "since = now", 12, "middle", "normal", GREY, True)
arrow(790, 240, 960, 240, GREEN, 3); text(875, 212, "down ≥ 50 мс", 14, "middle", "bold", GREEN, True)
text(875, 198 - 6, "presses++, LED, друк", 12, "middle", "bold", GREEN)
# back
arrow(530, 280, 360, 280, ORANGE); text(445, 302, "up: відскочило", 13, "middle", "bold", ORANGE); text(445, 320, "bounces++", 12, "middle", "normal", GREY, True)
# held → release
path([(1090, 326), (1090, 540)], 2.2); arrow(1090, 540, 790, 540, "#222"); text(1100, 440, "up", 14, "start", "bold", "#222", True); text(1100, 460, "since = now", 12, "start", "normal", GREY, True)
# release → held (bounce)
path([(760, 498), (980, 340)], 2.2, ORANGE); arrow(980, 340, 1000, 310, ORANGE); text(800, 410, "down: брязкіт", 13, "start", "bold", ORANGE); text(800, 428, "відпускання", 13, "start", "bold", ORANGE); text(800, 446, "bounces++", 12, "start", "normal", GREY, True)
# release → idle
path([(530, 540), (230, 540), (230, 326)], 2.2, BLUE); arrow(230, 340, 230, 326, BLUE)
text(250, 480, "up ≥ 50 мс", 14, "start", "bold", BLUE, True); text(250, 502, "час утримання:", 13, "start", "normal", BLUE); text(250, 520, "< 2 с коротке, ≥ 2 с довге", 13, "start", "bold", BLUE)
# self-loops (text only)
text(230, 170, "up: лишаємось", 13, "middle", "normal", GREY); text(1090, 170, "down: лишаємось", 13, "middle", "normal", GREY)
text(40, 640, "Реакція приходить лише один раз, на стрілці PRESSED → HELD: скільки б не тримали кнопку, другої не буде.", 15, "start", "bold", "#112")
text(40, 668, "Відпускання ніколи не дає реакції, бо з RELEASE немає стрілки зі словом presses++. Тому фантому завдання 2 тут взятися нізвідки.", 15, "start", "normal", "#223")
text(40, 696, "Натискання коротше за 50 мс повертається з PRESSED в IDLE: це ціна за стабільність.", 15, "start", "normal", "#223")
save('fsm.svg')

# ===================================================================================== rc curve
W, H = 1320, 700
begin(W, H, "Завдання 5: напруга на вузлі кнопки з RC-фільтром")
def panel(px, title, sub, tmax, fn, ticks, unit):
    pw, ph, py = 560, 380, 130
    text(px, 90, title, 16, "start", "bold", "#112"); text(px, 112, sub, 13, "start", "normal", GREY)
    X = lambda t: px + pw * t / tmax; Yv = lambda v: py + ph - ph * v / 3.3
    add(f'<rect x="{px}" y="{Yv(0.75*3.3):.1f}" width="{pw}" height="{Yv(0.25*3.3)-Yv(0.75*3.3):.1f}" fill="#fff8e1"/>')
    text(px + pw - 8, Yv(1.65) + 4, "рівень не визначений", 13, "end", "bold", "#a07400")
    line(px, py, px, py + ph, 2); line(px, py + ph, px + pw, py + ph, 2)
    for v, l, c in ((3.3, "3,3 В", "#222"), (0.75*3.3, "2,48 В: HIGH", GREEN), (0.25*3.3, "0,83 В: LOW", RED), (0, "0", "#222")):
        line(px, Yv(v), px + pw, Yv(v), 1.2, c if v not in (0, 3.3) else "#dde3e8", "6 4" if v not in (0, 3.3) else "")
        text(px - 8, Yv(v) + 4, l.split(":")[0], 12, "end", "bold" if v not in (0, 3.3) else "normal", c)
    for t in ticks:
        line(X(t), py + ph, X(t), py + ph + 6, 2); text(X(t), py + ph + 22, f"{t}".replace('.', ','), 12, "middle")
    text(px + pw, py + ph + 42, unit, 13, "end", "normal", GREY)
    path([(X(tmax * i / 200), Yv(fn(tmax * i / 200))) for i in range(201)], 3.2, PURPLE)
    return X, Yv
X, Yv = panel(90, "Відпускання: заряд через R1", "τ = 10 кОм × 100 нФ = 1 мс", 5, lambda t: 3.3 * (1 - math.exp(-t)), [0, 1, 2, 3, 4, 5], "мс")
tH = math.log(4)
line(X(tH), Yv(2.475), X(tH), Yv(0), 2, GREEN, "5 4"); add(f'<circle cx="{X(tH):.1f}" cy="{Yv(2.475):.1f}" r="6" fill="{GREEN}"/>')
text(X(tH) + 10, Yv(2.475) + 20, "HIGH через 1,39 τ ≈ 1,4 мс", 14, "start", "bold", GREEN)
line(X(1), Yv(3.3*(1-math.exp(-1))), X(1), Yv(0), 1.4, PURPLE, "3 4"); text(X(1) + 8, Yv(0) - 10, "τ: 63 %", 12, "start", "bold", PURPLE)
X2, Yv2 = panel(730, "Натискання: розряд через R2", "τ = 100 Ом × 100 нФ = 10 мкс, до ≈ 33 мВ", 50, lambda t: 0.033 + (3.3 - 0.033) * math.exp(-t / 10), [0, 10, 20, 30, 40, 50], "мкс")
tL = 10 * math.log((3.3 - .033) / (0.825 - .033))
add(f'<circle cx="{X2(tL):.1f}" cy="{Yv2(0.825):.1f}" r="6" fill="{RED}"/>'); text(X2(tL) + 10, Yv2(0.825) - 10, f"LOW через ≈ {tL:.0f} мкс", 14, "start", "bold", RED)
for i, s_ in enumerate(("Чому це працює: контакт розімкнувся на коротку паузу → вузол піднімається лише на частину шляху → контакт знову замкнувся й миттєво скинув вузол.",
                        "З 104 пауз у брязкоті нашого стенду 100 коротші за 1,4 мс, тобто такий фільтр їх поглине. Це оцінка зверху, вимір покаже завдання 5.",
                        "Застереження: фронт відпускання стає повільним, а гістерезис входів ESP32-S3 у документації не вказаний. Подивіться цей фронт аналізатором.")):
    text(40, 602 + i * 28, s_, 14, "start", "bold" if i == 2 else "normal", "#7f1d1d" if i == 2 else "#223")
save('rc-curve.svg')

# ===================================================================================== flow
W, H = 1320, 640
begin(W, H, "Шлях однієї події в кожній прошивці")
cols = [("Подія", 190, 170), ("Обробник ISR", 410, 280), ("Між ними", 740, 160), ("Задача app_main", 950, 330)]
for n, x, w in cols: text(x + w / 2, 84, n, 15, "middle", "bold", GREY)
rows = [
 ("raw", "завдання 1", "FALLING", "count++", "volatile", "щоразу, як змінився: друк і LED", ["#eef2f7"]),
 ("time", "завдання 2", "FALLING", "час у чергу", "черга", "t − last < 50 мс → ігнор,\nінакше реакція", []),
 ("state", "завдання 3", "FALLING", "«щось сталося»", "семафор", "чекає 50 мс; LOW → реакція,\nHIGH → нічого", []),
 ("poll", "завдання 4", "таймер тіків", "немає", "немає", "кожні 10 мс читає вивід,\nкрок машини станів", []),
]
for i, (n, sub, ev, isr, mid, task, _) in enumerate(rows):
    y = 110 + i * 112; h = 88
    text(40, y + 38, n, 18, "start", "bold", "#112", True); text(40, y + 60, sub, 12, "start", "normal", GREY)
    rect(190, y, 170, h, "#e8f0fe", BLUE); text(275, y + 50, ev, 14, "middle", "bold")
    none = isr == "немає"
    rect(410, y, 280, h, "#f4f5f7" if none else "#fff4e5", "#b0b8c1" if none else ORANGE, 2, 8, "6 5" if none else ""); text(550, y + 50, isr, 14, "middle", "normal", GREY if none else "#222", not none and n != "state")
    rect(740, y, 160, h, "#f4f5f7" if none else "#f3e8ff", "#b0b8c1" if none else PURPLE, 2, 8, "6 5" if none else ""); text(820, y + 50, mid, 14, "middle", "normal", GREY if none else "#222")
    rect(950, y, 330, h, "#e6f4ea", GREEN)
    for j, l in enumerate(task.split("\n")): text(1115, y + (50 if "\n" not in task else 38) + j * 22, l, 14, "middle")
    if none:
        path([(360, y + 66), (380, y + 66), (380, y + 100), (930, y + 100), (930, y + 66)], 2, TEAL); arrow(930, y + 66, 950, y + 66, TEAL)
    else:
        arrow(360, y + h / 2, 410, y + h / 2, ORANGE); arrow(690, y + h / 2, 740, y + h / 2, PURPLE); arrow(900, y + h / 2, 950, y + h / 2, GREEN)
text(40, 590, "Правило одне: ISR нічого не вирішує. Він лише повідомляє, а чекати, друкувати й думати може задача, бо vTaskDelay() зупиняє тільки її.", 15, "start", "bold", "#112")
save('flow.svg')
print("ok")
