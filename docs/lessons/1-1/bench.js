/* Lesson 1-1: the interactive bench (multimeter on a live circuit), the «V and A» explainer and the idea-card
   interactives. Loaded with defer after study.js; everything waits for study:ready. Motion goes through Study.sim /
   Study.anim only (pauses off-screen, waits for a click under reduced motion).
   Real hardware is drawn with window.Kit (assets/kit.js): the UNI-T UT136C+, the breadboard, resistors, LEDs, the MB102.
   window.L11Kit (below) wraps the Kit multimeter with what these labs need on top of it (clickable dial positions and jacks,
   the diode / continuity annunciators, an LCD flash and the fuse burn-out); the inline page script uses it too. */
window.L11Kit = (function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs = {}, parent = null) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  };
  // Dial geometry of the Kit UT136C+ (kit.js: knob centre 451/1094, dots at r 292, labels at r ≈ 350/336).
  const ANG = { OFF: 173, 'V~': 189, V: 204, mV: 218, 'Ω': 243, CAP: 260, Hz: 277, hFE: 294, TEMP: 318, 'µA': 331, mA: 347, A: 6 };
  const DC = { x: 451, y: 1094 };
  const at = (k, r = 322, rr = 312) => { const a = ANG[k] * Math.PI / 180; return { x: DC.x + r * Math.cos(a), y: DC.y + rr * Math.sin(a) }; };
  const keyClick = (node, fn) => {
    node.addEventListener('click', fn);
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(e); } });
  };

  /* A Kit multimeter inside `parent` (an <svg> or <g> in Kit units, 1 = 0.1 mm).
     o.dial: [{ v, kit, label, dx }] clickable positions (v = page value, kit = Kit dial key, dx = shift of the hit spot);
     o.onDial(v); o.jacks: { A: label, V: label } clickable jacks → o.onJack('A'|'V'); o.cables: draw the probe leads
     leaving the bottom of the meter. Returns { g, mm, set(state), flash(), blow(), plug(jack) }. */
  function meter(parent, o = {}) {
    const K = window.Kit;
    const g = mk('g', { class: 'l11-meter', transform: `translate(${o.x || 0} ${o.y || 0})${o.scale ? ` scale(${o.scale})` : ''}` }, parent);
    const cab = mk('g', {}, g);
    const mm = K.part('multimeter', { parent: g, fuseView: !!o.fuseView, shadow: o.shadow });
    // The x-ray print: F1 is the 0,5 A fuse of the VΩmA jack (ut136-fuse-ma); 400 mA is the range, not the fuse.
    mm.querySelectorAll('text').forEach((t) => { if (t.textContent === 'F 400 mA') { t.textContent = 'F1 0.5A'; t.setAttribute('font-size', 22); t.setAttribute('y', 1710); } });
    const ov = mk('g', { class: 'l11-ov' }, g);
    // annunciators the Kit LCD does not have: diode and continuity (UT136C+ shows them top left); they are LCD segments,
    // so they live inside the meter part (the part is not transformed: its own units = this group's units)
    const ann = {
      dio: mk('text', { x: 196, y: 372, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 34, 'font-weight': 700, 'font-family': 'Arial, sans-serif', fill: '#111', opacity: 0 }, mm),
      beep: mk('text', { x: 196, y: 440, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 30, 'font-weight': 700, 'font-family': 'Arial, sans-serif', fill: '#111', opacity: 0 }, mm),
    };
    ann.dio.textContent = '→|'; ann.beep.textContent = '•)))';
    const flashR = mk('rect', { x: 140, y: 186, width: 600, height: 380, rx: 8, fill: '#fff6d0', opacity: 0, 'pointer-events': 'none' }, ov);
    const fuseGlow = mk('circle', { cx: 685, cy: 1672, r: 90, fill: '#ff8a1f', opacity: 0, 'pointer-events': 'none' }, ov);
    const fx = mk('g', { 'pointer-events': 'none' }, ov);
    const texts = [...mm.querySelectorAll('text')];
    const lcdText = (s) => texts.find((t) => t.textContent === s);
    const tDC = lcdText('DC'), tAuto = lcdText('Auto');
    // probe plugs (banana) in the jacks + leads hanging down
    const plugs = {};
    const plugAt = (k, col) => {
      const p = mm.pins[k], pg = mk('g', { 'pointer-events': 'none' }, ov);
      mk('circle', { cx: p.x, cy: p.y, r: 40, fill: col === 'red' ? '#b3121b' : '#1c1c1e' }, pg);
      mk('circle', { cx: p.x, cy: p.y, r: 28, fill: col === 'red' ? '#e2323a' : '#3a3a3e' }, pg);
      mk('circle', { cx: p.x - 9, cy: p.y - 10, r: 9, fill: '#fff', opacity: 0.35 }, pg);
      return pg;
    };
    if (o.cables) {
      const H = o.cableTo || 1935;
      // each lead hangs straight down from its jack, parallel to the others (test leads: class kit-lead; the 0.05 mm
      // offset keeps a non-zero box, so tools/site-check/wires.mjs still measures the drawing). With the fuse x-ray window
      // right under VΩmA, the red lead leaves that jack sideways and runs down the holster's right edge instead.
      for (const [k, col] of [['COM', 'black'], ['V', 'red'], ['A', 'red']]) {
        if (k === 'A' && !o.jacks) continue;
        const p = mm.pins[k], hex = col === 'red' ? '#d42a2a' : '#26272a';
        const w = k === 'V' && o.fuseView
          ? K.route(cab, [{ x: p.x, y: p.y }, { x: 802, y: p.y }, { x: 802, y: H }], hex, { width: 26, r: 70, ends: 'none' })
          : K.wire(cab, { x: p.x, y: p.y }, { x: p.x + 0.5, y: H }, hex, { width: 26, ends: 'none', lift: 0 });
        w.classList.add('kit-lead');
        plugs[k] = { plug: plugAt(k, col), wire: w };
      }
      cab.remove(); g.insertBefore(cab, mm.nextSibling); // leads over the holster, under the plugs
    }
    const plug = (jack) => { // which jack the red lead is in ('V' | 'A'); COM always black
      if (!plugs.A) return;
      for (const k of ['V', 'A']) { plugs[k].plug.style.display = k === jack ? '' : 'none'; plugs[k].wire.style.display = k === jack ? '' : 'none'; }
    };
    // dial positions
    const posEls = [];
    let cur = null;
    (o.dial || []).forEach((d) => {
      const c = at(d.kit);
      const pg = mk('g', { class: 'l11-pos', role: 'button', tabindex: 0, 'aria-label': d.label, 'data-v': d.v }, ov);
      const x = c.x + (d.dx || 0), y = c.y + (d.dy || 0);
      mk('circle', { class: 'l11-ring', cx: x, cy: y, r: d.r || 44 }, pg);
      mk('circle', { class: 'hit', cx: x, cy: y, r: (d.r || 44) + 6 }, pg);
      keyClick(pg, (e) => { e.stopPropagation(); if (o.onDial) o.onDial(d.v); });
      posEls.push(pg);
    });
    // jacks
    if (o.jacks) for (const k of Object.keys(o.jacks)) {
      const p = mm.pins[k];
      const jg = mk('g', { class: 'l11-jack', role: 'button', tabindex: 0, 'aria-label': o.jacks[k] }, ov);
      mk('circle', { class: 'l11-ring', cx: p.x, cy: p.y, r: 72 }, jg);
      mk('circle', { class: 'hit', cx: p.x, cy: p.y, r: 80 }, jg);
      keyClick(jg, () => { if (o.onJack) o.onJack(k); });
    }
    const api = {
      g, mm,
      set(s) {
        cur = s.v ?? cur;
        mm.set({ dial: s.dial, display: s.display ?? '', unit: s.unit ?? '', ac: !!s.ac, fuse: s.fuse || 'ok', hold: false });
        const on = s.dial !== 'OFF';
        if (tDC) tDC.setAttribute('opacity', on && s.dc ? 1 : 0);  // Kit always lights DC when not AC; Ω and → | show neither
        if (tAuto) tAuto.setAttribute('opacity', on && s.auto !== false ? 1 : 0);
        ann.dio.setAttribute('opacity', on && s.dio ? 1 : 0);
        ann.beep.setAttribute('opacity', on && s.beep ? 1 : 0);
        posEls.forEach((pg) => { const sel = pg.dataset.v === String(cur); pg.classList.toggle('on', sel); pg.setAttribute('aria-pressed', String(sel)); });
        return api;
      },
      flash() {
        if (Study.reducedMotion()) return;
        let t = 0;
        const step = () => { t += 1 / 60; flashR.setAttribute('opacity', Math.max(0, 0.95 - t * 2).toFixed(2)); if (t < 0.5) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      },
      // fuse burn-out: orange glow over the fuse window, a puff of smoke
      blow() {
        if (Study.reducedMotion()) return;
        let t = 0;
        fx.textContent = '';
        const puffs = [0, 1, 2, 3, 4].map((i) => ({ x: 685 + (i - 2) * 14, d: i * 0.12, c: mk('circle', { cx: 685, cy: 1650, r: 20, fill: '#8c949a', opacity: 0 }, fx) }));
        const step = () => {
          t += 1 / 60;
          fuseGlow.setAttribute('opacity', (t < 0.3 ? t / 0.3 : Math.max(0, 1 - (t - 0.3) / 0.6)).toFixed(2) * 0.9);
          puffs.forEach((p) => {
            const q = (t - p.d) / 1.4;
            if (q < 0 || q > 1) { p.c.setAttribute('opacity', 0); return; }
            p.c.setAttribute('cx', (p.x + q * 40).toFixed(1)); p.c.setAttribute('cy', (1650 - q * 260).toFixed(1));
            p.c.setAttribute('r', (20 + q * 70).toFixed(1)); p.c.setAttribute('opacity', (0.75 * (1 - q)).toFixed(2));
          });
          if (t < 2) requestAnimationFrame(step); else fx.textContent = '';
        };
        requestAnimationFrame(step);
      },
      plug,
    };
    if (plugs.A) plug('V');
    return api;
  }

  // Kit resistor whose bands are painted from a colour list (the Kit computes bands from a value; a trainer needs any colours).
  function bandRects(res) { return [...res.querySelectorAll('rect[width="7"]')]; }

  /* The left end of a full WB-102 (the kit's 830-hole board) with the MB102 in its rails, like the course's reference
     drawing: the board fades out to the right after column `to` (it goes on), the module drops into the rail holes of
     columns 4–5 and covers columns 1–10. Returns { bb, pm, at, hole, layer } (layer = the <g> holding the board). */
  function board(svg, o = {}) {
    const K = window.Kit, P = K.P, id = svg.id + '-fade', to = o.to || 26;
    const defs = mk('defs', {}, svg);
    const lg = mk('linearGradient', { id: id + '-g', gradientUnits: 'userSpaceOnUse', x1: (to + 0.6) * P, x2: (to + 2.2) * P, y1: 0, y2: 0 }, defs);
    mk('stop', { offset: 0, 'stop-color': '#fff' }, lg); mk('stop', { offset: 1, 'stop-color': '#000' }, lg);
    const m = mk('mask', { id, maskUnits: 'userSpaceOnUse', x: -600, y: -600, width: 3200, height: 2000 }, defs);
    mk('rect', { x: -600, y: -600, width: 3200, height: 2000, fill: `url(#${id}-g)` }, m);
    const layer = mk('g', { mask: `url(#${id})` }, o.parent || svg);
    const bb = K.part('breadboard', { parent: layer, title: o.title || 'Макетна плата WB-102' });
    let pm = null;
    if (o.module !== false) {
      const a = bb.rail('top', '+', 4);
      pm = K.part('power-module', { parent: o.parent || svg, x: a.x, y: a.y, title: o.pmTitle || 'Модуль живлення MB-102' });
    }
    return { bb, pm, layer, at: (n) => bb.at(n), hole: (c, r) => bb.hole(c, r) };
  }

  return { meter, mk, keyClick, bandRects, board, ANG, at };
})();

