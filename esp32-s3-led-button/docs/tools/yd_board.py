# Shared drawing code for the breadboard diagrams:
# full-size (830-pt) breadboard + VCC-GND Studio YD-ESP32-S3 (ESP32-S3-DevKitC-1 clone, 2 x 22 pins).
#
# The board lies with the antenna to the RIGHT and the USB-C connectors to the LEFT, so
# header J1 (3V3, RST, 4, 5, …) is on top and J3 (G, TX, RX, 1, 2, …) at the bottom.
# Pin 1 of both headers is at the antenna end: pin p sits in breadboard row 23 - p.
import os

W_DEFAULT = 1320
P  = 19                     # hole pitch, px
X0 = 70                     # x of row 1
ROWS = 63
COL  = {'j':140,'i':159,'h':178,'g':197,'f':216,'e':273,'d':292,'c':311,'b':330,'a':349}
RAIL = {'tn':86,'tp':105,'bp':385,'bn':404}     # top -, top +, bottom +, bottom -
def rx(r): return X0 + (r-1)*P

# Silkscreen names, pin 1 = antenna end (see the mischianti.org YD-ESP32-S3 pinout).
J1 = ["3V3","3V3","RST","4","5","6","7","15","16","17","18","8","3","46","9","10","11","12","13","14","5V","G"]
J3 = ["G","TX","RX","1","2","42","41","40","39","38","37","36","35","0","45","48","47","21","20","19","G","G"]
def pin_row(pin): return 23 - pin
def j1_row(name): return pin_row(J1.index(name) + 1)
def j3_row(name): return pin_row(J3.index(name) + 1)


class Svg:
    def __init__(self, w, h):
        self.w, self.h, self.out = w, h, []
        self.add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">')
        self.rect(0, 0, w, h, "#ffffff")

    def add(self, s): self.out.append(s)

    def text(self, x, y, s, size=13, anchor="start", weight="normal", fill="#222", extra=""):
        self.add(f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}" font-weight="{weight}" fill="{fill}" font-family="DejaVu Sans, Arial, sans-serif" {extra}>{s}</text>')

    def line(self, x1, y1, x2, y2, w=2, c="#222", cap="round"):
        self.add(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{c}" stroke-width="{w}" stroke-linecap="{cap}"/>')

    def rect(self, x, y, w, h, fill, stroke="none", sw=1, rxr=0, extra=""):
        self.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rxr}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')

    def hole(self, x, y): self.rect(x-3, y-3, 6, 6, "#9a9a94", rxr=1)

    def wire(self, x1, y1, x2, y2, c, bulge=0):
        # arc between two holes; bulge>0 lifts the middle upward, <0 pushes it down
        self.add(f'<path d="M{x1},{y1} C{x1},{y1-bulge} {x2},{y2-bulge} {x2},{y2}" fill="none" stroke="{c}" stroke-width="4.5" stroke-linecap="round"/>')
        for x, y in ((x1, y1), (x2, y2)):
            self.add(f'<circle cx="{x}" cy="{y}" r="3.2" fill="#ddd" stroke="{c}" stroke-width="1.5"/>')

    def save(self, name):
        self.add('</svg>')
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', name)
        open(path, 'w').write("\n".join(self.out))
        print("ok")


def breadboard(s):
    BX0, BX1 = 52, rx(ROWS)+16
    s.rect(BX0, 60, BX1-BX0, 372, "#f5f5f0", "#b8b8b0", 2, 6)
    s.rect(BX0, 236, BX1-BX0, 20, "#e6e6df")                       # center channel
    split_x0, split_x1 = rx(31)-4, rx(32)+4
    for y, c in ((74, "#3b82f6"), (117, "#e11d48"), (373, "#e11d48"), (416, "#3b82f6")):
        s.line(BX0+8, y, split_x0, y, 2, c, "butt"); s.line(split_x1, y, BX1-8, y, 2, c, "butt")
    for r in range(1, ROWS+1):
        x = rx(r)
        for y in COL.values(): s.hole(x, y)
        if r % 6 != 1:                                             # rails have a gap every 6th row
            for y in RAIL.values(): s.hole(x, y)
        if r == 1 or r % 5 == 0: s.text(x, 452, str(r), 10, "middle", "normal", "#666")
    for k, y in COL.items(): s.text(40, y+4, k, 10, "middle", "normal", "#666")
    for y, sign in ((86, "−"), (105, "+"), (385, "+"), (404, "−")): s.text(40, y+4, sign, 12, "middle", "bold", "#666")


