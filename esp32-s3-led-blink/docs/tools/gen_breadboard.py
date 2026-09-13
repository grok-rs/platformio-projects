import os
# Generates docs/breadboard.svg — physical layout on a full-size (830-pt) breadboard
import math
W, H = 1320, 700
P  = 19                     # hole pitch, px
X0 = 70                     # x of row 1
ROWS = 63
COL  = {'j':140,'i':159,'h':178,'g':197,'f':216,'e':273,'d':292,'c':311,'b':330,'a':349}
RAIL = {'tn':86,'tp':105,'bp':385,'bn':404}     # top -, top +, bottom +, bottom -
def rx(r): return X0 + (r-1)*P

out=[]
def add(s): out.append(s)
def text(x,y,s,size=13,anchor="start",weight="normal",fill="#222",extra=""):
    add(f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}" font-weight="{weight}" fill="{fill}" font-family="DejaVu Sans, Arial, sans-serif" {extra}>{s}</text>')
def line(x1,y1,x2,y2,w=2,c="#222",cap="round"):
    add(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{c}" stroke-width="{w}" stroke-linecap="{cap}"/>')
def rect(x,y,w,h,fill,stroke="none",sw=1,rxr=0,extra=""):
    add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rxr}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')
def hole(x,y): rect(x-3,y-3,6,6,"#9a9a94",rxr=1)
def wire(x1,y1,x2,y2,c,bulge=0):
    # arc between two holes; bulge>0 lifts the middle upward
    add(f'<path d="M{x1},{y1} C{x1},{y1-bulge} {x2},{y2-bulge} {x2},{y2}" fill="none" stroke="{c}" stroke-width="4.5" stroke-linecap="round"/>')
    for x,y in ((x1,y1),(x2,y2)): add(f'<circle cx="{x}" cy="{y}" r="3.2" fill="#ddd" stroke="{c}" stroke-width="1.5"/>')

add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
rect(0,0,W,H,"#ffffff")
text(20,34,"Макетна плата: ESP32-S3-DevKitC-1 + 3 світлодіоди (режим двох GPIO, SINGLE_GPIO_MODE = 0)",19,"start","bold","#112")

# ---------------- breadboard ----------------
BX0, BX1 = 52, rx(ROWS)+16
rect(BX0,60,BX1-BX0,372,"#f5f5f0","#b8b8b0",2,6)
rect(BX0,236,BX1-BX0,20,"#e6e6df")                       # center channel
split_x0, split_x1 = rx(31)-4, rx(32)+4
for y,c in ((74,"#3b82f6"),(117,"#e11d48"),(373,"#e11d48"),(416,"#3b82f6")):
    line(BX0+8,y,split_x0,y,2,c,"butt"); line(split_x1,y,BX1-8,y,2,c,"butt")
for r in range(1,ROWS+1):
    x=rx(r)
    for y in COL.values(): hole(x,y)
    if r%6!=1:
        for y in RAIL.values(): hole(x,y)
    if r==1 or r%5==0: text(x,452,str(r),10,"middle","normal","#666")
for k,y in COL.items(): text(40,y+4,k,10,"middle","normal","#666")
for k,y,s in (("tn",86,"−"),("tp",105,"+"),("bp",385,"+"),("bn",404,"−")): text(40,y+4,s,12,"middle","bold","#666")
text(rx(31)+9,131,"розрив шини",9,"middle","normal","#b91c1c")

# ---------------- ESP32-S3 (top header in column h, bottom in column a) ----------------
TOP, BOT = COL['h'], COL['a']
ex0, ex1 = rx(1)-52, rx(21)+38
rect(ex0,TOP-10,ex1-ex0,BOT-TOP+20,"#1e1e1e","#000",1,7)
rect(rx(12),TOP+22,ex1-rx(12)-6,BOT-TOP-44,"#8d8d8d","#555",1,3)      # WROOM module
text((rx(12)+ex1)/2-3,(TOP+22+BOT-22)/2+4,"ESP32-S3-WROOM-1",10,"middle","bold","#222")
ax=ex1-40
for i in range(4): line(ax+i*8,TOP+30,ax+i*8,TOP+50,1.5,"#333")
line(ax,TOP+30,ax+24,TOP+30,1.5,"#333")
for r in range(1,22):
    rect(rx(r)-4,TOP-4,8,8,"#d4af37","#7a5f00",1)
    rect(rx(r)-4,BOT-4,8,8,"#d4af37","#7a5f00",1)
top_names={21:"3V3",20:"GPIO12",19:"GPIO11",18:"GPIO10",17:"GPIO9",16:"GPIO46",15:"GPIO3",14:"GPIO20",13:"GPIO19",12:"GPIO8",11:"GPIO18",10:"GPIO17",9:"GPIO16",8:"GPIO15",7:"GPIO7",6:"GPIO6",5:"GPIO5",4:"GPIO4",3:"RST",2:"3V3",1:"GND"}
used={1,2,4,5,6,7}
for pin,name in top_names.items():
    r=22-pin
    bold = pin in used
    text(rx(r)+3,TOP+18,name,8 if not bold else 9,"end","bold" if bold else "normal","#ffffff" if bold else "#8a8a8a",f'transform="rotate(-90 {rx(r)+3} {TOP+18})"')
# USB connectors overhanging the edge
for y,lbl in ((TOP+30,"USB"),(BOT-46,"UART")):
    rect(ex0-22,y,30,18,"#c0c0c0","#666",1,4); text(ex0-7,y+31,lbl,8,"middle","bold","#ccc")