document.addEventListener('study:ready', () => {
  'use strict';
  const { $, $$, fmt } = Study;
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs = {}, parent = null) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  };
  const reduced = () => Study.reducedMotion();
  const segBind = (sel, fn) => $$(sel + ' button').forEach((b) => b.addEventListener('click', () => {
    $$(sel + ' button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    fn(b.dataset.v, b);
  }));
  const hide = (sel, on) => $(sel).toggleAttribute('hidden', !!on);
  const segSet = (sel, v) => $$(sel + ' button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === v)));

  /* ---------- red LED model (same as lesson 1.2): Vf = 1,9 В at 10 мА (led-red-3mm-vf), exponential knee + 8 Ом */
  const LED = { vf: 1.9, at: 0.010, n: 0.045, rs: 8 };
  const vOf = (I) => LED.vf + LED.n * Math.log(I / LED.at) + LED.rs * (I - LED.at);
  // Current in the loop «source Vs → series resistance Rs → LED» (bisection on a log scale).
  function ledLoop(vs, rs) {
    if (!(rs < Infinity) || vs <= 0) return 0;
    let lo = 1e-13, hi = 8;
    for (let k = 0; k < 140; k++) { const mid = Math.sqrt(lo * hi); if (vOf(mid) + rs * mid > vs) hi = mid; else lo = mid; }
    return lo < 2e-13 ? 0 : lo;
  }

  /* ---------- tiny particle system for sparks and smoke (drawn in an SVG group, stepped by a sim frame) */
  function fxLayer(g) {
    const ps = [];
    return {
      burst(x, y, kind) {
        if (kind === 'flash') ps.push({ k: 'flash', x, y, t: 0, life: 0.45 });
        if (kind === 'sparks') for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 110;
          ps.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, t: 0, life: 0.35 + Math.random() * 0.3 });
        }
        if (kind === 'smoke') for (let i = 0; i < 9; i++) {
          ps.push({ k: 'smoke', x: x + (Math.random() - 0.5) * 10, y, vx: (Math.random() - 0.3) * 14, vy: -24 - Math.random() * 20, t: -i * 0.16, life: 1.7 });
        }
      },
      get busy() { return ps.length > 0; },
      step(dt) {
        g.textContent = '';
        for (let i = ps.length - 1; i >= 0; i--) {
          const p = ps[i];
          p.t += dt;
          if (p.t > p.life) { ps.splice(i, 1); continue; }
          if (p.t < 0) continue;
          const q = p.t / p.life;
          if (p.k === 'flash') mk('circle', { cx: p.x, cy: p.y, r: 10 + 46 * q, fill: '#fff3b0', opacity: (1 - q) * 0.95 }, g);
          if (p.k === 'spark') {
            p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt;
            mk('circle', { cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: 2.2, fill: q < 0.5 ? '#fff1a8' : '#ffad33', opacity: 1 - q }, g);
          }
          if (p.k === 'smoke') {
            p.x += p.vx * dt; p.y += p.vy * dt;
            mk('circle', { cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: (5 + 14 * q).toFixed(1), fill: '#8c949a', opacity: (0.6 * (1 - q)).toFixed(2) }, g);
          }
        }
      },
      clear() { ps.length = 0; g.textContent = ''; },
    };
  }

  /* ---------- dots that run along a path; speed in units/s */
  function dotsOn(g, path, spacing = 24) {
    let off = 0, n = 0, L = 0, d = '';
    const sync = () => {
      if (path.getAttribute('d') === d) return;
      d = path.getAttribute('d'); L = path.getTotalLength();
      const want = Math.max(1, Math.floor(L / spacing));
      while (n < want) { mk('circle', { r: 3.2 }, g); n++; }
      while (n > want) { g.lastChild.remove(); n--; }
    };
    return {
      step(dt, speed, show = true) {
        sync();
        off = (off + dt * speed) % L;
        g.style.display = show ? '' : 'none';
        if (!show) return;
        [...g.children].forEach((c, k) => {
          const p = path.getPointAtLength((off + k * L / n) % L);
          c.setAttribute('cx', p.x.toFixed(1)); c.setAttribute('cy', p.y.toFixed(1));
        });
      },
      setOff(o) { sync(); off = ((o % L) + L) % L; },
    };
  }
  // Visual drift speed: grows with current but stays readable from microamps to amps.
  const flowSpeed = (I) => (I < 2e-5 ? 0 : 14 * Math.log2(1 + I * 1000) + 6);

  // 4000-count autorange text for the LCD and the same value in Ukrainian for the readouts.
  function fmtV(v) { const a = Math.abs(v); return a < 4 ? a.toFixed(3) : a < 40 ? a.toFixed(2) : a.toFixed(1); }
  function lcdOf(kind, x) {
    if (kind === 'blank') return { d: '', u: '', txt: '—' };
    if (kind === 'err') return { d: '----', u: '', txt: 'показ неправильний' };
    if (kind === 'ol') return { d: ' OL', u: 'Ω', txt: 'OL (більше за діапазон)' };
    if (kind === 'v') { const s = fmtV(x); return { d: s, u: 'V', txt: s.replace('.', ',') + ' В' }; }
    if (kind === 'ma') {
      const m = Math.abs(x) * 1000;
      if (m > 400) return { d: ' OL', u: 'mA', txt: 'OL (понад 400 мА)' };
      const s = m < 40 ? m.toFixed(2) : m.toFixed(1);
      return { d: s, u: 'mA', txt: s.replace('.', ',') + ' мА' };
    }
    if (kind === 'ohm') {
      if (x < 400) { const s = x.toFixed(1); return { d: s, u: 'Ω', txt: s.replace('.', ',') + ' Ом' }; }
      const k = x / 1000, s = k < 4 ? k.toFixed(3) : k.toFixed(2);
      return { d: s, u: 'kΩ', txt: s.replace('.', ',') + ' кОм' };
    }
    return { d: '', u: '', txt: '—' };
  }

  /* =================================================================== LAB */
  (function bench() {
    const circ = $('#bx-circ'), meter = $('#bx-meter');
    if (!circ) return;
    const RS = [100, 150, 220, 330, 470, 680, 1000, 1500, 2200, 3300, 4700, 6800, 10000];
    const SHUNT = 2, RV = 10e6, FUSE = 0.5, I_BURN = 0.1, R_INT = 0.05;
    const st = { on: false, mode: 'off', probe: 'r', load: 'led', vs: 5, R: 220, fuse: true, led: true };
    const fx = fxLayer($('#bx-fx'));
    // the real meter: Kit UT136C+ with the four positions this bench uses
    const KD = { off: 'OFF', v: 'V', a: 'mA', ohm: 'Ω' };
    const M = L11Kit.meter(meter, {
      fuseView: true, cables: true, onDial: (v) => setMode(v),
      dial: [
        { v: 'off', kit: 'OFF', label: 'Перемикач: вимкнено' }, { v: 'v', kit: 'V', label: 'Перемикач: постійна напруга' },
        { v: 'a', kit: 'mA', label: 'Перемикач: постійний струм, міліампери' }, { v: 'ohm', kit: 'Ω', dx: 6, r: 38, label: 'Перемикач: опір' },
      ],
    });
    const knobHit = L11Kit.mk('circle', { cx: 451, cy: 1094, r: 230, fill: 'transparent', style: 'cursor:pointer' }, M.g.querySelector('.l11-ov'));
    const fuseMsg = L11Kit.mk('text', { x: 230, y: 1912, 'text-anchor': 'middle', fill: 'var(--bad)', style: 'font:700 64px var(--f-body)' }, meter);
    fuseMsg.textContent = 'F1 згорів';
    let race = 0, racePath = '', blewOnce = false;

    // Where the probe tips touch (red, black), the meter symbol, its leads, and the path of the current through it.
    const PROBE = {
      r:   { tr: [150, 50], tb: [210, 50], m: [180, 8],   lr: 'M150 50V8H163', lb: 'M210 50V8H197' },
      led: { tr: [320, 100], tb: [320, 160], m: [356, 130], lr: 'M320 100H356V113', lb: 'M320 160H356V147' },
      gap: { tr: [232, 50], tb: [278, 50], m: [255, 100], lr: 'M232 50V100H238', lb: 'M278 50V100H272' },
      src: { tr: [60, 80], tb: [60, 200], m: [22, 140],  lr: 'M60 80H22V123', lb: 'M60 200H22V157' },
    };
    const PATH = {
      loop: 'M60 110V50H320V230H60Z',
      gap: 'M60 110V50H232V100H278V50H320V230H60Z',
      led: 'M60 110V50H320V100H356V160H320V230H60Z',
      r: 'M60 110V50H150V8H210V50H320V230H60Z',
      src: 'M60 110V80H22V200H60Z',
    };

    // Solve the circuit for the current state. Returns what the meter shows, the loop current and the events.
    function solve() {
      const hasLed = st.load === 'led';
      const ledOpen = hasLed && !st.led;
      const mA = st.mode === 'a' && st.fuse;              // ammeter conducting
      const series = (rs) => (!st.on ? 0 : hasLed ? (ledOpen ? 0 : ledLoop(st.vs, rs)) : st.vs / rs);
      const out = { I: 0, Iled: 0, Im: 0, ur: 0, path: 'loop', lcd: { kind: 'blank' }, blow: false, burn: false, bypassLed: false };
      const p = st.probe, mode = st.mode;
      if (p === 'gap') {
        if (mode === 'a' && mA) { out.I = series(st.R + SHUNT); out.Im = out.I; out.path = 'gap'; }
        else if (mode === 'v') { out.I = series(st.R + RV); out.Im = out.I; }
        else out.I = 0;                                   // OFF, Ω, or a blown fuse: the break stays open
        out.Iled = hasLed ? out.I : 0;
        if (mode === 'v') out.lcd = { kind: 'v', x: out.I * RV };
      } else if (p === 'r') {
        if (mode === 'a' && mA) {                         // R1 shorted by ≈ 2 Ом
          const rp = st.R * SHUNT / (st.R + SHUNT);
          out.I = series(rp); out.Im = out.I * st.R / (st.R + SHUNT); out.path = 'r';
        } else out.I = series(st.R);
        out.Iled = hasLed ? out.I : 0;
        if (mode === 'v') out.lcd = { kind: 'v', x: out.I * st.R };
      } else if (p === 'led') {
        if (mode === 'a' && mA) {                         // LED bypassed: 2 Ом parallel to it keeps it below its knee
          out.I = st.on ? st.vs / (st.R + SHUNT) : 0; out.Im = out.I; out.Iled = 0; out.bypassLed = true; out.path = 'led';
        } else { out.I = series(st.R); out.Iled = out.I; }
        if (mode === 'v') out.lcd = { kind: 'v', x: out.I > 0 ? Math.max(0, vOf(out.I)) : 0 };
      } else if (p === 'src') {
        out.I = series(st.R); out.Iled = hasLed ? out.I : 0;
        if (mode === 'a' && mA) { out.Im = st.vs / (R_INT + SHUNT); out.path = 'src'; }
        if (mode === 'v') out.lcd = { kind: 'v', x: st.vs };
      }
      if (mode === 'a') out.lcd = { kind: 'ma', x: mA ? out.Im : 0 };
      if (mode === 'ohm') {
        if (p === 'src' || st.on) out.lcd = { kind: 'err' };
        else if (p === 'r') out.lcd = { kind: 'ohm', x: st.R };
        else out.lcd = { kind: 'ol' };
      }
      out.ur = p === 'r' && mode === 'a' && mA ? out.I * (st.R * SHUNT / (st.R + SHUNT)) : out.I * st.R;
      out.blow = mode === 'a' && mA && out.Im > FUSE;
      out.burn = hasLed && st.led && out.Iled > I_BURN;
      return out;
    }

    const $o = (id) => $('#' + id);
    function render() {
      let s = solve();
      const events = [];
      if (s.blow || s.burn) {
        race = reduced() ? 0 : 0.55; racePath = PATH[s.path] || PATH.loop;
        if (s.burn) { st.led = false; events.push('burn'); }
        if (s.blow) { st.fuse = false; events.push('blow'); blewOnce = true; }
        s = solve();
        if (events.includes('blow')) setTimeout(() => { M.blow(); M.flash(); }, reduced() ? 0 : 550);
        if (events.includes('burn')) setTimeout(() => { fx.burst(320, 130, 'flash'); fx.burst(320, 130, 'sparks'); fx.burst(322, 116, 'smoke'); kickFx(); }, reduced() ? 0 : 550);
      }
      const hasLed = st.load === 'led';
      // drawing: switch, labels, load
      $('#bx-lever').setAttribute('x2', st.on ? 132 : 128); $('#bx-lever').setAttribute('y2', st.on ? 50 : 28);
      $('#bx-vlbl').textContent = fmt.num(st.vs, 1) + ' В';
      $('#bx-rlbl').textContent = $('#bx-rout').textContent = fmt.si(st.R, 'Ом');
      $('#bx-vout').textContent = fmt.num(st.vs, 1) + ' В';
      hide('#bx-ledg', !hasLed); hide('#bx-linkg', hasLed);
      hide('#bx-dead', !(hasLed && !st.led));
      $('#bx-ledsym').style.color = hasLed && !st.led ? 'var(--muted)' : '';
      const gapOpen = st.probe === 'gap';
      $('#bx-jump').style.display = gapOpen ? 'none' : '';
      hide('#bx-gapmark', !gapOpen);
      // probes and meter symbol
      const P = PROBE[st.probe], off = st.mode === 'off';
      $('#bx-lr').setAttribute('d', P.lr); $('#bx-lb').setAttribute('d', P.lb);
      $('#bx-tr').setAttribute('cx', P.tr[0]); $('#bx-tr').setAttribute('cy', P.tr[1]);
      $('#bx-tb').setAttribute('cx', P.tb[0]); $('#bx-tb').setAttribute('cy', P.tb[1]);
      $('#bx-msym').setAttribute('transform', `translate(${P.m[0]} ${P.m[1]})`);
      $('#bx-mlet').textContent = { off: '–', v: 'V', a: 'A', ohm: 'Ω' }[st.mode];
      $('#bx-probes').style.opacity = off ? 0.55 : 1;
      // glow and heat
      const Iled = s.Iled, glow = hasLed && st.led ? Math.min(1, Iled / 0.02) : 0;
      $('#bx-glow').setAttribute('opacity', glow.toFixed(2));
      $('#bx-glow').setAttribute('r', (34 + 26 * Math.min(1.6, Iled / 0.02)).toFixed(1));
      const pr = s.ur * s.I;
      $('#bx-heat').setAttribute('opacity', Math.min(0.95, pr / 0.25).toFixed(2));
      // meter face (the Kit UT136C+: dial, LCD, fuse x-ray)
      const L = lcdOf(s.lcd.kind, s.lcd.x);
      M.set({ v: st.mode, dial: KD[st.mode], display: L.d.trim(), unit: L.u, dc: st.mode === 'v' || st.mode === 'a', fuse: st.fuse ? 'ok' : 'blown' });
      fuseMsg.style.display = st.fuse ? 'none' : '';
      $('#bx-fuse-fix').hidden = st.fuse; $('#bx-led-fix').hidden = st.led || !hasLed;
      $('[data-v="led"]', $('#bx-probe')).disabled = !hasLed;
      // readouts
      $o('bx-o-disp').textContent = L.txt;
      $o('bx-o-i').textContent = s.path === 'src' && st.mode === 'a' && st.fuse ? '> 0,5 А' : fmtI(s.I);
      $o('bx-o-ur').textContent = fmt.num(s.ur, s.ur < 10 ? 2 : 1) + ' В';
      $o('bx-o-pr').textContent = pr >= 1 ? fmt.num(pr, 2) + ' Вт' : fmt.num(pr * 1000, pr < 0.01 ? 1 : 0) + ' мВт';
      $o('bx-o-pr').className = pr > 0.25 ? 'bad' : '';
      $o('bx-o-i').className = hasLed && st.led && s.Iled > 0.03 ? 'bad' : '';
      $('#bx-note').textContent = note(s, events);
      cur = s;
      sim.draw();
    }
    const fmtI = (I) => (I <= 0 ? '0 мА' : I < 1e-3 ? fmt.num(I * 1e6, I < 1e-5 ? 2 : 0) + ' мкА' : fmt.num(I * 1000, I < 0.1 ? 1 : 0) + ' мА');

    function note(s, ev) {
      const hasLed = st.load === 'led', p = st.probe, m = st.mode;
      const vs = fmt.num(st.vs, 1) + ' В', R = fmt.si(st.R, 'Ом');
      let t = '';
      if (ev.includes('blow') && ev.includes('burn')) t = 'Бах! Амперметр закоротив R1: струм обмежує лише сам LED і ≈ 0 Ом приладу. Згорів і світлодіод, і запобіжник F1 0,5 А.';
      else if (ev.includes('blow')) t = 'Бах! Амперметр — це ≈ 0 Ом. Щупами на джерелі він замкнув його накоротко: струм у рази більший за 0,5 А, запобіжник F1 згорів.';
      else if (ev.includes('burn')) t = `Пах! Амперметр закоротив R1, і світлодіод опинився просто на ${vs}: струм у кілька разів понад абсолютний максимум, LED згорів.`;
      if (t) return t;
      if (m === 'off') return 'Перемикач на OFF: прилад вимкнений. Оберіть V⎓, mA⎓ або Ω.';
      if (m === 'ohm') {
        if (p === 'src') return 'Опір джерела омметром не міряють: на ньому завжди є напруга. Прилад показує нісенітницю.';
        if (st.on) return 'Омметр на живій схемі: прилад сам подає струм, і чужа напруга збиває показ. Вимкніть S1.';
        if (p === 'r') return `R1 = ${R}: живлення вимкнене, тож показ чесний. Опір міряють тільки так.`;
        if (p === 'led') return 'OL: світлодіод — не резистор, «опору» в нього немає. Для LED у приладі є окремий режим діода.';
        return 'OL — розрив: опір «нескінченний», бо S1 розімкнений і петлі немає.';
      }
      if (m === 'v') {
        if (p === 'src') return `Напруга джерела: ${vs}. Її видно навіть із розімкненим S1: джерелу не потрібна петля, щоб мати напругу.`;
        if (!st.on) return 'S1 розімкнений: струму немає, тож ні на R1, ні на LED напруги немає — 0 В.';
        if (hasLed && !st.led && p !== 'gap') return 'LED згорів і став розривом: струму немає, на R1 — 0 В. Натисніть «Новий LED».';
        if (p === 'r') return `Вольтметр паралельно R1: U = I·R = ${fmtI(s.I)} × ${R} ≈ ${fmt.num(s.ur, 2)} В. Коло працює як без приладу: крізь 10 МОм іде мізерний струм.`;
        if (p === 'led') return `На LED1 ≈ ${fmt.num(vOf(s.I), 2)} В — пряма напруга червоного LED. Разом з ${fmt.num(s.ur, 2)} В на R1 це знову ${vs}.`;
        return hasLed ? 'Вольтметр у розриві: 10 МОм фактично розірвали коло, LED не світить. Прилад показує напругу джерела мінус ≈ 1,4 В, які LED забирає навіть від мікроструму.'
          : 'Вольтметр у розриві: 10 МОм фактично розірвали коло, і прилад показує майже всю напругу джерела, а не 0.';
      }
      // ammeter
      if (!st.fuse) return p === 'gap' ? 'Запобіжник F1 згорів: амперметр став розривом, коло не працює, прилад показує 0. Замініть запобіжник.'
        : 'Запобіжник F1 згорів: у режимі mA прилад показує 0, хоч би куди ви приклали щупи. Замініть запобіжник.';
      if (p === 'gap') {
        if (!st.on) return 'Амперметр у розриві — правильно. Але S1 розімкнений: 0 мА.';
        if (hasLed && !st.led) return 'Амперметр у розриві, але LED згорів і сам став розривом: 0 мА. Натисніть «Новий LED».';
        let x = `Правильно: амперметр у розриві, весь струм петлі йде крізь прилад. I = ${fmtI(s.I)}.`;
        if (hasLed && s.I > 0.03) x += ' Це понад абсолютний максимум LED 30 мА: він перегрівається (урок 1.2).';
        if (s.ur * s.I > 0.25) x += ' R1 розсіює понад 0,25 Вт і перегрівається.';
        return x;
      }
      if (p === 'led') return st.on ? `Амперметр паралельно LED1 став «дротом» в обхід світлодіода: LED гасне, струм тепер обмежує лише R1: ${vs} / ${R} ≈ ${fmtI(s.I)}.` : 'S1 розімкнений: 0 мА.';
      if (p === 'r') return st.on ? 'Амперметр паралельно R1 закорочує резистор.' : 'S1 розімкнений, тож поки нічого не сталося. Але замкніть S1 — і амперметр закоротить R1.';
      return 'Амперметр на джерелі — коротке замикання.';
    }

    // dial positions are built by L11Kit.meter (click / Enter / Space); a click on the knob steps to the next position
    const ORDER = ['off', 'v', 'a', 'ohm'];
    knobHit.addEventListener('click', () => setMode(ORDER[(ORDER.indexOf(st.mode) + 1) % ORDER.length]));
    function setMode(v) { st.mode = v; segSet('#bx-mode', v); render(); }

    // animation: current dots + effects
    const pathEl = $('#bx-path'), dots = dotsOn($('#bx-dots'), pathEl, 26);
    let cur = null;
    const sim = Study.sim(circ, (dt) => {
      if (!cur) return;
      let speed = 0, d = PATH[cur.path] || PATH.loop;
      if (race > 0) { race -= dt; d = racePath; speed = 520; }
      else speed = flowSpeed(cur.path === 'src' ? 0 : cur.I);
      if (pathEl.getAttribute('d') !== d) pathEl.setAttribute('d', d);
      dots.step(dt, speed, speed > 0);
      fx.step(dt);
    });
    const kickFx = () => { if (reduced()) fx.clear(); else sim.play(); };

    segBind('#bx-mode', (v) => { st.mode = v; render(); });
    segBind('#bx-probe', (v) => { st.probe = v; render(); });
    segBind('#bx-load', (v) => { st.load = v; if (v === 'r' && st.probe === 'led') { st.probe = 'r'; segSet('#bx-probe', 'r'); } render(); });
    $('#bx-sw').addEventListener('switch', (e) => { st.on = e.detail.on; render(); });
    $('#bx-v').addEventListener('input', (e) => { st.vs = +e.target.value / 2; render(); });
    $('#bx-r').addEventListener('input', (e) => { st.R = RS[+e.target.value]; render(); });
    $('#bx-fuse-fix').addEventListener('click', () => { st.fuse = true; render(); $('#bx-note').textContent = 'Новий запобіжник F1 на місці. Тепер амперметр — тільки в розрив.'; });
    $('#bx-led-fix').addEventListener('click', () => { st.led = true; fx.clear(); render(); $('#bx-note').textContent = 'Новий світлодіод на місці.'; });
    render();
    // missions: each check reads the bench state (st) and the last solved circuit (cur)
    const withLed = () => st.on && st.load === 'led' && st.led;
    Study.missions($('#bx-ms'), { key: 'bench', items: [
      { id: 'ohm', text: 'Виміряйте опір R1 так, щоб показ був чесним.', hint: 'Режим Ω, щупи «на R1», а вимикач S1 розімкнений: омметр міряє лише коло без живлення.',
        check: () => st.mode === 'ohm' && st.probe === 'r' && !st.on },
      { id: 'vr', text: 'Виміряйте напругу на R1, коли LED1 світить.', hint: 'Замкніть S1, режим V⎓, щупи «на R1»: вольтметр — паралельно деталі, коло не розривають.',
        check: () => withLed() && st.mode === 'v' && st.probe === 'r' },
      { id: 'amp', text: 'Виміряйте струм у колі й не спаліть запобіжник.', hint: 'Режим mA⎓ і щупи «у розрив»: амперметр стоїть послідовно, весь струм іде крізь нього, а LED1 світить далі.',
        check: () => withLed() && st.mode === 'a' && st.probe === 'gap' && st.fuse && cur && cur.I > 0 },
      { id: 'fuse', text: 'Спаліть запобіжник F1 навмисно, а потім замініть його.', hint: 'Режим mA⎓ і щупи «на джерело»: амперметр замкне G1 накоротко. Потім приберіть щупи з джерела (інакше новий F1 теж згорить) і натисніть «Замінити запобіжник».',
        check: () => blewOnce && st.fuse },
      { id: 'half', text: 'Підберіть G1 і R1 так, щоб U на R1 дорівнювала напрузі на LED1 (±0,05 В). Перевірте вольтметром.',
        hint: 'Тоді кожному дістається половина G1, а на LED1 ≈ 1,75 В. Отже, G1 ≈ 3,5 В; R1 підберіть кількома спробами. Щупи «на R1» або «на LED1», режим V⎓.',
        check: () => withLed() && st.mode === 'v' && (st.probe === 'r' || st.probe === 'led') && cur && cur.I > 0 && Math.abs(cur.I * st.R - vOf(cur.I)) <= 0.05 },
    ] });
  })();

  /* =================================================================== ANIM: how the meter goes in for V and for A */
  (function explainer() {
    const fig = $('#bx-anim');
    if (!fig) return;
    const VF = 1.9, I = (5 - VF) / 220; // the page's numbers: (5 − 1,9) / 220 ≈ 14,1 мА
    const pathEl = $('#ma-path'), dots = dotsOn($('#ma-dots'), pathEl, 22), fx = fxLayer($('#ma-fx'));
    const m = $('#ma-m'), lr = $('#ma-lr'), lb = $('#ma-lb');
    // the real meter beside the schematic: Kit UT136C+ at 1:10 (its dial and LCD follow the steps)
    const MM = L11Kit.meter($('#ma-meter'), { x: 402, y: 2, scale: 0.125, fuseView: true, cables: true });
    let mDial = 'OFF', mTxt = '', mFuse = 'ok';
    const PATHS = { loop: 'M60 100V44H330V214H60Z', gap: 'M60 100V44H232V104H278V44H330V214H60Z', src: 'M60 100V70H18V190H60Z' };
    const lerp = (a, b, p) => a + (b - a) * p;
    const ease = (p) => (p < 0 ? 0 : p > 1 ? 1 : p * p * (3 - 2 * p));
    let blown = false, lastT = 0, lastI = -1;
    const place = (x, y, let_, show = true) => { m.style.display = show ? '' : 'none'; m.setAttribute('transform', `translate(${x} ${y})`); $('#ma-mlet').textContent = let_; };
    const screen = (x, y, txt) => { mTxt = txt; };
    const leads = (r, b) => { lr.setAttribute('d', r || ''); lb.setAttribute('d', b || ''); };
    const run = (p, sp, t) => { const dt = t - lastT; lastT = t; dots.step(Math.max(0, Math.min(0.1, dt)), sp, sp > 0); };
    Study.anim(fig, {
      steps: [
        { title: 'Коло працює', cap: 'Замкнене коло: 5&nbsp;В → R1 220&nbsp;Ом → червоний LED. Струм ≈&nbsp;<b>14&nbsp;мА</b>, і він однаковий у кожній точці петлі.', dur: 4 },
        { title: 'Вольтметр — збоку', cap: 'Напругу міряють <b>паралельно</b>: щупи на обидва виводи R1, коло не розривають. Усередині приладу ≈&nbsp;10&nbsp;МОм, тож крізь нього майже нічого не тече, а показ — <b>3,1&nbsp;В</b>.', dur: 4.5 },
        { title: 'Розриваємо коло', cap: 'Для струму коло спершу <b>розривають</b>. Струм зупиняється одразу всюди, LED гасне.', dur: 3.5 },
        { title: 'Амперметр у розрив', cap: 'Амперметр «латає» розрив: весь струм петлі йде крізь прилад. Його опір ≈&nbsp;0, тож струм той самий — <b>14,1&nbsp;мА</b>.', dur: 4.5 },
        { title: 'Помилка: mA на джерело', cap: 'А так не можна: режим mA, щупи на «+» і GND джерела. Струм обмежує лише ≈&nbsp;0&nbsp;Ом приладу — <b>запобіжник F1 0,5&nbsp;А згоряє</b>. LED світить далі, а прилад — ні.', dur: 4.5 },
        { title: 'Підсумок', cap: '<b>V — паралельно</b> деталі, <b>A — послідовно</b>, у розрив. Після вимірювання струму поверніть перемикач на V або OFF.', dur: 4 },
      ],
      draw(i, p, t) {
        if (t < lastT || i !== lastI) { lastT = t; if (i !== lastI) dots.setOff(0); lastI = i; }
        let glow = 1, sp = 46, path = 'loop', gap = 0, tag = '';
        place(0, 0, '', false); screen(0, 0, ''); leads();
        mDial = ['OFF', 'V', 'OFF', 'mA', 'mA', 'V'][i]; mFuse = 'ok';
        if (i === 0) { tag = 'I ≈ 14 мА'; blown = false; fx.clear(); }
        if (i === 1) {
          const g = ease(p / 0.35);
          leads(`M120 44V${lerp(44, 6, g)}${g >= 1 ? 'H133' : ''}`, `M180 44V${lerp(44, 6, g)}${g >= 1 ? 'H167' : ''}`);
          if (g >= 1) { place(150, 6, 'V'); screen(236, 6, p > 0.45 ? '3.10 V' : ''); }
          tag = 'V паралельно R1';
        }
        if (i === 2) { gap = ease(p / 0.4); sp = 46 * (1 - gap); glow = 1 - gap; tag = 'розрив: I = 0'; }
        if (i === 3) {
          gap = 1; const g = ease(p / 0.35);
          const y = lerp(150, 104, g);
          place(255, y, 'A'); leads(`M232 44V${y}H238`, `M278 44V${y}H272`);
          const on = g >= 1; sp = on ? 46 : 0; glow = on ? 1 : 0; path = on ? 'gap' : 'loop';
          screen(255, 150, on && p > 0.45 ? '14.1 mA' : ''); tag = 'A у розриві';
        }
        if (i === 4) {
          const g = ease(p / 0.3);
          place(lerp(150, 18, g), lerp(-2, 130, g), 'A');
          leads(`M60 70H${lerp(150, 18, g)}V${lerp(-2, 130, g) - 17}`, `M60 190H${lerp(150, 18, g)}V${lerp(-2, 130, g) + 17}`);
          if (g >= 1 && p < 0.5) { path = 'src'; sp = 420; tag = 'коротке замикання!'; }
          if (p >= 0.5) {
            if (!blown) { blown = true; MM.blow(); fx.burst(18, 130, 'flash'); fx.burst(18, 130, 'sparks'); fx.burst(18, 120, 'smoke'); }
            tag = 'F1 згорів'; screen(196, 150, '0.00 mA'); mFuse = 'blown';
          }
          if (p < 0.45 && blown) { blown = false; fx.clear(); }
        }
        if (i === 5) {
          gap = 1; path = 'gap';
          leads('M120 44V6H133 M180 44V6H167', 'M232 44V104H238 M278 44V104H272');
          place(150, 6, 'V');
          const a2 = $('#ma-m2') || (() => { const c = m.cloneNode(true); c.id = 'ma-m2'; c.querySelector('text').id = ''; m.after(c); return c; })();
          a2.style.display = ''; a2.setAttribute('transform', 'translate(255 104)'); a2.querySelector('text').textContent = 'A';
          tag = 'V — паралельно · A — у розрив';
        }
        const m2 = $('#ma-m2'); if (m2 && i !== 5) m2.style.display = 'none';
        if (i === 5) { const lrD = 'M120 44V6H133', lbD = 'M180 44V6H167'; lr.setAttribute('d', lrD + ' M232 44V104H238'); lb.setAttribute('d', lbD + ' M278 44V104H272'); }
        // the jumper over the break swings open
        const jy = 44 - 26 * gap;
        $('#ma-jump').setAttribute('d', gap > 0 ? `M232 44L${lerp(278, 268, gap)} ${jy}` : 'M232 44H278');
        $('#ma-glow').setAttribute('opacity', glow.toFixed(2));
        $('#ma-tag').textContent = tag;
        if (i === 5) mTxt = '3.10 V';
        const [dTxt, dU] = mTxt ? mTxt.split(' ') : ['', mDial === 'mA' ? 'mA' : 'V'];
        MM.set({ v: mDial, dial: mDial, display: dTxt, unit: mDial === 'OFF' ? '' : dU, dc: true, fuse: mFuse });
        if (pathEl.getAttribute('d') !== PATHS[path]) pathEl.setAttribute('d', PATHS[path]);
        run(p, sp, t);
        fx.step(Math.min(0.05, Math.max(0, t - (fx._t || 0)))); fx._t = t;
      },
    });
    void I;
  })();
  /* =================================================================== idea cards */
  // 1: the loop — two ammeters always agree
  (function ixLoop() {
    const svg = $('#ix-loop svg'); if (!svg) return;
    let on = false, R = 220;
    const dots = dotsOn($('#ixl-dots'), $('#ixl-path'), 24);
    const I = () => (on ? ledLoop(5, R) : 0);
    const sim = Study.sim(svg, (dt) => dots.step(dt, flowSpeed(I()), on));
    const upd = () => {
      const i = I(), t = on ? fmt.num(i * 1000, 1) + ' мА' : '0';
      $('#ixl-a1').textContent = 'A1 ' + t; $('#ixl-a2').textContent = 'A2 ' + t;
      $('#ixl-glow').setAttribute('opacity', Math.min(1, i / 0.02).toFixed(2));
      $('#ixl-out').textContent = on ? `A1 = A2 = ${t}: скільки зайшло в R1, стільки й вийшло з LED.` : 'Коло розімкнене: струм зупинився всюди одразу, обидва амперметри показують 0.';
      sim.draw();
    };
    $('#ixl-sw').addEventListener('switch', (e) => { on = e.detail.on; upd(); });
    segBind('#ixl-r', (v) => { R = +v; upd(); });
    upd();
  })();

  // 2: voltmeter across R1 / LED1 / both
  (function ixV() {
    if (!$('#ix-v')) return;
    const AT = { r: [70, 130, '3,1 В', '3.10 V', 'На R1 «падає» 5 − 1,9 = 3,1 В.'], led: [160, 220, '1,9 В', '1.90 V', 'На LED1 — його пряма напруга ≈ 1,9 В.'],
      both: [70, 220, '5,0 В', '5.00 V', 'На обох разом — уся напруга джерела: 3,1 + 1,9 = 5 В.'] };
    const MV = L11Kit.meter($('#ixv-meter'), { x: 280, y: 4, scale: 0.088, cables: true });
    segBind('#ixv-at', (v) => draw(v));
    function draw(v) {
      const [x1, x2, , lcd, txt] = AT[v], cx = (x1 + x2) / 2;
      $('#ixv-lr').setAttribute('d', `M${x1} 110V56H${cx - 16}`);
      $('#ixv-lb').setAttribute('d', `M${x2} 110V56H${cx + 16}`);
      $('#ixv-m').setAttribute('transform', `translate(${cx} 56)`);
      MV.set({ v: 'V', dial: 'V', display: lcd.split(' ')[0], unit: 'V', dc: true });
      $('#ixv-out').textContent = txt + ' Коло при цьому не розривали.';
    }
    draw('r');
  })();

  // 3: ammeter in the break / across the LED / across the source
  (function ixA() {
    const svg = $('#ix-a svg'); if (!svg) return;
    const fxl = fxLayer($('#ixa-fx'));
    const MA = L11Kit.meter($('#ixa-meter'), { x: 310, y: 2, scale: 0.088, fuseView: true, cables: true });
    const sim = Study.sim(svg, (dt) => fxl.step(dt)); sim.pause();
    const AT = {
      gap: { m: [170, 74], lr: 'M150 30V74H154', lb: 'M190 30V74H186', jump: false, glow: 1, lcd: '14.1 mA', tag: 'весь струм крізь прилад',
        out: 'Правильно: амперметр у розриві, LED світить, прилад показує ≈ 14 мА — струм петлі.' },
      led: { m: [272, 80], lr: 'M240 50H272V64', lb: 'M240 110H272V96', jump: true, glow: 0, lcd: '22.7 mA', tag: 'LED в обхід',
        out: 'Амперметр став «дротом» в обхід LED: світлодіод гасне, а струм обмежує лише R1: 5 / 220 ≈ 23 мА.' },
      src: { m: [14, 90], lr: 'M50 44H14V74', lb: 'M50 136H14V106', jump: true, glow: 1, lcd: '0.00 mA', tag: 'F1 0,5 А згорів',
        out: 'Коротке замикання джерела: струм нічим не обмежений, запобіжник F1 0,5 А згорів. LED світить далі, а прилад показує 0.' },
    };
    segBind('#ixa-at', (v) => draw(v, true));
    function draw(v, user) {
      const a = AT[v];
      $('#ixa-lr').setAttribute('d', a.lr); $('#ixa-lb').setAttribute('d', a.lb);
      $('#ixa-m').setAttribute('transform', `translate(${a.m[0]} ${a.m[1]})`);
      $('#ixa-x').setAttribute('transform', `translate(${a.m[0]} ${a.m[1]})`);
      $('#ixa-x').toggleAttribute('hidden', v !== 'src');
      $('#ixa-jump').style.display = a.jump ? '' : 'none';
      $('#ixa-glow').setAttribute('opacity', a.glow);
      MA.set({ v: 'mA', dial: 'mA', display: a.lcd.split(' ')[0], unit: 'mA', dc: true, fuse: v === 'src' ? 'blown' : 'ok' });
      if (v === 'src' && user) MA.blow();
      $('#ixa-tag').textContent = a.tag;
      $('#ixa-out').textContent = a.out;
      if (v === 'src' && user && !reduced()) { fxl.burst(14, 90, 'flash'); fxl.burst(14, 90, 'sparks'); fxl.burst(14, 76, 'smoke'); sim.play(); setTimeout(() => sim.pause(), 2400); }
    }
    draw('gap');
  })();

  // 4: the voltage staircase follows the source and the LED colour
  (function ixO() {
    if (!$('#ix-o')) return;
    let vs = 5, vf = 1.9, from = null, tw = null;
    const Y = (v) => 140 - v * 22;           // 0 В at y 140, 5 В at y 30
    function paint(a, b) {                     // a = vs, b = vf (possibly mid-tween)
      const yT = Y(a), yM = Y(b), y0 = Y(0);
      $('#ixo-st').setAttribute('d', `M30 ${yT}H105L135 ${yM}H180L205 ${y0}H262`);
      $('#ixo-dash').setAttribute('d', `M88 ${yM}H135M180 ${yM}H222`);
      $('#ixo-br').setAttribute('d', `M83 ${yT}H93M88 ${yT}V${yM}M83 ${yM}H93`);
      $('#ixo-bl').setAttribute('d', `M213 ${yM}H221M217 ${yM}V${y0}M213 ${y0}H221`);
      $('#ixo-top').textContent = '+' + fmt.num(a, 1) + ' В'; $('#ixo-top').setAttribute('y', yT - 8);
      const ym = (yT + yM) / 2;
      $('#ixo-r1').setAttribute('y', ym + 5); $('#ixo-r1').textContent = 'R1 · ' + fmt.num(a - b, 1) + ' В';
      const yl = (yM + y0) / 2;
      $('#ixo-l1').setAttribute('y', yl - 2); $('#ixo-l2').setAttribute('y', yl + 15); $('#ixo-l2').textContent = fmt.num(b, 1) + ' В';
    }
    // a charge «walks down» the staircase once after each change (short, ≈ 1,6 s)
    const st = $('#ixo-st'), q = $('#ixo-q');
    let qt = 1;
    const sim = Study.sim($('#ixo-svg'), (dt) => {
      if (tw) { tw.t = Math.min(1, tw.t + dt / 0.4); const e = tw.t * tw.t * (3 - 2 * tw.t); paint(tw.a0 + (vs - tw.a0) * e, tw.b0 + (vf - tw.b0) * e); if (tw.t >= 1) tw = null; }
      if (!st.getAttribute('d')) return;
      qt = Math.min(1, qt + dt / 1.6);
      const L = st.getTotalLength(), p = st.getPointAtLength(L * qt);
      q.setAttribute('cx', p.x.toFixed(1)); q.setAttribute('cy', p.y.toFixed(1));
      if (!tw && qt >= 1) sim.pause();
    });
    function upd() {
      if (from && !reduced()) { tw = { t: 0, a0: from[0], b0: from[1] }; qt = 0; sim.play(); } else { paint(vs, vf); qt = 1; sim.draw(); }
      from = [vs, vf];
      const ur = vs - vf, i = ur / 220 * 1000;
      $('#ixo-out').textContent = `${fmt.num(ur, 1)} + ${fmt.num(vf, 1)} = ${fmt.num(vs, 1)} В · I = ${fmt.num(ur, 1)} В / 220 Ом ≈ ${fmt.num(i, 1)} мА`;
      $('#ixo-svg').setAttribute('aria-label', `Сходинки потенціалу: від ${fmt.num(vs, 1)} вольта спуск ${fmt.num(ur, 1)} вольта на резисторі R1, рівний дріт, спуск ${fmt.num(vf, 1)} вольта на світлодіоді до нуля.`);
    }
    segBind('#ixo-vs', (v) => { vs = +v; upd(); });
    segBind('#ixo-c', (v) => { vf = +v; upd(); });
    paint(vs, vf); sim.pause(); upd();
  })();

  // 5: breadboard strips + ohmmeter — a crop of the real WB-102 with a Kit resistor and the UT136C+ on Ω
  (function ixB() {
    const svg = $('#ixb-svg'); if (!svg) return;
    const K = window.Kit;
    // a crop of the board (cols 1–11), the meter stands beside it
    mk('clipPath', { id: 'ixb-clip' }, mk('defs', {}, svg)).appendChild(mk('rect', { x: 0, y: 88, width: 300, height: 340 }));
    const bb = K.part('breadboard', { parent: mk('g', { 'clip-path': 'url(#ixb-clip)' }, svg), size: 'half' });
    // the metal strips under the holes: 5 holes of one column are one conductor, the trench separates the halves
    const metal = mk('g', { id: 'ixb-metal', opacity: 0, 'pointer-events': 'none' }, svg);
    for (let c = 1; c <= 10; c++) for (const [r0, r1] of [['a', 'e'], ['f', 'j']]) {
      const p = bb.hole(c, r0), q = bb.hole(c, r1);
      mk('path', { d: `M${p.x} ${p.y - 8}V${q.y + 8}`, stroke: '#c9a032', 'stroke-width': 13, 'stroke-linecap': 'round', opacity: 0.9 }, metal);
    }
    const tr = bb.hole(8, 'e'), tr2 = bb.hole(8, 'f');
    const lbl = (x, y, t, cls = 'ixb-lbl', a = 'middle') => { const n = mk('text', { x, y, class: cls, 'text-anchor': a }, svg); n.textContent = t; return n; };
    lbl(tr.x, (tr.y + tr2.y) / 2 + 9, 'канавка');
    const rG = mk('g', {}, svg);
    let res = null;
    const rl = lbl(0, 0, 'R1', 'ixb-ref', 'start');
    const sl = lbl(bb.hole(6, 'a').x, bb.hole(6, 'a').y - 16, 'смужка', 'ixb-lbl', 'start');
    void sl;
    const M = L11Kit.meter(svg, { x: 330, y: 96, scale: 0.17, cables: true, cableTo: 1900 });
    let place = 'ok';
    const upd = () => {
      const ok = place === 'ok', p = bb.hole(3, ok ? 'd' : 'a');
      if (res) res.remove();
      res = K.part('resistor', { parent: rG, ohms: 220, x: p.x, y: p.y, rot: 90, title: 'R1 220 Ом' });
      // «R1» right of the part (its box reaches ±1.6 pitch across the body), just above the body's middle (clear of «канавка»)
      rl.setAttribute('x', p.x + 48); rl.setAttribute('y', p.y + 2 * K.P - 16);
      M.set({ v: 'Ω', dial: 'Ω', display: ok ? '220.0' : '0.2', unit: 'Ω', beep: !ok, auto: true });
      $('#ixb-out').textContent = ok ? 'Ніжки в різних смужках: омметр бачить сам резистор — 220 Ом.'
        : 'Обидві ніжки в одній смужці: метал під отворами закоротив R1. Омметр показує ≈ 0 Ом і пищить, наче резистора немає.';
    };
    $('#ixb-sw').addEventListener('switch', (e) => metal.setAttribute('opacity', e.detail.on ? 1 : 0));
    segBind('#ixb-at', (v) => { place = v; upd(); });
    upd();
  })();
});