def esp32(s, top='h', bot='a', used_top=(), used_bot=(), highlight_boot=False):
    """Draws the YD-ESP32-S3. used_top/used_bot: silkscreen names to emphasise (e.g. "4", "G")."""
    TOP, BOT = COL[top], COL[bot]
    ex0, ex1 = rx(1)-52, rx(22)+38
    mid = lambda f: TOP + f*(BOT-TOP)                              # f: 0 = J1 side, 1 = J3 side
    s.rect(ex0, TOP-10, ex1-ex0, BOT-TOP+20, "#1e1e1e", "#000", 1, 7)
    # WROOM-1 module at the antenna end, antenna trace on the far right
    # (drawn narrower than the real module so the silkscreen labels of pins 1…7 stay readable)
    s.rect(rx(15)+6, TOP+34, ex1-rx(15)-12, BOT-TOP-68, "#8d8d8d", "#555", 1, 3)
    s.text((rx(15)+ex1)/2-10, mid(0.5)+4, "ESP32-S3-WROOM-1", 9, "middle", "bold", "#222")
    ax = ex1-22
    for i in range(3): s.line(ax+i*6, mid(0.38), ax+i*6, mid(0.62), 1.5, "#333")
    # RST / BOOT buttons (closer to J3), RGB LED (closer to J1)
    for row, lbl, hi in ((13.5, "RST", False), (11.4, "BOOT", highlight_boot)):
        x = rx(row)
        s.rect(x-9, mid(0.76)-7, 18, 14, "#333", "#fbc02d" if hi else "#777", 2.5 if hi else 1, 2)
        s.text(x, mid(0.76)-12, lbl, 8 if hi else 7, "middle", "bold" if hi else "normal", "#fbc02d" if hi else "#bbb")
    if highlight_boot: s.text(rx(11.4), mid(0.76)+20, "= GPIO0", 8, "middle", "bold", "#fbc02d")
    s.rect(rx(9)-6, mid(0.3)-6, 12, 12, "#f5f5f5", "#999", 1, 2)
    s.text(rx(9)+10, mid(0.3)+3, "RGB", 7, "start", "normal", "#bbb")
    s.text(rx(6), mid(0.5)+4, "YD-ESP32-S3", 10, "middle", "bold", "#ddd")
    # two USB-C: COM (CH343 UART) on the J1 side, native USB on the J3 side
    for f, lbl, hi in ((0.3, "COM", False), (0.72, "USB", True)):
        s.rect(ex0-20, mid(f)-12, 28, 24, "#c0c0c0", "#fbc02d" if hi else "#666", 2 if hi else 1, 6)
        s.text(ex0+14, mid(f)+4, lbl, 8, "start", "bold", "#fbc02d" if hi else "#ccc")
    # header pins + rotated silkscreen labels
    for pin in range(1, 23):
        r = pin_row(pin)
        s.rect(rx(r)-4, TOP-4, 8, 8, "#d4af37", "#7a5f00", 1)
        s.rect(rx(r)-4, BOT-4, 8, 8, "#d4af37", "#7a5f00", 1)
        for name, used, y, anchor in ((J1[pin-1], used_top, TOP+10, "end"), (J3[pin-1], used_bot, BOT-10, "start")):
            bold = name in used
            s.text(rx(r)+3, y, name, 10 if bold else 7, anchor, "bold" if bold else "normal",
                   "#ffffff" if bold else "#8a8a8a", f'transform="rotate(-90 {rx(r)+3} {y})"')
    for name in used_top:
        for pin, n in enumerate(J1, 1):
            if n == name: s.rect(rx(pin_row(pin))-6, TOP-6, 12, 12, "none", "#fbc02d", 2, 2)
    for name in used_bot:
        for pin, n in enumerate(J3, 1):
            if n == name: s.rect(rx(pin_row(pin))-6, BOT-6, 12, 12, "none", "#fbc02d", 2, 2)


def resistor(s, r1, r2, y, bands, label):
    x1, x2 = rx(r1), rx(r2)
    s.line(x1, y, x1+10, y, 2, "#888"); s.line(x2-10, y, x2, y, 2, "#888")
    s.rect(x1+10, y-7, x2-x1-20, 14, "#e9dcb8", "#7a6a4a", 1.2, 3)
    for i, c in enumerate(bands): s.rect(x1+18+i*9, y-7, 4, 14, c)
    for x in (x1, x2): s.add(f'<circle cx="{x}" cy="{y}" r="2.5" fill="#bbb"/>')
    s.text((x1+x2)/2, 247, label, 11, "middle", "bold", "#333")


def led(s, r, y, color, label, label_color=None):
    xa, xk = rx(r), rx(r+1)
    s.add(f'<circle cx="{(xa+xk)/2}" cy="{y}" r="11" fill="{color}" stroke="#333" stroke-width="1.5"/>')
    s.add(f'<circle cx="{(xa+xk)/2-3}" cy="{y-3}" r="3" fill="#fff" opacity="0.6"/>')
    s.line(xk+9, y-8, xk+9, y+8, 2.5, "#333")                          # flat = cathode side
    s.text(xa-1, y+22, "+", 11, "middle", "bold", "#333"); s.text(xk+2, y+22, "−", 11, "middle", "bold", "#333")
    s.text((xa+xk)/2, 262, label, 11, "middle", "bold", label_color or color)


BANDS_220 = ("#d00", "#d00", "#8b4513")
BANDS_100 = ("#8b4513", "#000", "#8b4513")