rect(rx(8)-8,TOP+40,16,12,"#333","#777",1,2); text(rx(8),TOP+66,"RST",7,"middle","normal","#bbb")
rect(rx(10)-8,TOP+40,16,12,"#333","#777",1,2); text(rx(10),TOP+66,"BOOT",7,"middle","normal","#bbb")
text((ex0+rx(11))/2,BOT-26,"ESP32-S3-DevKitC-1",10,"middle","bold","#ddd")

# ---------------- components ----------------
def resistor(r1,r2,y,bands,label):
    x1,x2=rx(r1),rx(r2)
    line(x1,y,x1+10,y,2,"#888"); line(x2-10,y,x2,y,2,"#888")
    rect(x1+10,y-7,x2-x1-20,14,"#e9dcb8","#7a6a4a",1.2,3)
    for i,c in enumerate(bands): rect(x1+18+i*9,y-7,4,14,c)
    for x in (x1,x2): add(f'<circle cx="{x}" cy="{y}" r="2.5" fill="#bbb"/>')
    text((x1+x2)/2,247,label,11,"middle","bold","#333")
def led(r,y,color,label):
    xa,xk=rx(r),rx(r+1)
    add(f'<circle cx="{(xa+xk)/2}" cy="{y}" r="11" fill="{color}" stroke="#333" stroke-width="1.5"/>')
    add(f'<circle cx="{(xa+xk)/2-3}" cy="{y-3}" r="3" fill="#fff" opacity="0.6"/>')
    line(xk+9,y-8,xk+9,y+8,2.5,"#333")           # flat = cathode side
    text(xa-1,y+22,"+",11,"middle","bold","#333"); text(xk+2,y+22,"−",11,"middle","bold","#333")
    text((xa+xk)/2,262,label,11,"middle","bold",color)

RED,BLUE,GREEN,BLK="#d32f2f","#1976d2","#2e7d32","#222"
circuits=[(18,27,RED,  ("#d00","#d00","#8b4513"),"R1 220 Ω","D1 червоний ← GPIO4"),
          (17,35,BLUE, ("#8b4513","#000","#8b4513"),"R2 100 Ω","D2 синій ← GPIO5"),
          (16,43,GREEN,("#d00","#d00","#8b4513"),"R3 220 Ω","D3 зелений ← GPIO6")]
for src,dst,col,bands,rl,dl in circuits:
    resistor(dst,dst+4,COL['i'],bands,rl)
    led(dst+4,COL['h'],col,dl)
    wire(rx(dst+5),COL['j'],rx(dst+5),RAIL['tn'],BLK)              # cathode -> GND rail
for src,dst,col,bands,rl,dl in circuits:
    wire(rx(src),COL['j'],rx(dst),COL['j'],col,bulge=40+ (dst-src)*2.2)   # GPIO -> resistor
wire(rx(21),COL['j'],rx(21),RAIL['tn'],BLK)                          # ESP32 GND -> rail
wire(rx(30),RAIL['tn'],rx(33),RAIL['tn'],BLK,bulge=30)               # bridge the split rail
text(rx(31)+9,48,"перемичка через розрив",9,"middle","normal","#b91c1c")
text(rx(21),74-6,"GND",9,"middle","bold","#222")
rect(rx(22),COL['e']+4,rx(59)-rx(22),46,"#ffffff","#b91c1c",1.2,5,'opacity="0.96"')
text(rx(40),COL['e']+22,"Шина «+» (червона лінія) у цій схемі не використовується:",12,"middle","bold","#b91c1c")
text(rx(40),COL['e']+40,"«плюс» для кожного світлодіода дає сам вивід GPIO (HIGH = 3.3 В), тому потрібна лише шина «−» (GND).",12,"middle","normal","#b91c1c")

# ---------------- notes ----------------
ny=500
def note(n,s,dy,bold=False): text(20,ny+dy,s,13,"start","bold" if bold else "normal","#222")
note(1,"1.  ESP32 ставимо через центральний канал так, щоб над верхнім рядом (GND, 3V3, GPIO4–7) лишалося 1–2 вільні отвори; USB-роз'єми звисають за край.",0)
note(2,"2.  Світлодіод: довга ніжка (+) — до резистора (і далі до GPIO), коротка ніжка (−, зріз на корпусі) — чорною перемичкою на шину «−».",24)
note(3,"3.  Чорна перемичка GND: вивід GND ESP32 (pin 1) → шина «−». На повнорозмірній макетці шина часто розірвана посередині — з'єднати половини перемичкою.",48)
note(4,"4.  Живлення всієї схеми — один USB-кабель у роз'єм «USB» ESP32 (не «UART»); через нього ж іде прошивка та Serial-монітор. Модуль живлення макетки не потрібен.",72,True)
note(5,"5.  Струм світлодіодів (≈5 мА кожен через 220/100 Ω) віддає сам вивід GPIO (HIGH = 3.3 В), тому зовнішнє живлення для них зайве.",96)
note(6,"6.  Режим одного GPIO (єдиний випадок, де потрібна шина «+»): 3V3 ESP32 (pin 2) → шина «+» → 100 Ω → анод синього, катод синього — у ряд GPIO7; червоний — як D1, але від GPIO7.",120)
# legend
lx=20; ly=ny+156
for c,l,dx in ((RED,"GPIO4 → R1",0),(BLUE,"GPIO5 → R2",130),(GREEN,"GPIO6 → R3",260),(BLK,"GND",390)):
    line(lx+dx,ly,lx+dx+28,ly,4.5,c); text(lx+dx+36,ly+4,l,12)

add('</svg>')
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'breadboard.svg'), 'w').write("\n".join(out))
print("ok")
