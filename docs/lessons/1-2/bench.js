/* Lesson 1-2: LED data shared with the inline page script (window.L12), the interactive bench (LED + resistor with a
   live I–V chart, junction temperature and a burn-out), the «why it burns» explainer and the idea-card interactives.
   Loaded with defer after study.js; the widgets wait for study:ready. Motion goes through Study.sim / Study.anim only. */
(function () {
  'use strict';
  /* ---------- LED data (facts: led-*-3mm-vf, led-yellow-3mm-vf, led-test-current-vs-rating, led-3mm-tj-by-colour)
     vf/vmax at test current `at` (A); imax = DC absolute maximum (A); pd = power abs. max (W); tj = junction max (°C);
     rth = junction–ambient (°C/W). n, rs: shape of the simplified model. The white WP7104QWC/D datasheet gives no Rth:
     the blue (same InGaN die family) is reused as an estimate. */
  const LED = {
    red:    { nm: 'червоний', vf: 1.9,  vmax: 2.3, at: 0.010, imax: 0.030, pd: 0.075,  tj: 125, rth: 680, n: 0.045, rs: 8,  hex: '#e5392f' },
    yellow: { nm: 'жовтий',   vf: 1.95, vmax: 2.4, at: 0.010, imax: 0.030, pd: 0.075,  tj: 110, rth: 690, n: 0.045, rs: 8,  hex: '#f2c21b' },
    green:  { nm: 'зелений',  vf: 2.2,  vmax: 2.5, at: 0.020, imax: 0.025, pd: 0.0625, tj: 110, rth: 680, n: 0.05,  rs: 10, hex: '#2fb84a' },
    blue:   { nm: 'синій',    vf: 3.3,  vmax: 4.0, at: 0.020, imax: 0.030, pd: 0.120,  tj: 115, rth: 640, n: 0.09,  rs: 12, hex: '#2f6fe5' },
    white:  { nm: 'білий',    vf: 3.3,  vmax: 4.0, at: 0.020, imax: 0.030, pd: 0.120,  tj: 115, rth: 640, n: 0.09,  rs: 12, hex: '#eef2f5' },
  };
  const vOf = (m, I) => m.vf + (m.dv || 0) + m.n * Math.log(I / m.at) + m.rs * (I - m.at);
  // Operating point: Vs = V_LED(I) + R·I, solved by bisection on a log scale.
  function opPoint(m, vs, R) {
    let lo = 1e-12, hi = 5;
    for (let k = 0; k < 120; k++) { const mid = Math.sqrt(lo * hi); if (vOf(m, mid) + R * mid > vs) hi = mid; else lo = mid; }
    return lo;
  }
  window.L12 = { LED, vOf, opPoint };

  document.addEventListener('study:ready', () => {
    const { $, $$, fmt } = Study;
    const NS = 'http://www.w3.org/2000/svg';
    const mk = (tag, attrs = {}, parent = null) => {
      const n = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      if (parent) parent.appendChild(n);
      return n;
    };
    const reduced = () => Study.reducedMotion();
    const hide = (sel, on) => $(sel).toggleAttribute('hidden', !!on);
    const segBind = (sel, fn) => $$(sel + ' button').forEach((b) => b.addEventListener('click', () => {
      $$(sel + ' button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      fn(b.dataset.v, b);
    }));
    const mA = (I) => (I >= 0.1 ? fmt.num(I * 1000, 0) : fmt.num(I * 1000, I < 0.001 ? 2 : 1)) + ' мА';
    const mW = (P) => (P >= 1 ? fmt.num(P, 2) + ' Вт' : fmt.num(P * 1000, P < 0.01 ? 1 : 0) + ' мВт');
    const smooth = (p) => (p <= 0 ? 0 : p >= 1 ? 1 : p * p * (3 - 2 * p));

    /* particles: flash, sparks, smoke */
    function fxLayer(g) {
      const ps = [];
      return {
        burst(x, y, kind) {
          if (kind === 'flash') ps.push({ k: 'flash', x, y, t: 0, life: 0.5 });
          if (kind === 'sparks') for (let i = 0; i < 16; i++) {
            const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 120;
            ps.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, t: 0, life: 0.35 + Math.random() * 0.35 });
          }
          if (kind === 'smoke') for (let i = 0; i < 11; i++) {
            ps.push({ k: 'smoke', x: x + (Math.random() - 0.5) * 12, y, vx: (Math.random() - 0.3) * 16, vy: -22 - Math.random() * 22, t: -i * 0.18, life: 2 });
          }
        },
        step(dt) {
          g.textContent = '';
          for (let i = ps.length - 1; i >= 0; i--) {
            const p = ps[i];
            p.t += dt;
            if (p.t > p.life) { ps.splice(i, 1); continue; }
            if (p.t < 0) continue;
            const q = p.t / p.life;
            if (p.k === 'flash') mk('circle', { cx: p.x, cy: p.y, r: 12 + 60 * q, fill: '#fff3b0', opacity: ((1 - q) * 0.95).toFixed(2) }, g);
            if (p.k === 'spark') {
              p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt;
              mk('circle', { cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: 2.3, fill: q < 0.5 ? '#fff1a8' : '#ffad33', opacity: (1 - q).toFixed(2) }, g);
            }
            if (p.k === 'smoke') {
              p.x += p.vx * dt; p.y += p.vy * dt;
              mk('circle', { cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: (5 + 16 * q).toFixed(1), fill: '#8c949a', opacity: (0.62 * (1 - q)).toFixed(2) }, g);
            }
          }
        },
        get busy() { return ps.length > 0; },
        clear() { ps.length = 0; g.textContent = ''; },
      };
    }
    function dotsOn(g, path, spacing = 24) {
      let off = 0, n = 0, L = 0;
      const sync = () => {
        if (L) return;
        L = path.getTotalLength();
        n = Math.max(1, Math.floor(L / spacing));
        for (let i = 0; i < n; i++) mk('circle', { r: 3.2 }, g);
      };
      return {
        step(dt, speed) {
          sync();
          off = (off + dt * speed) % L;
          g.style.display = speed > 0 ? '' : 'none';
          if (!(speed > 0)) return;
          [...g.children].forEach((c, k) => {
            const p = path.getPointAtLength((off + k * L / n) % L);
            c.setAttribute('cx', p.x.toFixed(1)); c.setAttribute('cy', p.y.toFixed(1));
          });
        },
      };
    }
    const flowSpeed = (I) => (I < 2e-5 ? 0 : 14 * Math.log2(1 + I * 1000) + 6);
    // Tint a colour for the glow (white LED glows bluish-white so it reads on the light sheet).
    const glowHex = (m) => (m === LED.white ? '#cfe3ff' : m.hex);

    /* ---------- the real circuit on a breadboard (Kit parts, Kit units): the left end of the WB-102 with the MB102 in its
       rails (columns 4–5) or the leads of an external 12 V supply in the same rails; tidy layout in the lower half on the
       bottom rails: red jumper j13 → «+», R1 h13–h17 (bands of the chosen E12 value; R = 0 → a yellow jumper), LED1 anode
       f17 / cathode f18, black jumper j18 → «−». Only rows c…j are shown (the upper half is empty), the board fades out after
       column 22. `host` is a <g> scaled by k and shifted by (ox, oy) inside the page SVG. */
    function realBench(host, k, ox, oy) {
      const K = window.Kit, P = K.P;
      const defs = mk('defs', {}, host);
      mk('rect', { x: -110, y: 150, width: 760, height: 440 }, mk('clipPath', { id: 'lb-real-clip' }, defs));
      const fade = mk('linearGradient', { id: 'lb-real-fade-g', gradientUnits: 'userSpaceOnUse', x1: 22.6 * P, x2: 24.2 * P, y1: 0, y2: 0 }, defs);
      mk('stop', { offset: 0, 'stop-color': '#fff' }, fade); mk('stop', { offset: 1, 'stop-color': '#000' }, fade);
      mk('rect', { x: -600, y: -600, width: 3200, height: 2000, fill: 'url(#lb-real-fade-g)' },
        mk('mask', { id: 'lb-real-fade', maskUnits: 'userSpaceOnUse', x: -600, y: -600, width: 3200, height: 2000 }, defs));
      const g = mk('g', { 'clip-path': 'url(#lb-real-clip)' }, host);
      const bb = K.part('breadboard', { parent: mk('g', { mask: 'url(#lb-real-fade)' }, g), title: 'Макетна плата' });
      const pmAt = bb.rail('top', '+', 4);
      const pm = K.part('power-module', { parent: g, x: pmAt.x, y: pmAt.y, title: 'Модуль живлення MB-102' });
      // 12 V: the supply's leads come in from the left along the bottom rails and end in their first holes
      const ext = mk('g', {}, g);
      for (const [sg, col] of [['+', 'red'], ['-', 'black']]) { const r = bb.rail('bottom', sg, 4); K.route(ext, [{ x: -90, y: r.y }, r], col, { ends: ['none', 'ring'] }); }
      const lbl = mk('text', { x: pm.pins['B+'].x + P / 2, y: 21 * P + 44, 'text-anchor': 'middle', fill: 'var(--ink)', style: 'font:600 27px var(--f-body)' }, host);
      const H = (c, r) => bb.hole(c, r);
      K.route(g, [bb.at('bottom+13'), bb.at('j13')], 'red');
      const rG = mk('g', {}, g), lG = mk('g', {}, g);
      K.route(g, [bb.at('j18'), bb.at('bottom-18')], 'black');
      let res = null, led = null, key = '', ledKey = '';
      const la = H(17, 'f');
      const api = {
        set(s) {
          const rk = String(s.R);
          if (rk !== key) {
            key = rk; rG.textContent = '';
            const a = H(13, 'h');
            if (s.R > 0) res = K.part('resistor', { parent: rG, ohms: s.R, x: a.x, y: a.y, title: `R1 ${s.R} Ом` });
            else { res = null; K.route(rG, [a, H(17, 'h')], 'yellow'); }
          }
          if (res) res.set({ heat: s.heat });
          if (s.col !== ledKey) { ledKey = s.col; lG.textContent = ''; led = K.part('led', { parent: lG, color: s.col, x: la.x, y: la.y, leg: 40 }); }
          led.set({ burnt: s.dead });
          const v12 = s.vs > 6;
          pm.style.display = v12 ? 'none' : ''; ext.style.display = v12 ? '' : 'none';
          pm.set({ on: s.on, top: 'OFF', bottom: s.vs === 5 ? '5V' : '3.3V' });
          lbl.textContent = v12 ? 'зовнішні 12 В' : `MB-102 · ${String(s.vs).replace('.', ',')} В`;
          lbl.setAttribute('x', v12 ? -10 : pm.pins['B+'].x + P / 2);
          api.dead = s.dead;
        },
        glow(b) { if (led) led.set({ on: api.dead ? 0 : b, burnt: api.dead }); },
        ledTop() { return { x: ox + k * (la.x + P / 2), y: oy + k * (la.y - 150) }; },
      };
      return api;
    }

    /* =================================================================== LAB */
    (function bench() {
      const circ = $('#lb-circ'), cv = $('#lb-cv');
      if (!circ) return;
      const E12 = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];
      const RS = [0, ...[1, 10, 100].flatMap((d) => E12.map((v) => v * d)), 10000];
      const TA = 25, TAU = 3, TBREAK = 300;
      const st = { on: false, vs: 5, col: 'red', R: 220, dead: false, Tj: TA, Idisp: 0 };
      const fx = fxLayer($('#lb-fx')), dots = dotsOn($('#lb-dots'), $('#lb-path'), 24);
      let dirty = true, lastMsg = '', burntOnce = false;
      const litSafe = new Set(); // colours lit from 5 В at 10–20 мА (mission «every colour»)
      const real = realBench($('#lb-real'), 0.5, 55, 153);

      const m = () => LED[st.col];
      const solve = () => {
        if (!st.on || st.dead) return { I: 0, vl: 0, ur: 0 };
        const I = opPoint(m(), st.vs, st.R), vl = Math.min(st.vs, Math.max(0, vOf(m(), I)));
        return { I, vl, ur: I * st.R };
      };
      const tss = (s) => TA + s.vl * s.I * m().rth;

      function burn() {
        st.dead = true; st.Idisp = 0; burntOnce = true;
        if (!reduced()) { const p = real.ledTop(); fx.burst(p.x, p.y + 10, 'flash'); fx.burst(p.x, p.y, 'sparks'); fx.burst(p.x, p.y - 16, 'smoke'); }
        render();
      }

      function render() {
        const s = solve(), led = m();
        if (st.on && !st.dead && st.vs === 5 && s.I >= 0.010 && s.I <= 0.020) litSafe.add(st.col);
        if (reduced()) { st.Tj = st.on && !st.dead ? tss(s) : TA; st.Idisp = s.I; if (st.Tj >= TBREAK && !st.dead) { burn(); return; } }
        $('#lb-lever').setAttribute('x2', st.on ? 92 : 88); $('#lb-lever').setAttribute('y2', st.on ? 40 : 20);
        $('#lb-vlbl').textContent = fmt.num(st.vs, 1) + ' В';
        const rtxt = st.R ? fmt.si(st.R, 'Ом') : '0 Ом (без R)';
        $('#lb-rlbl').textContent = st.R ? fmt.si(st.R, 'Ом') : 'без R'; $('#lb-rout').textContent = rtxt;
        $('#lb-cname').textContent = led.nm;
        hide('#lb-rshort', st.R > 0);
        // the real parts: supply, R1 with its colour code, the LED of this colour
        real.set({ vs: st.vs, on: st.on, R: st.R, col: st.col, dead: st.dead, heat: Math.min(1, s.ur * s.I / 0.25) });
        ['#lb-gs0', '#lb-gs1', '#lb-gs2'].forEach((id) => $(id).setAttribute('stop-color', glowHex(led)));
        $('#lb-ledsym').style.color = st.dead ? 'var(--muted)' : '';
        hide('#lb-new', !st.dead);
        // readouts
        const pr = s.ur * s.I, br = s.I / led.imax * 100;
        $('#lb-o-i').textContent = mA(s.I); $('#lb-o-i').className = s.I > led.imax ? 'bad' : '';
        $('#lb-o-ur').textContent = fmt.num(s.ur, 2) + ' В';
        $('#lb-o-pr').textContent = mW(pr); $('#lb-o-pr').className = pr > 0.25 ? 'bad' : '';
        $('#lb-o-br').textContent = st.dead ? '0 %' : br > 100 ? 'понад 100 %' : fmt.num(br, 0) + ' %';
        $('#lb-heat').setAttribute('opacity', Math.min(0.95, pr / 0.25).toFixed(2));
        // thermometer max mark (per colour)
        const tx = (T) => 242 + Math.min(1, (T - TA) / (TBREAK - TA)) * 106;
        $('#lb-thmax').setAttribute('d', `M${tx(led.tj)} 224V244`);
        const msg = note(s);
        if (msg !== lastMsg) { $('#lb-note').textContent = msg; lastMsg = msg; }
        dirty = true;
        sim.draw();
      }

      function note(s) {
        const led = m(), T = tss(s);
        if (st.dead) return `Пах! Кристал перегрівся й згорів: тепер LED — розрив, струму немає. Натисніть «Нова LED» і поставте резистор більший.`;
        if (!st.on) return 'Живлення вимкнене. Увімкніть його перемикачем.';
        const head = st.vs - led.vf;
        let t;
        if (T > led.tj) t = `Перегрів! ${mA(s.I)}: кристал іде до ≈ ${T > 300 ? 'понад 300' : fmt.num(T, 0)} °C, а межа ${led.nm === 'червоний' ? 'червоного' : 'цього кольору'} — ${led.tj} °C.`;
        else if (s.I > led.imax) t = `${mA(s.I)} — понад абсолютний максимум ${fmt.num(led.imax * 1000, 0)} мА: світить яскраво, але швидко старіє.`;
        else if (s.I < 0.0002) t = `Майже темно: ${mA(s.I)}. ${head < 0.5 ? 'Від цього джерела майже не лишається «зайвої» напруги для резистора.' : 'Резистор завеликий.'}`;
        else if (s.I < 0.005) t = `Світить як індикатор: ${mA(s.I)}.`;
        else t = `Добре: ${mA(s.I)}, у межах даташита.`;
        if (st.R === 0) t += ' Без резистора струм задає лише V_f екземпляра — випадковість.';
        else t += ` На R1 ${fmt.num(s.ur, 2)} В, тож I ≈ ${fmt.num(s.ur, 2)} / ${fmt.si(st.R, 'Ом')}.`;
        if (s.ur * s.I > 0.25) t += ' Резистор розсіює понад 0,25 Вт і перегрівається.';
        return t;
      }

      function plot() {
        const t = Study.tokens(), led = m();
        const ctx = Study.fitCanvas(cv);
        const W = ctx.w, H = ctx.h, L = 46, R = 12, T = 26, B = 34;
        const xmax = st.vs <= 3.3 ? 4.5 : st.vs <= 5 ? 5.5 : 12.5, ymax = 0.04;
        const px = (v) => L + v / xmax * (W - L - R), py = (i) => H - B - i / ymax * (H - T - B);
        ctx.clearRect(0, 0, W, H);
        const mono = t['f-mono'] || 'monospace';
        ctx.font = `13px ${mono}`;
        ctx.fillStyle = t.bad; ctx.globalAlpha = 0.1; ctx.fillRect(L, T, W - L - R, py(led.imax) - T); ctx.globalAlpha = 1;
        ctx.strokeStyle = t.line; ctx.lineWidth = 1; ctx.fillStyle = t.muted;
        const step = xmax > 6 ? 2 : 1;
        for (let v = 0; v <= xmax; v += step) { ctx.beginPath(); ctx.moveTo(px(v), T); ctx.lineTo(px(v), H - B); ctx.stroke(); ctx.textAlign = 'center'; ctx.fillText(String(v), px(v), H - B + 17); }
        for (let i = 0; i <= 0.04001; i += 0.01) { ctx.beginPath(); ctx.moveTo(L, py(i)); ctx.lineTo(W - R, py(i)); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(String(Math.round(i * 1000)), L - 6, py(i) + 4); }
        ctx.textAlign = 'left'; ctx.fillText('I, мА', 4, 15); ctx.textAlign = 'right'; ctx.fillText('U, В', W - R, H - 4);
        ctx.fillStyle = t.bad; ctx.textAlign = 'left'; ctx.fillText(`понад ${fmt.num(led.imax * 1000, 0)} мА`, L + 6, T + 15);
        ctx.save(); ctx.beginPath(); ctx.rect(L, T, W - L - R, H - T - B); ctx.clip();
        const ledCol = led === LED.white ? t.ink : led.hex;
        ctx.strokeStyle = ledCol; ctx.lineWidth = 3; ctx.globalAlpha = st.dead ? 0.35 : 1; ctx.beginPath();
        for (let k = 0; k <= 160; k++) {
          const I = 1e-6 * Math.pow(0.05 / 1e-6, k / 160), v = vOf(led, I);
          if (k === 0) ctx.moveTo(px(Math.max(0, v - 0.6)), py(0));
          ctx.lineTo(px(v), py(I));
        }
        ctx.stroke(); ctx.globalAlpha = 1;
        // load line
        ctx.strokeStyle = t.accent; ctx.lineWidth = 2.5; ctx.setLineDash(st.on ? [] : [6, 5]); ctx.beginPath();
        if (st.R === 0) { ctx.moveTo(px(st.vs), py(0)); ctx.lineTo(px(st.vs), T); }
        else { ctx.moveTo(px(st.vs), py(0)); ctx.lineTo(px(0), py(st.vs / st.R)); }
        ctx.stroke(); ctx.setLineDash([]);
        ctx.restore();
        const lbl = (txt, x, y, col, align = 'left') => {
          const w = ctx.measureText(txt).width; let x0 = align === 'right' ? x - w : x;
          x0 = Math.max(L + 2, Math.min(W - R - w - 2, x0));
          ctx.fillStyle = t.panel; ctx.globalAlpha = 0.9; ctx.fillRect(x0 - 3, y - 13, w + 6, 18); ctx.globalAlpha = 1;
          ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.fillText(txt, x0, y);
        };
        ctx.font = `600 13px ${mono}`;
        lbl(st.R ? `R1 = ${fmt.si(st.R, 'Ом')}` : 'без R', px(st.vs) - 8, H - B - 10, t.accent, 'right');
        lbl(led.nm, px(vOf(led, 0.005)) - 10, py(0.005) - 4, ledCol === '#eef2f5' ? t.ink : (led === LED.yellow ? t['hi-ink'] || t.ink : ledCol), 'right');
        // operating point (eased)
        if (st.on && !st.dead) {
          const I = st.Idisp;
          ctx.fillStyle = t.hi; ctx.strokeStyle = t.ink; ctx.lineWidth = 1.5;
          if (I <= ymax) {
            const ox = px(Math.max(0, vOf(led, Math.max(I, 1e-9)))), oy = py(I);
            ctx.beginPath(); ctx.arc(ox, oy, 7, 0, 7); ctx.fill(); ctx.stroke();
            lbl(mA(I), ox - 12, oy - 10, t.ink, 'right');
          } else {
            const x = Math.min(px(st.vs), W - R - 8);
            ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x - 8, T + 13); ctx.lineTo(x + 8, T + 13); ctx.closePath(); ctx.fill(); ctx.stroke();
            lbl(`↑ ${mA(I)}`, x - 12, T + 32, t.bad, 'right');
          }
        }
        if (st.dead) { ctx.font = `700 16px ${t['f-body'] || 'sans-serif'}`; lbl('✕ LED згорів: струму немає', L + 10, py(0.02), t.bad); }
      }

      const sim = Study.sim(circ, (dt) => {
        const s = solve(), led = m();
        // operating point glides to the new value (log-space), junction temperature follows Tss with τ ≈ 3 с
        const target = s.I;
        if (dt) {
          const a = 1 - Math.exp(-dt * 7);
          const lg = (x) => Math.log(Math.max(x, 1e-7));
          const next = Math.exp(lg(st.Idisp) + (lg(target) - lg(st.Idisp)) * a);
          if (Math.abs(next - st.Idisp) > 1e-9) { st.Idisp = target < 1e-7 && next < 2e-7 ? 0 : next; dirty = true; }
          const Tt = st.on && !st.dead ? tss(s) : TA;
          st.Tj += (Tt - st.Tj) * (1 - Math.exp(-dt / TAU));
          if (!st.dead && st.Tj >= TBREAK) { burn(); return; }
        }
        // glow ∝ the displayed current
        const I = st.dead ? 0 : st.Idisp, g = Math.min(1, I / led.imax);
        $('#lb-glow').setAttribute('opacity', g.toFixed(2));
        $('#lb-glow').setAttribute('r', (24 + 16 * Math.min(1.5, I / led.imax)).toFixed(1));
        real.glow(g);
        const tx = 242 + Math.min(1, (st.Tj - TA) / (TBREAK - TA)) * 106;
        $('#lb-thf').setAttribute('width', Math.max(4, tx - 240).toFixed(1));
        $('#lb-thf').setAttribute('fill', st.Tj > led.tj ? 'var(--bad)' : 'var(--hi)');
        $('#lb-tht').textContent = fmt.num(st.Tj, 0) + ' °C';
        $('#lb-o-tj').textContent = fmt.num(st.Tj, 0) + ' °C';
        $('#lb-o-tj').className = st.Tj > led.tj ? 'bad' : '';
        dots.step(dt, flowSpeed(I));
        fx.step(dt);
        if (dirty) { plot(); dirty = false; }
      });

      segBind('#lb-vs', (v) => { st.vs = +v; render(); });
      segBind('#lb-col', (v) => { st.col = v; st.Tj = Math.min(st.Tj, TA + 5); render(); });
      $('#lb-sw').addEventListener('switch', (e) => { st.on = e.detail.on; if (st.on && !reduced()) sim.play(); render(); });
      $('#lb-r').addEventListener('input', (e) => { st.R = RS[+e.target.value]; render(); });
      $('#lb-new').addEventListener('click', () => { st.dead = false; st.Tj = TA; st.Idisp = 0; fx.clear(); render(); $('#lb-note').textContent = lastMsg = 'Нова LED на місці. Почніть з більшого резистора.'; });
      Study.onTheme(() => { dirty = true; sim.draw(); });
      addEventListener('resize', () => { dirty = true; sim.draw(); });
      render();
      // missions: each check reads the bench state (st) and the steady operating point (solve)
      const safe = (lo, hi) => { const I = solve().I; return st.on && !st.dead && I >= lo && I <= hi; };
      Study.missions($('#lb-ms'), { key: 'bench', items: [
        { id: 'red', text: 'Увімкніть живлення: червоний LED від 5 В має світити безпечним струмом 5–20 мА.', hint: 'Струм видно в показі «Струм». З R1 = 220 Ом виходить ≈ 14 мА.',
          check: () => st.col === 'red' && st.vs === 5 && safe(0.005, 0.020) },
        { id: 'burn', text: 'Спаліть світлодіод навмисно, а потім поставте новий.', hint: 'Зменшуйте R1 до 0 Ом і стежте за термометром Tj: без резистора струм — сотні міліампер, кристал перегрівається за кілька секунд. Потім «Нова LED».',
          check: () => burntOnce && !st.dead },
        { id: 'all', text: 'Засвітіть від 5 В кожен із п\'яти кольорів яскраво й безпечно: 10–20 мА.', hint: 'R = (5 − V<sub>f</sub>) / I. Синьому й білому (V<sub>f</sub> ≈ 3,3 В) лишається лише ≈ 1,7 В, тож їм потрібен менший R1, ніж червоному: з 220 Ом вони світять слабше.',
          check: () => litSafe.size === Object.keys(LED).length },
        { id: 'e12', text: 'Від 12 В підберіть для червоного LED резистор із ряду E12 на 10 мА: найближчий більший за розрахунок.', hint: 'R = (12 − 1,9) В / 0,010 А ≈ 1010 Ом. Такого номіналу в E12 немає; округлюйте вгору, щоб струм не перевищив розрахунковий.',
          check: () => st.on && !st.dead && st.vs === 12 && st.col === 'red' && st.R === 1200 },
      ] });
    })();

    /* =================================================================== ANIM: why an LED without a resistor burns */
    (function explainer() {
      const fig = $('#lb-anim');
      if (!fig) return;
      const red = LED.red, X0 = 50, X1 = 320, Y0 = 220, Y1 = 20, VMAX = 5.5, IMAX = 0.04;
      const px = (v) => X0 + v / VMAX * (X1 - X0), py = (i) => Y0 - Math.min(i, IMAX * 1.02) / IMAX * (Y0 - Y1);
      const iAt = (v) => { let lo = 1e-12, hi = 5; for (let k = 0; k < 100; k++) { const mid = Math.sqrt(lo * hi); if (vOf(red, mid) > v) hi = mid; else lo = mid; } return lo; };
      const I19 = iAt(1.9), I21 = iAt(2.1), I0 = opPoint(red, 5, 0), V0 = vOf(red, I0), P0 = V0 * I0;
      const I220 = opPoint(red, 5, 220), V220 = vOf(red, I220), T220 = 25 + V220 * I220 * red.rth;
      const RR = 100; // the demo resistor line: I = U / 100 Ом
      // grid and axis labels
      const grid = $('#la-grid');
      for (let v = 0; v <= 5; v++) {
        mk('path', { d: `M${px(v)} ${Y0}V${Y1}`, stroke: 'var(--line)', 'stroke-width': 1 }, grid);
        mk('text', { class: 'la-ax', x: px(v), y: Y0 + 17, 'text-anchor': 'middle' }, grid).textContent = v;
      }
      for (let i = 0; i <= 40; i += 10) {
        mk('path', { d: `M${X0} ${py(i / 1000)}H${X1}`, stroke: 'var(--line)', 'stroke-width': 1 }, grid);
        mk('text', { class: 'la-ax', x: X0 - 6, y: py(i / 1000) + 4, 'text-anchor': 'end' }, grid).textContent = i;
      }
      mk('text', { class: 'la-ax', x: X0 - 6, y: 12, 'text-anchor': 'end' }, grid).textContent = 'I, мА';
      mk('text', { class: 'la-ax', x: X1, y: Y0 + 34, 'text-anchor': 'end' }, grid).textContent = 'U, В';
      $('#la-zone').setAttribute('height', py(red.imax) - Y1);
      // the LED curve as points (U, I) up to the top of the chart
      const curve = [];
      for (let k = 0; k <= 140; k++) { const I = 1e-6 * Math.pow(IMAX * 1.02 / 1e-6, k / 140); curve.push([vOf(red, I), I]); }
      const curveD = (frac) => {
        const n = Math.max(1, Math.round(curve.length * frac));
        let d = `M${px(0)} ${py(0)}H${px(Math.max(0, curve[0][0]))}`;
        for (let k = 0; k < n; k++) d += `L${px(curve[k][0]).toFixed(1)} ${py(curve[k][1]).toFixed(1)}`;
        return d;
      };
      const resD = (frac) => { const v = Math.min(4, 4 * frac); return `M${px(0)} ${py(0)}L${px(v)} ${py(v / RR)}`; };
      const pts = $('#la-pts'), fx = fxLayer($('#la-fx'));
      const dot = (x, y, col = 'var(--hi)') => mk('circle', { cx: x, cy: y, r: 6.5, fill: col, stroke: 'var(--ink)', 'stroke-width': 1.5 }, pts);
      const t1 = $('#la-t1'), t2 = $('#la-t2');
      const say = (el, txt, x, y, anchor = 'start') => { el.textContent = txt; el.setAttribute('x', x); el.setAttribute('y', y); el.setAttribute('text-anchor', anchor); };
      const tx = (T) => 352 + Math.min(1, (T - 25) / 275) * 110;
      $('#la-tjm').setAttribute('d', `M${tx(125)} 204V224`); $('#la-tjt').setAttribute('x', tx(125));
      const kled = window.Kit.part('led', { parent: $('#la-kled'), color: 'red', title: 'Червоний світлодіод 5 мм' });
      const ledState = (glow, T, dead) => {
        $('#la-glow').setAttribute('opacity', (glow * 0.5).toFixed(2));
        kled.set({ on: dead ? 0 : glow, burnt: dead });
        $('#la-merc').setAttribute('width', Math.max(2, tx(T) - 348).toFixed(1));
        $('#la-tnow').textContent = 'Tj ' + (T >= 300 ? 'понад 300' : fmt.num(T, 0)) + ' °C';
      };
      let burst = false, lastT = 0;
      const n0 = (x) => fmt.num(x * 1000, 0);
      Study.anim(fig, {
        steps: [
          { title: 'Резистор — пряма', cap: 'Спершу резистор (тут 100&nbsp;Ом): струм росте <b>рівномірно</b>. Подвоїли напругу — подвоївся струм.', dur: 3.5 },
          { title: 'LED — «коліно»', cap: 'Червоний LED: до ≈&nbsp;1,7&nbsp;В струму майже немає, а після <b>«коліна»</b> крива злітає майже вертикально.', dur: 4 },
          { title: '+0,2 В', cap: `Додали лише 0,2&nbsp;В (1,9 → 2,1&nbsp;В) — струм зріс з ${n0(I19)} до ≈&nbsp;${n0(I21)}&nbsp;мА, <b>утричі</b>. Малий зсув напруги — величезна зміна струму.`, dur: 4.5 },
          { title: 'Без резистора', cap: `Тепер LED просто на 5&nbsp;В. Робоча точка там, де крива дійде до 5&nbsp;В — <b>сотні міліампер</b> (за моделлю ≈&nbsp;${n0(I0)}&nbsp;мА). Обмежує лише крихітний опір кристала.`, dur: 4 },
          { title: 'Кристал горить', cap: `P = U·I ≈ ${fmt.num(P0, 1)}&nbsp;Вт, а кожен ват гріє кристал на 680&nbsp;°C. Межа 125&nbsp;°C минає за мить — <b>спалах, дим, темрява</b>.`, dur: 4.5 },
          { title: 'Резистор рятує', cap: `З R&nbsp;=&nbsp;220&nbsp;Ом пряма навантаження перетинає криву при ≈&nbsp;<b>${fmt.num(I220 * 1000, 0)}&nbsp;мА</b>: зайву напругу забирає резистор, кристал лише ≈&nbsp;${fmt.num(T220, 0)}&nbsp;°C.`, dur: 4.5 },
        ],
        draw(i, p, t) {
          const dt = Math.max(0, Math.min(0.1, t - lastT)); lastT = t;
          pts.textContent = ''; say(t1, '', 0, 0); say(t2, '', 0, 0);
          $('#la-band').setAttribute('d', '');
          $('#la-load').setAttribute('d', '');
          $('#la-res').setAttribute('d', resD(i === 0 ? smooth(p / 0.6) : 1));
          $('#la-led').setAttribute('d', i === 0 ? '' : curveD(i === 1 ? smooth(p / 0.7) : 1));
          let glow = 0, T = 25, dead = false;
          if (i === 0) {
            const v = 4 * smooth(p / 0.6); dot(px(v), py(v / RR));
            say(t1, `${fmt.num(v, 1)} В → ${fmt.num(v / RR * 1000, 0)} мА`, px(v) + 10, py(v / RR) + 5);
          }
          if (i === 1) {
            const k = Math.min(curve.length - 1, Math.round((curve.length - 1) * smooth(p / 0.7))), [v, I] = curve[k];
            dot(px(v), py(I), 'var(--bad)'); glow = Math.min(1, I / 0.03);
            say(t1, '«коліно»', px(2.15), py(0.004));
          }
          if (i === 2) {
            const g = smooth(p / 0.5), v = 1.9 + 0.2 * g, I = iAt(v);
            $('#la-band').setAttribute('d', `M${px(1.9)} ${Y0}V${Y1}H${px(2.1)}V${Y0}Z`);
            dot(px(1.9), py(I19), 'var(--muted)'); dot(px(v), py(I), 'var(--bad)'); glow = Math.min(1, I / 0.03);
            say(t1, `${n0(I19)} мА`, px(2.1) + 12, py(I19) + 5);
            say(t2, `${n0(I)} мА`, px(v) + 10, py(I) + 5);
          }
          if (i === 3) {
            const g = smooth(p / 0.5);
            $('#la-load').setAttribute('d', `M${px(5)} ${Y0}V${Y0 - (Y0 - Y1) * g}`);
            say(t1, 'без R: 5 В', px(5) - 8, Y0 - 10, 'end');
            if (g >= 1) { say(t2, `↑ ≈ ${n0(I0)} мА`, px(5) - 8, Y1 + 16, 'end'); }
            glow = 1; T = 25 + (Math.min(P0 * red.rth, 400)) * smooth(p) * 0.2;
            burst = false;
          }
          if (i === 4) {
            $('#la-load').setAttribute('d', `M${px(5)} ${Y0}V${Y1}`);
            say(t2, `↑ ≈ ${n0(I0)} мА`, px(5) - 8, Y1 + 16, 'end');
            T = 25 + Math.min(330, P0 * red.rth) * smooth(p / 0.6);
            dead = T >= 300; glow = dead ? 0 : 1;
            if (dead && !burst) { burst = true; fx.burst(398, 100, 'flash'); fx.burst(398, 96, 'sparks'); fx.burst(398, 76, 'smoke'); }
            if (!dead && burst) { burst = false; fx.clear(); }
          }
          if (i === 5) {
            if (burst) { burst = false; fx.clear(); }
            const g = smooth(p / 0.4);
            $('#la-load').setAttribute('d', `M${px(5)} ${py(0)}L${px(5 - 5 * g)} ${py(5 / 220 * g)}`);
            if (g >= 1) { dot(px(V220), py(I220)); say(t1, `≈ ${fmt.num(I220 * 1000, 0)} мА`, px(V220) + 12, py(I220) - 12); }
            say(t2, 'R = 220 Ом', px(4.1), py(0.012), 'middle');
            glow = g >= 1 ? 0.75 : 0; T = 25 + (T220 - 25) * g;
          }
          ledState(glow, T, dead);
          fx.step(dt);
        },
      });
    })();

    /* =================================================================== idea cards */
    const red = LED.red;
    const iAtV = (m, v) => { let lo = 1e-12, hi = 5; for (let k = 0; k < 100; k++) { const mid = Math.sqrt(lo * hi); if (vOf(m, mid) > v) hi = mid; else lo = mid; } return lo; };
    // 1: a resistor line and the LED curve under one voltage slider
    (function ixIV() {
      if (!$('#ix-iv')) return;
      const X = (u) => 30 + 80 * u, Y = (ma) => 150 - 3.25 * Math.min(ma, 44), RR = 68;
      $('#ixi-res').setAttribute('d', `M${X(0)} ${Y(0)}L${X(2.6)} ${Y(2.6 / RR * 1000)}`);
      const ang = Math.atan2(Y(2.6 / RR * 1000) - Y(0), X(2.6) - X(0)) * 180 / Math.PI;
      $('#ixi-rl').setAttribute('transform', `translate(${X(0.55)} ${Y(0.55 / RR * 1000) - 8}) rotate(${ang.toFixed(1)})`);
      let d = '';
      for (let k = 0; k <= 120; k++) { const u = 2.3 * k / 120, ma = iAtV(red, u) * 1000; if (ma > 44) break; d += (d ? 'L' : 'M') + X(u).toFixed(1) + ' ' + Y(ma).toFixed(1); }
      $('#ixi-led').setAttribute('d', d);
      const upd = () => {
        const u = +$('#ixi-v').value / 20, ir = u / RR * 1000, il = iAtV(red, u) * 1000;
        $('#ixi-vo').textContent = fmt.num(u, 2) + ' В';
        $('#ixi-u').setAttribute('d', `M${X(u)} 150V8`);
        $('#ixi-pr').setAttribute('cx', X(u)); $('#ixi-pr').setAttribute('cy', Y(ir));
        $('#ixi-pl').setAttribute('cx', X(u)); $('#ixi-pl').setAttribute('cy', Y(il));
        $('#ixi-out').textContent = `${fmt.num(u, 2)} В: резистор ${fmt.num(ir, 1)} мА, LED ${il > 44 ? 'понад 44' : fmt.num(il, il < 1 ? 2 : 1)} мА.`
          + (u >= 1.8 ? ' Ще 0,1 В — і струм LED помітно стрибне.' : u < 1.6 ? ' LED ще «закритий».' : '');
      };
      $('#ixi-v').addEventListener('input', upd); upd();
    })();

    // 2: the voltage column for a chosen source and colour, R for 10 мА
    (function ixCol() {
      if (!$('#ix-col')) return;
      let vs = 5, col = 'red';
      const upd = () => {
        const m = LED[col], ur = vs - m.vf, H = 128, y0 = 14, hl = H * m.vf / vs, hr = H - hl;
        $('#ixc-r').setAttribute('height', hr.toFixed(1));
        $('#ixc-l').setAttribute('y', (y0 + hr).toFixed(1)); $('#ixc-l').setAttribute('height', hl.toFixed(1));
        $('#ixc-l').setAttribute('fill', m.hex);
        $('#ixc-top').textContent = fmt.num(vs, 1) + ' В';
        $('#ixc-br').setAttribute('d', hr > 6 ? `M92 ${y0 + 2}V${y0 + hr - 2}M92 ${y0 + hr + 2}V${y0 + H - 2}` : `M92 ${y0 + hr + 2}V${y0 + H - 2}`);
        const yr = y0 + hr / 2, yl = y0 + hr + hl / 2;
        const tight = hr < 34;
        $('#ixc-ur').textContent = `U_R = ${fmt.num(ur, 1)} В`.replace('U_R', 'U·R');
        $('#ixc-ur').innerHTML = `U<tspan baseline-shift="sub" font-size="75%">R</tspan> = ${fmt.num(ur, 1)} В`;
        $('#ixc-ur').setAttribute('y', tight ? y0 + 4 : yr - 2); $('#ixc-ur2').setAttribute('y', tight ? y0 + 20 : yr + 15);
        $('#ixc-vf').innerHTML = `V<tspan baseline-shift="sub" font-size="0.8em">f</tspan> ≈ ${fmt.num(m.vf, m.vf === 1.95 ? 2 : 1)} В`;
        $('#ixc-vf').setAttribute('y', Math.max(yl - 2, tight ? y0 + 44 : 0)); $('#ixc-vf2').setAttribute('y', Math.max(yl + 15, tight ? y0 + 60 : 0));
        $('#ixc-vf2').textContent = m.nm + ' LED';
        const R = ur / 0.01;
        $('#ixc-f').textContent = ur < 0.3 ? 'R для 10 мА: запасу немає, розрахунок не працює' : `R = ${fmt.num(ur, 1)} В / 10 мА = ${fmt.si(R, 'Ом')}`;
        $('#ixc-out').textContent = `${fmt.num(vs, 1)} В = ${fmt.num(ur, 1)} В на резисторі + ${fmt.num(m.vf, 2)} В на LED.` + (ur < 0.5 ? ' Запасу майже немає: струм буде непередбачуваним.' : '');
      };
      segBind('#ixc-vs', (v) => { vs = +v; upd(); });
      segBind('#ixc-c', (v) => { col = v; upd(); });
      upd();
    })();

    // 3: junction thermometer vs current (red LED)
    (function ixTh() {
      if (!$('#ix-th')) return;
      const Y = (T) => 126 - (T - 25) * 0.92;
      const ixLed = window.Kit.part('led', { parent: $('#ixt-led'), color: 'red', title: 'Червоний світлодіод' });
      $('#ixt-mx').setAttribute('d', `M60 ${Y(125)}H80`); $('#ixt-mxt').setAttribute('y', Y(125) + 4);
      const upd = () => {
        const ma = +$('#ixt-r').value, I = ma / 1000, v = I > 0 ? vOf(red, I) : 0, P = v * I, T = 25 + P * red.rth;
        const y = Math.max(12, Y(T));
        $('#ixt-m').setAttribute('y', y.toFixed(1)); $('#ixt-m').setAttribute('height', (148 - y).toFixed(1));
        $('#ixt-now').textContent = `≈ ${T > 150 ? 'понад 150' : fmt.num(T, 0)} °C`;
        $('#ixt-now').setAttribute('y', Math.min(118, Math.max(Y(125) + 26, y + 5)).toFixed(1));
        $('#ixt-now').style.fill = T > 125 ? 'var(--bad)' : '';
        ixLed.set({ on: Math.min(1, 0.1 + I / 0.03 * 0.8), burnt: T > 125 });
        $('#ixt-p').textContent = `P ≈ ${fmt.num(P * 1000, 0)} мВт`;
        $('#ixt-i').textContent = `I = ${ma} мА`;
        $('#ixt-o').textContent = ma + ' мА';
        $('#ixt-out').textContent = T > 125 ? 'Понад межу Tj 125 °C: кристал руйнується.'
          : ma > 30 ? `Понад абсолютний максимум 30 мА (і ${P > 0.075 ? 'понад 75 мВт' : 'майже 75 мВт'}): кристал ще нижче межі, але виробник нічого не гарантує.`
          : ma > 15 ? 'Працює, але запас до максимуму малий.' : ma >= 5 ? 'Робочий режим 5–15 мА: кристал ледь теплий.' : 'Малий струм — індикатор світить слабко.';
      };
      $('#ixt-r').addEventListener('input', upd); upd();
    })();

    // 4: headroom Vs − Vf for each colour
    (function ixHead() {
      const g = $('#vfhead'); if (!g) return;
      const X = (v) => 70 + v / 5 * 172;
      const upd = (vs) => {
        g.textContent = '';
        if (!vs) { $('#vfh-out').textContent = 'Смуги — пряма напруга кожного кольору. Оберіть джерело, щоб побачити запас для резистора.'; return; }
        const lines = [];
        Object.values(LED).forEach((m, i) => {
          const y = 22 + i * 26, head = vs - m.vf;
          if (head > 0) mk('rect', { x: X(m.vf), y: y - 4, width: X(vs) - X(m.vf), height: 8, rx: 2, fill: head < 0.5 ? 'var(--bad)' : 'var(--ok)', opacity: 0.55 }, g);
          lines.push(`${m.nm} ${fmt.num(Math.max(0, head), 2)} В`);
        });
        mk('path', { d: `M${X(vs)} 8V150`, stroke: 'var(--ink)', 'stroke-width': 2.5 }, g);
        $('#vfh-out').textContent = `Запас від ${fmt.num(vs, 1)} В: ` + lines.join(' · ') + (vs < 4 ? '. Синьому й білому майже нічого не лишається.' : '.');
      };
      segBind('#vfh-vs', (v) => upd(+v));
      upd(0);
    })();
  });
})();
