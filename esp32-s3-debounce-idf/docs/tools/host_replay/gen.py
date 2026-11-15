# Writes scenario edge files. Times in µs; lvl is the GPIO7 level after the edge.
import re,json,sys,os
here=sys.argv[1]
src=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','..','..','docs','bounce-bench','index.html'),encoding='utf8').read()
D=json.loads(re.search(r'const DATA = (\[\[.*?\]\]);',src,re.S).group(1))
def press(out,t,gaps=()):    # falling first, then alternating; ends LOW only if an odd number of edges
    lvl=0; out.append((t,0))
    for g in gaps:
        t+=g; lvl^=1; out.append((t,lvl))
    if lvl!=0: t+=50; out.append((t,0))
    return t
def release(out,t,gaps=()):
    lvl=1; out.append((t,1))
    for g in gaps:
        t+=g; lvl^=1; out.append((t,lvl))
    if lvl!=1: t+=50; out.append((t,1))
    return t
def write(name,e):
    open(os.path.join(here,name+'.edges'),'w').write(''.join(f'{t} {l}\n' for t,l in e))
T0=1000000
e=[];t=T0                                   # A: 5 clean presses
for i in range(5):
    t=press(e,t); t=release(e,t+200000); t+=300000
write('A_clean',e)
e=[];t=T0                                   # B: 5 presses, bounce both ways, release bounce has falling edges
for i in range(5):
    t=press(e,t,(200,800,1500,400)); t=release(e,t+300000,(300,500,2000,400)); t+=400000
write('B_bouncy',e)
e=[];t=T0                                   # C: 3 presses of 30 ms: shorter than the 50 ms window
for i in range(3):
    t=press(e,t); t=release(e,t+30000); t+=400000
write('C_short',e)
e=[];t=T0                                   # D: one 2.5 s hold, then one 200 ms press
t=press(e,t); t=release(e,t+2500000); t+=400000
t=press(e,t); t=release(e,t+200000)
write('D_long',e)
e=[];t=T0;n=0                               # E: the real 190 events: P held 200 ms, then R, gap 300 ms; G inside the hold
i=0
while i<len(D):
    k,edges,g,m,st=D[i]
    if k=='P':
        t=press(e,t,tuple(g)); t+=100000
        j=i+1
        while j<len(D) and D[j][0]=='G':
            gg=D[j][2]; hi=D[j][4]
            if hi==0:                       # pulse from LOW while held
                t0=t; lvl=0
                e.append((t,1)); lvl=1
                for x in gg: t+=x; lvl^=1; e.append((t,lvl))
                if lvl==1: t+=50; e.append((t,0))
            t+=50000; j+=1
        i=j; t+=100000
        if i<len(D) and D[i][0]=='R':
            t=release(e,t,tuple(D[i][2])); i+=1
        t+=300000; n+=1
    else:
        i+=1
print('real presses',n); write('E_real',e)
