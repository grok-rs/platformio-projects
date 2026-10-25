/* Twilight switch bench: model + live drawings shared by lessons/mp1/ and lessons/mp1-review/.
   Page-local helper (not part of the site kit). Loaded with `defer` after ../../assets/kit.js (window.Kit) and before
   the page's inline script; pages call TwKit.* inside their study:ready handler (Study, Schem and Kit exist by then).
   TwKit.real = the bench on the kit's real parts (Kit), TwKit.bench = the 4 IEC schematic panels, TwKit.views = both.

   Values (see the pages' citations): R2 = R3 = R4 = 10 kΩ, BC547B V_BE ≈ 0,7 В, V_CE(sat) ≈ 0,1 В,
   coil SRD-05VDC 70 Ом / 71 мА, LED «лампа» + 220 Ом ≈ 9 мА (twilight-relay), АЦП ≈ 1365 відліків на вольт
   (11 дБ, 0…4095 ≈ 0…3 В, як у розділі 06 уроку), пороги репозиторію DARK 500 / LIGHT 600, опитування 100 мс.
   LDR model from the twilight-relay bench: R = 15 кОм · (10 / E)^0,7 (GL5528: 10–20 кОм при 10 лк, γ ≈ 0,7). */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, k) => a + (b - a) * k;

  const K = {
    V33: 3.3, V5: 5, R2: 10e3, R3: 10e3, R4: 10e3, VBE: 0.7, VCESAT: 0.1,
    I_COIL: 71, I_LAMP: 9, CPV: 4095 / 3.0, PERIOD: 0.1, DARK: 500, LIGHT: 600,
    LAMP_LUX: 6, LDR_TAU: 0.25,
  };
  // E (relative light, «лк» of the twilight-relay model) ↔ R of the LDR
  const rOfLux = (e) => clamp(15000 * Math.pow(10 / Math.max(e, 1e-4), 0.7), 150, 5e6);
  const luxOfR = (r) => 10 * Math.pow(15000 / r, 1 / 0.7);
  // time of day t ∈ [0, 1] (18:00 → 21:00) → LDR resistance. The curve is slow around the dusk crossing
  // (ADC ≈ 550) so the relay spends a few seconds of a sunset near the thresholds, as real dusk does.
  const R_DAY = 20e3, R_NIGHT = 1e6, C_MID = 0.33;
  function ldrAt(t) {
    const u = Math.abs(2 * t - 1), side = t < 0.5 ? -C_MID : 1 - C_MID;
    const f = C_MID + side * (0.22 * u + 0.78 * u * u * u);
    return Math.exp(Math.log(R_DAY) + f * Math.log(R_NIGHT / R_DAY));
  }
  const clock = (t) => { const m = Math.round(18 * 60 + t * 180); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
  const adcOf = (v) => clamp(Math.round(v * K.CPV), 0, 4095);

  /* Electrical state for one moment. f = fault flags (all optional):
     noGnd (no GND–GND wire between the board and the 5 V part), swap (LDR at the bottom), r2open (R2 not on GND),
     r433 (R4 to 3,3 В), noDiode, adc2 (LDR on GPIO14 = ADC2 with Wi-Fi on), noHyst, lamp (lamp shines on the LDR). */
  function solve(rl, gpioHigh, f = {}) {
    let vAdc;
    if (f.r2open) vAdc = K.V33;                          // no current through the divider: the node sits at 3,3 В
    else if (f.swap) vAdc = K.V33 * rl / (rl + K.R2);
    else vAdc = K.V33 * K.R2 / (rl + K.R2);
    const ib = gpioHigh && !f.noGnd ? (K.V33 - K.VBE) / K.R3 * 1000 : 0;   // мА; returns to the board only via common GND
    const vbe = ib > 0 ? K.VBE : 0;
    const vin = ib > 0 ? K.VCESAT : (f.r433 ? K.V33 : K.V5);
    const coil = vin < 1 || !!f.r433;                       // active-LOW; with 3,3 В on IN many modules stay ON
    return { rl, vAdc, ib, vbe, vin, coil, maybe: !!f.r433 && vin > 1, ic: ib > 0 ? (K.V5 - K.VCESAT) / K.R4 * 1000 : 0 };
  }

  /* Firmware: one loop() pass. Returns the new relayOn. */
  function decide(raw, on, cfg) {
    if (!cfg.hyst) return raw < cfg.center;
    if (raw < cfg.dark) return true;
    if (raw > cfg.light) return false;
    return on;
  }

  /* ---------------------------------------------------------------- tiny helpers */
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const mix = (c1, c2, k) => {
    const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const a = p(c1), b = p(c2);
    return '#' + a.map((v, i) => Math.round(lerp(v, b[i], k)).toString(16).padStart(2, '0')).join('');
  };
  function skyColor(t) {
    return t < 0.25 ? '#8ecae6' : t < 0.5 ? mix('#8ecae6', '#f3a259', (t - 0.25) / 0.25) : t < 0.66 ? mix('#f3a259', '#5a4381', (t - 0.5) / 0.16) : mix('#5a4381', '#16213d', clamp((t - 0.66) / 0.22, 0, 1));
  }

  // WebAudio click (only after a user gesture switched the sound on)
  let actx = null;
  function click(on) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const n = actx.createBufferSource(), len = 0.03, buf = actx.createBuffer(1, Math.round(actx.sampleRate * len), actx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length / (on ? 6 : 9)));
      n.buffer = buf;
      const g = actx.createGain(); g.gain.value = on ? 0.5 : 0.35;
      n.connect(g); g.connect(actx.destination); n.start();
    } catch (e) { /* no audio: silent */ }
  }

  /* ---------------------------------------------------------------- the 4-panel bench drawing
     Panels (local 196 × 310): 1 світло + дільник, 2 ESP32 (АЦП + логіка), 3 ключ VT1, 4 модуль реле + лампа.
     Layout «wide» = one row (viewBox 892 × 310), «tall» = 2 × 2 (432 × 640) below 640 px of stage width,
     so every label stays ≥ 13 px on a 375 px phone. */
  const PW = 196, PH = 318;
  const LAYOUT = {
    wide: { vb: '0 0 892 318', at: [[12, 0], [236, 0], [460, 0], [684, 0]],
      c2: (a, b) => `M${a.x} ${a.y}H${a.x + 14}V${b.y}H${b.x}` },
    tall: { vb: '0 0 432 656', at: [[12, 0], [224, 0], [12, 338], [224, 338]],
      c2: (a, b) => `M${a.x} ${a.y}H${a.x + 8}V328H4V${b.y}H${b.x}` },
  };
  const PORTS = { p1out: [196, 214], p2in: [0, 214], p2out: [196, 262], p3in: [0, 170], p3out: [196, 136], p4in: [0, 136] };

  function bench(svg, opts = {}) {
    const id = opts.id || 'tw';
    const R = {};                                         // refs
    const panel = (k, title) => {
      const g = el('g', { class: 'tw-panel', 'data-p': k }, svg);
      el('rect', { class: 'tw-frame', x: 0, y: 0, width: PW, height: PH, rx: 12 }, g);
      el('text', { class: 'tw-title', x: 12, y: 24 }, g).textContent = title;
      return g;
    };
    svg.innerHTML = `<defs>
      <clipPath id="${id}-sky"><rect x="10" y="36" width="176" height="80" rx="8"/></clipPath>
      <radialGradient id="${id}-glow"><stop offset="0" stop-color="#ffe9a0" stop-opacity=".95"/><stop offset=".45" stop-color="#ffd34d" stop-opacity=".45"/><stop offset="1" stop-color="#ffd34d" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}-coil"><stop offset="0" stop-color="#ff9a3d" stop-opacity=".55"/><stop offset="1" stop-color="#ff9a3d" stop-opacity="0"/></radialGradient>
    </defs>`;
    R.links = el('g', { class: 'tw-links' }, svg);
    R.c1 = el('path', { class: 'sch-w net-sig tw-link' }, R.links);
    R.c2 = el('path', { class: 'sch-w net-sig2 tw-link' }, R.links);
    R.c3 = el('path', { class: 'sch-w tw-link', 'data-k': 'in' }, R.links);
    R.c2f = el('path', { class: 'tw-flow' }, R.links);

    /* 1 · light + divider */
    const p1 = R.p1 = panel(1, '1 · СВІТЛО');
    const sky = el('g', { 'clip-path': `url(#${id}-sky)` }, p1);
    R.sky = el('rect', { x: 10, y: 36, width: 176, height: 80, fill: '#8ecae6' }, sky);
    R.stars = el('g', { fill: '#fff', opacity: 0 }, sky);
    [[30, 50], [62, 62], [96, 46], [128, 70], [160, 52], [148, 88], [44, 80]].forEach(([x, y], i) => el('circle', { cx: x, cy: y, r: i % 3 ? 1.4 : 2 }, R.stars));
    R.sun = el('circle', { r: 13, fill: '#ffd34d' }, sky);
    R.moon = el('path', { d: 'M150 50a14 14 0 1 0 12 22a11 11 0 1 1 -12 -22z', fill: '#f4ecd0', opacity: 0 }, sky);
    el('path', { d: 'M10 104Q48 92 84 102T150 98T186 102V116H10Z', fill: '#2d4a32', opacity: 0.85 }, sky);
    el('rect', { x: 10, y: 36, width: 176, height: 80, rx: 8, fill: 'none', class: 'tw-line' }, p1);
    R.clock = el('text', { class: 'tw-sky-t', x: 18, y: 58 }, p1);
    el('text', { class: 'tw-pin net-3v3', x: 70, y: 144 }, p1).textContent = '3V3';
    el('path', { class: 'sch-w net-3v3', d: 'M58 136V146' }, p1);
    el('use', { class: 'sch-sym', href: '#ldr', x: 58, y: 146, transform: 'rotate(90 58 146)' }, p1);
    R.ldrVal = el('text', { class: 'tw-val', x: 92, y: 186 }, p1);
    el('text', { class: 'tw-ref', x: 92, y: 166 }, p1).textContent = 'LDR';
    el('path', { class: 'sch-w net-sig', d: 'M58 206V222' }, p1);
    el('use', { class: 'sch-sym net-sig', href: '#dot', x: 58, y: 214 }, p1);
    el('path', { class: 'sch-w net-sig', d: 'M58 214H196' }, p1);
    R.vAdc = el('text', { class: 'tw-val tw-strong', x: 80, y: 206 }, p1);
    R.g4lbl = el('text', { class: 'tw-pin net-sig', x: 190, y: 236, 'text-anchor': 'end' }, p1); R.g4lbl.textContent = 'GPIO4';
    R.ldrGlow = el('circle', { cx: 58, cy: 176, r: 24, fill: `url(#${id}-glow)`, opacity: 0 }, p1);
    el('use', { class: 'sch-sym', href: '#res', x: 58, y: 222, transform: 'rotate(90 58 222)' }, p1);
    el('text', { class: 'tw-ref', x: 80, y: 262 }, p1).textContent = 'R2 10 кОм';
    R.r2 = el('path', { class: 'sch-w net-gnd', d: 'M58 282V290' }, p1);
    R.r2gnd = el('use', { class: 'sch-sym net-gnd', href: '#gnd', x: 58, y: 290 }, p1);
    R.r2cut = el('path', { class: 'tw-cut', d: 'M48 280l20 14M68 280l-20 14', display: 'none' }, p1);

    /* 2 · ESP32 */
    const p2 = R.p2 = panel(2, '2 · ESP32-S3');
    el('rect', { class: 'tw-board', x: 10, y: 36, width: 176, height: 262, rx: 10 }, p2);
    el('text', { class: 'tw-lbl', x: 22, y: 64 }, p2).textContent = 'АЦП, analogRead';
    R.raw = el('text', { class: 'tw-big', x: 22, y: 100 }, p2);
    R.gaugeG = el('g', {}, p2);
    el('rect', { class: 'tw-gauge', x: 22, y: 112, width: 152, height: 10, rx: 5 }, R.gaugeG);
    R.dz = el('rect', { class: 'tw-dz', x: 22, y: 108, width: 10, height: 18 }, R.gaugeG);
    R.tD = el('path', { class: 'tw-tick' }, R.gaugeG);
    R.tL = el('path', { class: 'tw-tick' }, R.gaugeG);
    R.needle = el('path', { class: 'tw-needle', d: 'M0 0l-6 -9h12z' }, R.gaugeG);
    R.code = [0, 1, 2].map((i) => {
      const g = el('g', {}, p2);
      const bg = el('rect', { class: 'tw-codebg', x: 14, y: 140 + i * 30, width: 168, height: 26, rx: 5 }, g);
      const tx = el('text', { class: 'tw-code', x: 20, y: 159 + i * 30 }, g);
      return { g, bg, tx };
    });
    R.gpio = el('text', { class: 'tw-val tw-strong', x: 22, y: 268 }, p2);
    el('text', { class: 'tw-pin net-sig2', x: 182, y: 286, 'text-anchor': 'end' }, p2).textContent = 'GPIO2';
    R.gpioDot = el('circle', { cx: 184, cy: 262, r: 6, class: 'tw-led' }, p2);

    /* 3 · key VT1 */
    const p3 = R.p3 = panel(3, '3 · КЛЮЧ VT1');
    R.v5lbl = el('text', { class: 'tw-pin net-5v', x: 132, y: 58 }, p3);
    R.v5w = el('path', { class: 'sch-w net-5v', d: 'M120 50V64' }, p3);
    el('use', { class: 'sch-sym', href: '#res', x: 120, y: 64, transform: 'rotate(90 120 64)' }, p3);
    el('text', { class: 'tw-ref', x: 106, y: 90, 'text-anchor': 'end' }, p3).textContent = 'R4';
    el('text', { class: 'tw-lbl', x: 106, y: 112, 'text-anchor': 'end' }, p3).textContent = '10 кОм';
    R.wC = el('path', { class: 'sch-w', d: 'M120 124V140' }, p3);
    el('use', { class: 'sch-sym', href: '#dot', x: 120, y: 136 }, p3);
    el('path', { class: 'sch-w', d: 'M120 136H196' }, p3);
    R.inV = el('text', { class: 'tw-val tw-strong', x: 190, y: 128, 'text-anchor': 'end' }, p3);
    el('text', { class: 'tw-pin', x: 190, y: 158, 'text-anchor': 'end' }, p3).textContent = 'IN';
    el('path', { class: 'sch-w net-sig2', d: 'M0 170H14' }, p3);
    el('use', { class: 'sch-sym', href: '#res', x: 14, y: 170 }, p3);
    el('text', { class: 'tw-ref', x: 44, y: 154, 'text-anchor': 'middle' }, p3).textContent = 'R3';
    el('path', { class: 'sch-w net-sig3', d: 'M74 170H90' }, p3);
    R.npn = el('use', { class: 'sch-sym', href: '#npn', x: 90, y: 170 }, p3);
    R.npnGlow = el('circle', { cx: 112, cy: 170, r: 26, class: 'tw-npnglow', opacity: 0 }, p3);
    el('path', { class: 'sch-w net-gnd', d: 'M120 200V226' }, p3);
    el('use', { class: 'sch-sym net-gnd', href: '#gnd', x: 120, y: 226 }, p3);
    el('text', { class: 'tw-ref', x: 132, y: 192 }, p3).textContent = 'BC547B';
    R.flowB = el('path', { class: 'tw-flow', d: 'M2 170H90L120 196V224' }, p3);
    R.flowC = el('path', { class: 'tw-flow', d: 'M120 52V140L120 196V224' }, p3);
    R.ib = el('text', { class: 'tw-lbl', x: 14, y: 264 }, p3);
    R.vbe = el('text', { class: 'tw-lbl', x: 14, y: 290 }, p3);
    R.gndCut = el('g', { display: 'none' }, p3);
    el('path', { class: 'tw-cut', d: 'M106 236l28 18M134 236l-28 18' }, R.gndCut);

    /* 4 · relay module + lamp */
    const p4 = R.p4 = panel(4, '4 · РЕЛЕ → ЛАМПА');
    el('rect', { class: 'tw-board', x: 10, y: 36, width: 176, height: 160, rx: 10 }, p4);
    el('path', { class: 'sch-w', d: 'M0 136H24' }, p4);
    el('text', { class: 'tw-lbl', x: 20, y: 60 }, p4).textContent = 'active-LOW';
    R.coilGlow = el('ellipse', { cx: 54, cy: 106, rx: 44, ry: 26, fill: `url(#${id}-coil)`, opacity: 0 }, p4);
    el('path', { class: 'sch-w', d: 'M24 136V106' }, p4);
    el('use', { class: 'sch-sym', href: '#relay-coil', x: 24, y: 106 }, p4);
    R.diode = el('g', {}, p4);
    el('path', { class: 'sch-w', d: 'M24 106V80M84 80V106', fill: 'none' }, R.diode);
    el('use', { class: 'sch-sym', href: '#diode', x: 84, y: 80, transform: 'rotate(180 84 80)' }, R.diode);
    el('text', { class: 'tw-lbl', x: 92, y: 86 }, R.diode).textContent = 'D1';
    R.noDiode = el('text', { class: 'tw-bad', x: 90, y: 86, display: 'none' }, p4);
    R.noDiode.textContent = '✗ D1';
    el('path', { class: 'tw-mech', d: 'M54 118V152H104' }, p4);
    R.blade = el('line', { class: 'tw-blade', x1: 112, y1: 140, x2: 166, y2: 112 }, p4);
    el('circle', { cx: 112, cy: 140, r: 4.5, class: 'tw-pt' }, p4);
    el('circle', { cx: 168, cy: 110, r: 4.5, class: 'tw-pt' }, p4);
    el('circle', { cx: 168, cy: 152, r: 4.5, class: 'tw-pt' }, p4);
    el('text', { class: 'tw-pin', x: 156, y: 98 }, p4).textContent = 'NC';
    el('text', { class: 'tw-pin', x: 136, y: 182 }, p4).textContent = 'NO';
    el('text', { class: 'tw-pin', x: 88, y: 186 }, p4).textContent = 'COM';
    R.onLed = el('circle', { cx: 30, cy: 170, r: 7, class: 'tw-led' }, p4);
    el('text', { class: 'tw-lbl', x: 42, y: 176 }, p4).textContent = 'ON';
    R.clack = el('text', { class: 'tw-clack', x: 140, y: 130, 'text-anchor': 'middle', opacity: 0 }, p4);
    R.clack.textContent = 'клац!';
    R.lampW = el('path', { class: 'sch-w', d: 'M168 152V234' }, p4);
    R.glow = el('circle', { cx: 160, cy: 254, r: 64, fill: `url(#${id}-glow)`, opacity: 0 }, p4);
    R.bulb = el('circle', { cx: 160, cy: 254, r: 20, class: 'tw-bulb' }, p4);
    el('path', { class: 'tw-fil', d: 'M150 258l5 -10l5 10l5 -10l5 10' }, p4);
    el('path', { class: 'tw-line', d: 'M152 274h16v10h-16z', fill: 'none' }, p4);
    el('text', { class: 'tw-lbl', x: 14, y: 238 }, p4).textContent = 'лампа';
    R.lampI = el('text', { class: 'tw-val', x: 14, y: 264 }, p4);
    R.coilI = el('text', { class: 'tw-lbl', x: 14, y: 290 }, p4);
    R.lampRay = el('text', { class: 'tw-bad', x: 14, y: 214, display: 'none' }, p4); R.lampRay.textContent = '↺ світить на LDR';
    R.spark = el('text', { class: 'tw-bad', x: 54, y: 140, 'text-anchor': 'middle', opacity: 0 }, p4); R.spark.textContent = '⚡ викид';

    let mode = '';
    const place = () => {
      const wpx = svg.getBoundingClientRect().width || 900;
      const m = wpx < 640 ? 'tall' : 'wide';
      if (m === mode) return;
      mode = m;
      const L = LAYOUT[m];
      svg.setAttribute('viewBox', L.vb);
      svg.dataset.layout = m;
      [R.p1, R.p2, R.p3, R.p4].forEach((g, i) => g.setAttribute('transform', `translate(${L.at[i][0]} ${L.at[i][1]})`));
      const pt = (pi, k) => ({ x: L.at[pi][0] + PORTS[k][0], y: L.at[pi][1] + PORTS[k][1] });
      const a1 = pt(0, 'p1out'), b1 = pt(1, 'p2in'), a2 = pt(1, 'p2out'), b2 = pt(2, 'p3in'), a3 = pt(2, 'p3out'), b3 = pt(3, 'p4in');
      R.c1.setAttribute('d', `M${a1.x} ${a1.y}H${b1.x}`);
      const d2 = L.c2(a2, b2);
      R.c2.setAttribute('d', d2); R.c2f.setAttribute('d', d2);
      R.c3.setAttribute('d', `M${a3.x} ${a3.y}H${b3.x}`);
    };
    place();
    if ('ResizeObserver' in window) new ResizeObserver(place).observe(svg);

    let blade = 0, clack = 0, phase = 0, spark = 0;
    /* s = { t, rl, vAdc, raw, on, el (solve result), arm (contact on NO), cfg {hyst, dark, light, center}, f (faults), wifi } */
    function render(s, dt = 0) {
      const fm = Study.fmt;
      const t = s.t;
      // sky
      R.sky.setAttribute('fill', skyColor(t));
      const sk = clamp(t / 0.55, 0, 1);
      R.sun.setAttribute('cx', (118 + 44 * sk).toFixed(1)); R.sun.setAttribute('cy', (60 + 56 * sk).toFixed(1));
      R.moon.setAttribute('opacity', clamp((t - 0.6) / 0.25, 0, 1).toFixed(2));
      R.stars.setAttribute('opacity', clamp((t - 0.62) / 0.3, 0, 1).toFixed(2));
      R.clock.textContent = s.clock || clock(t);
      R.clock.classList.toggle('night', t > 0.5);
      R.ldrVal.textContent = fm.si(s.rl, 'Ом', 2);
      R.vAdc.textContent = `${fm.num(s.vAdc, 2, true)} В`;
      R.r2.setAttribute('display', s.f.r2open ? 'none' : ''); R.r2gnd.setAttribute('opacity', s.f.r2open ? 0.3 : 1);
      R.r2cut.setAttribute('display', s.f.r2open && !s.hideMarks ? '' : 'none');
      // ADC + logic
      const bad = s.raw > 4095;
      R.raw.textContent = s.raw == null ? '—' : String(s.raw);
      R.raw.classList.toggle('bad', bad);
      const gx = (v) => 22 + 152 * clamp(v / 1600, 0, 1);
      const cfg = s.cfg;
      const d = cfg.hyst ? cfg.dark : cfg.center, l = cfg.hyst ? cfg.light : cfg.center;
      R.dz.setAttribute('x', gx(d)); R.dz.setAttribute('width', Math.max(0, gx(l) - gx(d)));
      R.tD.setAttribute('d', `M${gx(d)} 106V128`); R.tL.setAttribute('d', `M${gx(l)} 106V128`);
      R.needle.setAttribute('transform', `translate(${gx(s.raw == null ? 0 : s.raw).toFixed(1)} 110)`);
      const lines = cfg.hyst
        ? [`adc<${cfg.dark} → ON`, `adc>${cfg.light} → OFF`, 'інакше: як було']
        : [`adc<${cfg.center} → ON`, 'інакше → OFF', '(один поріг)'];
      const act = s.raw == null ? -1 : cfg.hyst ? (s.raw < cfg.dark ? 0 : s.raw > cfg.light ? 1 : 2) : (s.raw < cfg.center ? 0 : 1);
      R.code.forEach((c, i) => { c.tx.textContent = lines[i]; c.g.classList.toggle('act', i === act); c.g.classList.toggle('dim', !cfg.hyst && i === 2); });
      R.gpio.textContent = s.on ? 'HIGH 3,3 В' : 'LOW 0 В';
      R.gpio.classList.toggle('hi', s.on);
      R.gpioDot.classList.toggle('on', s.on);
      R.c2.classList.toggle('hi', s.on);
      // key
      const e = s.el;
      R.v5lbl.textContent = s.f.r433 ? (s.hideMarks ? '+3,3 В' : '+3,3 В ✗') : '+5 В';
      R.v5lbl.setAttribute('class', `tw-pin ${s.f.r433 ? 'net-3v3' : 'net-5v'}`);
      R.v5w.setAttribute('class', `sch-w ${s.f.r433 ? 'net-3v3' : 'net-5v'}`);
      R.inV.textContent = `${fm.num(e.vin, 1, true)} В`;
      R.inV.classList.toggle('lo', e.vin < 1);
      R.c3.classList.toggle('lo', e.vin < 1);
      R.npnGlow.setAttribute('opacity', e.ib > 0 ? 0.9 : 0);
      R.ib.textContent = `I_B ${fm.num(e.ib, 2, true)} мА`;
      R.vbe.textContent = `V_BE ${fm.num(e.vbe, 1, true)} В`;
      R.gndCut.setAttribute('display', s.f.noGnd && !s.hideMarks ? '' : 'none');
      // relay + lamp
      const target = s.arm ? 1 : 0;
      if (target !== (blade > 0.5 ? 1 : 0) && clack <= 0 && Math.abs(blade - target) > 0.5) clack = 1;
      blade = dt ? blade + clamp(target - blade, -dt * 14, dt * 14) : target;
      const bx = 166, by = lerp(112, 150, blade);
      R.blade.setAttribute('x2', bx); R.blade.setAttribute('y2', by.toFixed(1));
      R.coilGlow.setAttribute('opacity', e.coil ? 1 : 0);
      R.onLed.classList.toggle('on', e.coil);
      R.diode.setAttribute('opacity', s.f.noDiode ? (s.hideMarks ? 0 : 0.25) : 1);
      R.noDiode.setAttribute('display', s.f.noDiode && !s.hideMarks ? '' : 'none');
      R.glow.setAttribute('opacity', s.arm ? 1 : 0);
      R.bulb.classList.toggle('on', s.arm);
      R.lampI.textContent = s.arm ? `≈${K.I_LAMP} мА` : '0 мА';
      R.coilI.textContent = e.coil ? `котушка ≈${K.I_COIL} мА` : 'котушка 0 мА';
      R.lampRay.setAttribute('display', s.f.lamp && s.arm ? '' : 'none');
      R.ldrGlow.setAttribute('opacity', s.f.lamp && s.arm ? 0.9 : 0);
      R.g4lbl.textContent = s.f.adc2 ? 'GPIO14' : 'GPIO4';
      if (spark > 0) spark = Math.max(0, spark - (dt || 1) * 1.5);
      R.spark.setAttribute('opacity', spark.toFixed(2));
      if (clack > 0) { clack = Math.max(0, clack - (dt || 1) * 2.2); }
      R.clack.setAttribute('opacity', clack.toFixed(2));
      // current flow (dash offset, driven by the caller's sim)
      phase += dt * 40;
      const fl = (p, on) => { p.style.display = on ? '' : 'none'; if (on) p.style.strokeDashoffset = (-phase).toFixed(1); };
      fl(R.flowB, e.ib > 0); fl(R.flowC, e.ib > 0); fl(R.c2f, e.ib > 0);
    }
    return { render, place, refs: R, kick() { clack = 1; }, sparkle() { spark = 1; } };
  }

  /* ---------------------------------------------------------------- the REAL bench (window.Kit parts, our kit)
     The same switch as it stands on the table, laid out like the course's reference breadboards: the YD-ESP32-S3 lies IN
     a full WB-102 breadboard (headers in rows i and b, so rows j and a stay free), parts share the 5-hole strips and the
     few jumpers are Kit.route lines on the hole grid — no crossings, nothing over a part.
       MB102 on the left end: top rail jumper OFF (the top + rail carries the board's 3,3 В), bottom rails 5 В. MB102 GND
       is on both «−» rails.
       ESP32-S3 pin 1 (3V3) in column 22: j22 3V3, j25 GPIO4, j41 GPIO14, j43 GND; a22 GND, a26 GPIO2, a42/a43 GND.
       Divider (top half, right of the board): GND strip 48 ← black bridge from a43 (the board's own GND: the divider works
       without the GND–GND wire); R2 c48–c52; LDR b52–b53 (its face looks up, at the sky); node 52 ← GPIO4 (yellow, along
       the lane under row j); 3V3 strip 53 ← j22 (orange lane) and on to the top «+» rail at column 55.
       Swapped divider (fault swap): LDR b48–b49, R2 c49–c53, GPIO4 to node 49.
       Key (left of the board): GPIO2 a26 → blue jumper over the top lane → a17; R3 stands across the trench d17–f17;
       VT1 BC547B (flat face to you) C16-B17-E18 in row i; R4 f12–f16, j12 → bottom «+» (5 В); E j18 → bottom «−».
       GND–GND: a42 → top «−» rail (MB102 GND) — removing it is the noGnd fault (the divider still works, VT1 does not).
       Relay module below the board, header aligned to column 42: VCC ← «+» 40, GND ← «−» 39, IN ← collector j16.
       «Lamp»: COM → bottom «+» 61, NO → j63, 220 Ом i59–i63, yellow LED A h59 / K h60, j60 → bottom «−».
     Units: Kit units (0,1 мм). opts: lamp (true), sky (true), tags (true: live value labels), nets (false: tag wires
     with data-net for Schem.link), layout ('auto' | 'wide' | 'tall'), labels (part refs R1…, default = !tags), vb. */
  const RELAY_AT = { col: 42, y: 26 };                 // relay header: VCC pin under column 42, 26 pitches down
  // tag anchors: [x, y, text-anchor]; f = font size. «tall» (phones) keeps the same bench and stacks the tags under it.
  const KIT_LAYOUT = {
    wide: { sky: [1090, -340, 560, 300], font: 28,
      vb: () => [-170, -360, 1860, 1310],
      tags: (f) => ({ ldr: [1060, -64, 'end'], adc: [600, 594, 'start'], gpio: [470, -64, 'start'], lamp: [1500, 864, 'middle'],
        ib: [10, 774, 'start'], vin: [540, 774, 'start'], coil: [1200, 864, 'middle'], clack: [1320, 914, 'middle'],
        spark: [1000, 914, 'middle'], hint: [10, -150, 'start'], r433: [10, -64, 'start'] }) },
    tall: { sky: [1090, -340, 560, 300], font: 48,
      vb: (f) => [-170, -360, 1860, 1260 + 9 * f * 1.7],
      tags: (f) => {
        const y0 = 900 + f, dy = f * 1.7, x = -150;
        return { ldr: [x, y0, 'start'], adc: [x, y0 + dy, 'start'], gpio: [x, y0 + 2 * dy, 'start'], ib: [x, y0 + 3 * dy, 'start'],
          vin: [x, y0 + 4 * dy, 'start'], coil: [x, y0 + 5 * dy, 'start'], lamp: [x, y0 + 6 * dy, 'start'],
          clack: [x, y0 + 7 * dy, 'start'], spark: [x + 12 * f * 0.62, y0 + 7 * dy, 'start'], hint: [x, y0 + 8 * dy, 'start'],
          r433: [x + 12 * f * 0.62, y0 + 8 * dy, 'start'] };
      } },
  };
  function real(svg, opts = {}) {
    const Kit = window.Kit;
    if (!Kit) return null;
    const o = Object.assign({ lamp: true, sky: true, tags: true, nets: false, layout: 'auto' }, opts);
    if (o.labels == null) o.labels = !o.tags;
    const id = o.id || 'twk';
    let mode = '', key = '', R = {}, cache = {}, FS = 28;
    const tag = (parent, x, y, anchor = 'start', cls = '') => {
      const g = el('g', { class: `tw-tag ${cls}`.trim() }, parent);
      const r = el('rect', { class: 'tw-tag-bg', rx: 8 }, g);
      const t = el('text', { x, y, 'text-anchor': anchor, 'dominant-baseline': 'central' }, g);
      g.set = (s) => {
        if (g._s === s) return; g._s = s;
        t.textContent = s;
        const fs = FS * (g.classList.contains('tw-tag-clock') ? 1.2 : 1), w = Math.max(1, s.length) * fs * 0.62 + fs * 0.7, h = fs * 1.45;
        const x0 = anchor === 'end' ? x - w + fs * 0.35 : anchor === 'middle' ? x - w / 2 : x - fs * 0.35;
        r.setAttribute('x', x0.toFixed(1)); r.setAttribute('y', (y - h / 2).toFixed(1));
        r.setAttribute('width', w.toFixed(1)); r.setAttribute('height', h.toFixed(1));
        g.style.display = s ? '' : 'none';
      };
      return g;
    };
    const ref = (parent, x, y, s, anchor = 'middle') => { const t = el('text', { class: 'tw-kref', x, y, 'text-anchor': anchor, 'dominant-baseline': 'central' }, parent); t.textContent = s; return t; };

    function build(f) {
      const L = KIT_LAYOUT[mode], P = Kit.P;
      svg.replaceChildren();
      svg.setAttribute('viewBox', (o.vb || L.vb(FS)).join(' '));
      svg.dataset.layout = mode;
      R = { w: {} };
      cache = {};
      const root = el('g', { class: 'tw-kroot' }, svg);
      // sky window (the light that falls on the LDR)
      if (o.sky) {
        const [sx, sy, sw, sh] = L.sky;
        el('defs', {}, root).innerHTML = `<clipPath id="${id}-ksky"><rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="22"/></clipPath>`;
        const sk = el('g', { 'clip-path': `url(#${id}-ksky)` }, root);
        R.sky = el('rect', { x: sx, y: sy, width: sw, height: sh, fill: '#8ecae6' }, sk);
        R.stars = el('g', { fill: '#fff', opacity: 0 }, sk);
        [[0.08, 0.2], [0.22, 0.42], [0.37, 0.14], [0.52, 0.5], [0.68, 0.22], [0.83, 0.4], [0.93, 0.12], [0.6, 0.66]]
          .forEach(([kx, ky], i) => el('circle', { cx: sx + kx * sw, cy: sy + ky * sh, r: i % 3 ? 4 : 6 }, R.stars));
        R.sun = el('circle', { r: Math.min(sw, sh) * 0.1, fill: '#ffd34d' }, sk);
        R.moon = el('path', { fill: '#f4ecd0', opacity: 0, d: '' }, sk);
        const mr = Math.min(sw, sh) * 0.09, mx = sx + sw * 0.8, my = sy + sh * 0.26;
        R.moon.setAttribute('d', `M${mx} ${my - mr}a${mr} ${mr} 0 1 0 ${mr * 0.86} ${mr * 1.5}a${mr * 0.8} ${mr * 0.8} 0 1 1 ${-mr * 0.86} ${-mr * 1.5}z`);
        el('path', { fill: '#2d4a32', opacity: 0.9, d: `M${sx} ${sy + sh * 0.8}Q${sx + sw * 0.25} ${sy + sh * 0.68} ${sx + sw * 0.5} ${sy + sh * 0.78}T${sx + sw} ${sy + sh * 0.74}V${sy + sh}H${sx}Z` }, sk);
        el('rect', { class: 'tw-kframe', x: sx, y: sy, width: sw, height: sh, rx: 22 }, root);
        R.skyBox = L.sky;
      }
      // full breadboard + MB102 on its left end (top rail OFF = the board's 3,3 В, bottom rails 5 В)
      const bb = R.bb = Kit.part('breadboard', { parent: root, title: 'Макетна плата WB-102' });
      const A = (s) => bb.at(s), X = (c) => bb.hole(c, 'a').x, Y = (r) => bb.hole(1, r).y, pt = (x, y) => ({ x, y });
      const laneT = Y('a') - P * 1.15;                     // strip between the top rails and row a
      const laneG = Y('j') + P * 1.15;                     // lane between row j and the bottom rails (under the column numbers)
      const laneV = bb.at('bottom-1').y + P * 1.1;          // lane along the bottom edge, under the «−» rail
      R.pm = Kit.part('power-module', { parent: root, ...A('top+3'), title: 'Модуль живлення MB102: нижні шини 5 В, верхня перемичка OFF' });
      R.pm.set({ on: true, top: 'OFF', bottom: '5V' });
      // ESP32-S3 in the holes: left header (3V3, GPIO4 …) in row i, right header (GND, GPIO2 …) in row b
      const e0 = bb.hole(23, 'i');
      R.esp = Kit.part('esp32s3', { parent: root, x: e0.x, y: e0.y, rot: -90, title: 'Плата YD-ESP32-S3 у макетці: 3V3 — j23, GPIO4 — j26, GPIO2 — a27' });
      // divider (swap: LDR at the GND end, R2 at the 3V3 end)
      const sw = !!f.swap, node = sw ? 49 : 52;
      R.r2 = Kit.part('resistor', { parent: root, ohms: 10000, ...A(sw ? 'd49' : 'd48'), title: 'R2 10 кОм (коричневий-чорний-оранжевий)' });
      R.ldr = Kit.part('ldr', { parent: root, ...A(sw ? 'b48' : 'b52'), leg: 40, title: 'Фоторезистор LDR (R1)' });
      // key: R3 across the trench, VT1 (C16 B17 E18), R4 to 5 В
      R.r3 = Kit.part('resistor', { parent: root, ohms: 10000, ...A('d18'), rot: 90, title: 'R3 10 кОм: GPIO2 → база (через канавку)' });
      R.q = Kit.part('npn', { parent: root, ...A('i17'), leg: 20, model: 'BC547B', legLabels: false, title: 'VT1 BC547B, плоский бік до вас: C-B-E' });
      R.r4 = Kit.part('resistor', { parent: root, ohms: 10000, ...A('f13'), title: 'R4 10 кОм: колектор → +5 В' });
      // the «lamp»: 220 Ом + yellow LED on the right end
      if (o.lamp) {
        R.r220 = Kit.part('resistor', { parent: root, ohms: 220, ...A('j58'), title: 'Резистор 220 Ом лампи' });
        R.led = Kit.part('led', { parent: root, ...A('i58'), color: 'yellow', leg: 40, mirror: true, title: 'Лампа: жовтий світлодіод' });
      }
      // relay module under the board, header in line with column 42
      const rv = pt(X(RELAY_AT.col), RELAY_AT.y * P);
      R.relay = Kit.part('relay-module', { parent: root, ...rv, title: 'Модуль реле 5 В, active-LOW (TONGLING JQC-3FF-S-Z)' });
      R.relayXf = R.relay.querySelector('.kit-xf');
      if (f.noDiode) {   // D1 desoldered: bare pads on the module
        const pg = el('g', { class: 'tw-nod1' }, R.relayXf);
        el('rect', { x: 68, y: 46, width: 38, height: 25, fill: '#1c74b8' }, pg);
        el('rect', { x: 74, y: 52, width: 7, height: 13, fill: '#c3c6ca' }, pg); el('rect', { x: 93, y: 52, width: 7, height: 13, fill: '#c3c6ca' }, pg);
      }
      // wires: Kit.route on the hole grid
      const wires = el('g', { class: 'tw-kwires' }, root);
      const W = (k, pts, col, net) => {
        const w = Kit.route(wires, pts, col);
        if (o.nets && net) w.setAttribute('data-net', net);
        if (col === 'black') {   // a thin edge so black jumpers stay visible off the board on a dark page
          const edge = w.path.cloneNode(false);
          edge.removeAttribute('class'); edge.setAttribute('class', 'tw-edge'); edge.removeAttribute('stroke');
          w.insertBefore(edge, w.firstChild);
        }
        const halo = w.path.cloneNode(false);
        halo.removeAttribute('class'); halo.setAttribute('class', 'tw-halo'); halo.removeAttribute('stroke');
        w.insertBefore(halo, w.firstChild);
        const fl = w.path.cloneNode(false);
        fl.setAttribute('class', 'tw-kflow'); fl.removeAttribute('stroke'); fl.style.display = 'none';
        w.appendChild(fl);
        w.flow = fl;
        R.w[k] = w;
        return w;
      };
      const ghost = (k, pts) => {   // a missing jumper: dashed outline on its tidy route + ✗ (hidden in riddles)
        const g = el('g', { class: 'tw-ghost' }, root);
        el('path', { d: 'M' + pts.map((p) => `${p.x} ${p.y}`).join('L') }, g);
        let m = pts[0], best = -1;
        for (let i = 1; i < pts.length; i++) {
          const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
          if (l > best) { best = l; m = { x: (pts[i].x + pts[i - 1].x) / 2, y: (pts[i].y + pts[i - 1].y) / 2 }; }
        }
        el('path', { class: 'tw-x', d: `M${m.x - 18} ${m.y - 18}l36 36M${m.x + 18} ${m.y - 18}l-36 36` }, g);
        R['ghost_' + k] = g;
      };
      const RP = R.relay.pins;
      // the WB-102 rails are split after column 31: MB102 (left end) feeds only the left halves, so every rail is
      // bridged across the gap with a short jumper along its own row (5 В, both GND rails, and the board's 3,3 В)
      W('br5', [A('bottom+31'), A('bottom+33')], 'red', 'v5');
      W('brg', [A('bottom-31'), A('bottom-33')], 'black', 'gnd');
      W('br3', [A('top+31'), A('top+33')], 'orange', 'v33');
      W('brt', [A('top-31'), A('top-33')], 'black', 'gnd');
      // 3V3: j22 → lane → strip 53 (LDR), strip 53 → top «+» rail
      W('v33', [A('j23'), pt(X(23), laneV), pt(X(53), laneV), A('e53')], 'orange', 'v33');
      W('v33b', [A('c53'), pt(X(57), Y('c')), A('top+57')], 'orange', 'v33');
      // GPIO4 (or GPIO14) → node
      const src = f.adc2 ? 42 : 26;
      W('adc', [A('j' + src), pt(X(src), laneG), pt(X(node), laneG), A('e' + node)], 'yellow', 'adc');
      // the board's GND → divider (bridge); GND–GND → top «−» rail (MB102 GND)
      const bridge = [A('a44'), pt(X(44), laneT), pt(X(46), laneT), pt(X(46), Y('c')), A('c48')];
      if (f.r2open) ghost('r2', bridge); else W('gnd', bridge, 'black', 'gnd');
      const gg = [A('a43'), A('top-43')];
      if (f.noGnd) ghost('gnd', gg); else W('gg', gg, 'black', 'gnd');
      // GPIO2 → R3 (top lane), emitter → «−», R4 → +5 В (or 3,3 В: fault r433)
      W('g2', [A('a27'), pt(X(27), laneT), pt(X(18), laneT), A('a18')], 'blue', 'gpio2');
      W('e', [A('j19'), A('bottom-19')], 'black', 'gnd');
      if (f.r433) W('r4', [A('g13'), pt(X(12), Y('g')), A('top+12')], 'orange', 'v33');
      else W('r4', [A('j13'), A('bottom+13')], 'red', 'v5');
      // relay module: IN from the collector strip, VCC / GND from the bottom rails
      W('in', [A('j17'), pt(X(17), RP.IN.y), RP.IN], 'green', 'in');
      W('vcc', [A('bottom+22'), pt(X(22), RP.VCC.y), RP.VCC], 'red', 'v5');
      W('mgnd', [A('bottom-21'), pt(X(21), RP.GND.y), RP.GND], 'black', 'gnd');
      if (o.lamp) {
        W('com', [RP.COM, pt(X(61), RP.COM.y), A('bottom+61')], 'red', 'v5');
        W('no', [RP.NO, pt(X(63), RP.NO.y), pt(X(63), Y('h')), A('h62')], 'white', 'lamp');
        W('lk', [A('j57'), A('bottom-57')], 'black', 'gnd');
      }
      // overlays: refs, tags, fault marks, events
      const ov = el('g', { class: 'tw-kov' }, root);
      if (o.labels) {
        const top = -46, bot = 566;                          // above the board / under it, clear of every wire
        if (f.swap) {   // LDR on the GND end (left), R2 to its right: the refs swap sides too
          ref(ov, R.ldr.toParent(12.7, 0).x - 30, top, 'R1', 'end');
          ref(ov, (R.r2.pins[1].x + R.r2.pins[2].x) / 2 - 12, top, 'R2', 'start');
        } else {
          ref(ov, R.ldr.toParent(12.7, 0).x + 30, top, 'R1', 'start');
          ref(ov, (R.r2.pins[1].x + R.r2.pins[2].x) / 2 + 12, top, 'R2', 'end');
        }
        ref(ov, X(18), top, 'R3');
        ref(ov, X(17) - 16, bot, 'R4', 'end');
        ref(ov, X(17) + 16, bot, 'VT1', 'start');
        ref(ov, X(33), top, 'U1 · YD-ESP32-S3');
        ref(ov, RP.VCC.x + 250, RP.VCC.y + 196, 'U2 · модуль реле');
        ref(ov, A('top+3').x, top, 'MB102');
      }
      if (o.tags) {
        const T = R.tags = {};
        if (o.sky) T.clock = tag(ov, L.sky[0] + FS * 1.1, L.sky[1] + FS * 1.6, 'start', 'tw-tag-clock');
        const TP = L.tags(FS);
        for (const k of ['ldr', 'adc', 'gpio', 'ib', 'vin', 'coil']) T[k] = tag(ov, ...TP[k]);
        if (o.lamp) T.lamp = tag(ov, ...TP.lamp);
        T.clack = tag(ov, ...TP.clack, 'tw-tag-ev');
        T.spark = tag(ov, ...TP.spark, 'tw-tag-bad');
        T.hint = tag(ov, ...TP.hint, 'tw-tag-bad');
        if (f.r433) tag(ov, ...TP.r433, 'tw-tag-bad tw-kbad').set('R4 → 3,3 В ✗');
      } else if (f.r433) tag(ov, X(11), -46, 'start', 'tw-tag-bad tw-kbad').set('R4 → 3,3 В ✗');
      // lamp shining on the LDR
      if (o.lamp) {
        const a = R.led.toParent(12.7, -120), b = R.ldr.toParent(12.7, -70);
        R.beam = el('path', { class: 'tw-beam', d: `M${a.x} ${a.y}Q${(a.x + b.x) / 2 + 160} ${(a.y + b.y) / 2} ${b.x + 40} ${b.y + 10}`, display: 'none' }, ov);
      }
      if (f.noDiode) { const p = R.relay.toParent(87, 58); el('circle', { class: 'tw-ring', cx: p.x, cy: p.y, r: 34 }, ov); }
    }

    let blade = 0, clack = 0, spark = 0;
    // labels a student reads stay >= 13 px: the font grows when the drawing renders small (e.g. a 700 px tablet)
    const place = () => {
      const wpx = svg.getBoundingClientRect().width || 900;
      const m = o.layout !== 'auto' ? o.layout : wpx < 640 ? 'tall' : 'wide';
      const vbw = (o.vb || KIT_LAYOUT[m].vb(KIT_LAYOUT[m].font))[2];
      const fs = Math.max(KIT_LAYOUT[m].font, Math.ceil(13.4 * vbw / Math.max(wpx, 200)));
      if (m !== mode || (o.tags && fs !== FS && svg.getBoundingClientRect().width)) {
        mode = m; key = '';
        if (o.tags) { FS = fs; svg.style.setProperty('--tw-fs', fs + 'px'); }
      }
    };
    const fkey = (f) => ['swap', 'adc2', 'noGnd', 'r2open', 'r433', 'noDiode'].map((k) => (f[k] ? 1 : 0)).join('');
    const setOnce = (k, v, fn) => { if (cache[k] !== v) { cache[k] = v; fn(v); } };
    function render(s, dt = 0) {
      place();
      const f = s.f || {};
      const kk = mode + fkey(f) + (s.hideMarks ? 'h' : '');
      if (kk !== key) { key = kk; build(f); }
      const fm = Study.fmt, e = s.el || {};
      $$sel(svg, '.tw-ghost, .tw-ring, .tw-kbad').forEach((n) => { n.style.display = s.hideMarks ? 'none' : ''; });
      if (R.sky) {
        const t = s.t;
        R.sky.setAttribute('fill', skyColor(t));
        const [sx, sy, sw, sh] = R.skyBox, k = clamp(t / 0.55, 0, 1);
        R.sun.setAttribute('cx', (sx + sw * (0.3 + 0.35 * k)).toFixed(1)); R.sun.setAttribute('cy', (sy + sh * (0.3 + 0.62 * k)).toFixed(1));
        R.moon.setAttribute('opacity', clamp((t - 0.6) / 0.25, 0, 1).toFixed(2));
        R.stars.setAttribute('opacity', clamp((t - 0.62) / 0.3, 0, 1).toFixed(2));
      }
      // hardware states
      const light = s.rl ? clamp(Math.log10(1e6 / s.rl) / Math.log10(1e6 / 2e3), 0, 1) : 0.6;
      setOnce('ldr', light.toFixed(2), (v) => R.ldr.set({ light: +v }));
      setOnce('esp', s.on ? 1 : 0, (v) => R.esp.set({ highlight: v ? ['GPIO2'] : null }));
      setOnce('rel', e.coil ? 1 : 0, (v) => R.relay.set({ on: !!v, power: true }));
      if (R.led) setOnce('led', s.arm ? 1 : 0, (v) => R.led.set({ on: v }));
      if (R.beam) R.beam.setAttribute('display', f.lamp && s.arm ? '' : 'none');
      // current: base loop (GPIO2 → R3 → B–E → «−» rails → MB102 → top «−» → GND–GND → ESP GND), collector (5 В → R4 → C–E)
      const flow = (w, on) => { if (w && w.flow) w.flow.style.display = on ? '' : 'none'; };
      const ib = e.ib > 0;
      flow(R.w.g2, ib); flow(R.w.e, ib); flow(R.w.gg, ib); flow(R.w.r4, ib);
      if (R.w.com) { flow(R.w.com, !!s.arm); flow(R.w.no, !!s.arm); flow(R.w.lk, !!s.arm); }
      // events
      const target = s.arm ? 1 : 0;
      if (target !== (blade > 0.5 ? 1 : 0) && clack <= 0 && Math.abs(blade - target) > 0.5) clack = 1;
      blade = dt ? blade + clamp(target - blade, -dt * 14, dt * 14) : target;
      if (clack > 0) clack = Math.max(0, clack - (dt || 1) * 2.2);
      if (spark > 0) spark = Math.max(0, spark - (dt || 1) * 1.5);
      const T = R.tags;
      if (!T) return;
      if (T.clock) T.clock.set(s.clock || clock(s.t));
      if (T.clock) T.clock.classList.toggle('night', s.t > 0.5);
      T.ldr.set(`LDR ${fm.si(s.rl, 'Ом', 2)}`);
      T.adc.set(`${f.adc2 ? 'GPIO14' : 'GPIO4'} ${fm.num(s.vAdc, 2, true)} В → АЦП ${s.raw == null ? '—' : s.raw}`);
      T.gpio.set(`GPIO2 ${s.on ? 'HIGH 3,3 В' : 'LOW 0 В'}`);
      T.gpio.classList.toggle('hi', !!s.on);
      T.ib.set(`I_B ${fm.num(e.ib || 0, 2, true)} мА · V_BE ${fm.num(e.vbe || 0, 1, true)} В`);
      T.vin.set(`IN ${fm.num(e.vin, 1, true)} В`);
      T.vin.classList.toggle('lo', e.vin < 1);
      T.coil.set(e.coil ? `котушка ≈${K.I_COIL} мА` : 'котушка 0 мА');
      if (T.lamp) T.lamp.set(s.arm ? `лампа ≈${K.I_LAMP} мА` : 'лампа 0 мА');
      T.clack.set(clack > 0 ? 'клац!' : ''); T.clack.style.opacity = clack.toFixed(2);
      T.spark.set(spark > 0 ? '⚡ викид' : ''); T.spark.style.opacity = spark.toFixed(2);
      T.hint.set(f.lamp && s.arm && !s.hideMarks ? '↺ лампа світить на LDR' : '');
    }
    place();
    if ('ResizeObserver' in window) new ResizeObserver(() => { place(); if (!key && R.bb && render.last) render(render.last, 0); }).observe(svg);
    const api = {
      render(s, dt) { render.last = s; render(s, dt); },
      build(f = {}) { place(); key = mode + fkey(f); build(f); return R; },
      get refs() { return R; },
      kick() { clack = 1; }, sparkle() { spark = 1; },
    };
    return api;
  }
  const $$sel = (root, s) => Array.from(root.querySelectorAll(s));

  /* ---------------------------------------------------------------- ADC-vs-time plot (canvas)
     hist: [{ t (s), raw, on, click }], now (s), cfg as in render. Window = span seconds. */
  function plot(cv, hist, now, cfg, { span = 30, ymax = 1600, bad = null } = {}) {
    const ctx = Study.fitCanvas(cv), tk = Study.tokens();
    const W = ctx.w, H = ctx.h, L = 52, Rm = 12, T = 26, B = 54;
    const pw = W - L - Rm, ph = H - T - B;
    const y = (v) => T + ph * (1 - clamp(v, 0, ymax) / ymax);
    const x = (tt) => L + pw * (1 - (now - tt) / span);
    ctx.clearRect(0, 0, W, H);
    const mono = tk['f-mono'] || 'monospace';
    ctx.font = `13px ${mono}`; ctx.textBaseline = 'middle';
    ctx.strokeStyle = tk.line; ctx.lineWidth = 1; ctx.fillStyle = tk.muted; ctx.textAlign = 'right';
    for (let v = 0; v <= ymax; v += 400) { ctx.beginPath(); ctx.moveTo(L, y(v)); ctx.lineTo(W - Rm, y(v)); ctx.stroke(); ctx.fillText(String(v), L - 6, y(v)); }
    const d = cfg.hyst ? cfg.dark : cfg.center, l = cfg.hyst ? cfg.light : cfg.center;
    if (cfg.hyst) { ctx.globalAlpha = 0.16; ctx.fillStyle = tk.accent; ctx.fillRect(L, y(l), pw, y(d) - y(l)); ctx.globalAlpha = 1; }
    ctx.setLineDash([6, 5]); ctx.strokeStyle = tk.accent; ctx.lineWidth = 2;
    [d, l].forEach((v) => { ctx.beginPath(); ctx.moveTo(L, y(v)); ctx.lineTo(W - Rm, y(v)); ctx.stroke(); });
    ctx.setLineDash([]);
    ctx.fillStyle = tk.accent; ctx.textAlign = 'right';
    if (cfg.hyst) { ctx.fillText(`LIGHT ${l}`, W - Rm - 4, y(l) - 10); ctx.fillText(`DARK ${d}`, W - Rm - 4, y(d) + 11); }
    else ctx.fillText(`ПОРІГ ${d}`, W - Rm - 4, y(d) - 10);
    const vis = hist.filter((h) => h.t >= now - span);
    const by = H - B + 16, bh = 14;
    if (vis.length) {
      ctx.save(); ctx.beginPath(); ctx.rect(L, T - 2, pw, ph + 4); ctx.clip();
      ctx.strokeStyle = tk.ink; ctx.lineWidth = 2; ctx.beginPath();
      vis.forEach((h, i) => { const xx = x(h.t), yy = y(h.raw > 4095 ? ymax : h.raw); if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); });
      ctx.stroke();
      // on/off points on the trace
      vis.forEach((h) => {
        if (!h.click) return;
        ctx.beginPath(); ctx.arc(x(h.t), y(h.raw > 4095 ? ymax : h.raw), 5, 0, 7);
        if (h.on) { ctx.fillStyle = tk.ok; ctx.fill(); } else { ctx.fillStyle = tk.sheet || tk.panel; ctx.fill(); ctx.strokeStyle = tk.bad; ctx.lineWidth = 2; ctx.stroke(); }
      });
      ctx.restore();
      vis.forEach((h, i) => {
        const x0 = x(h.t), x1 = i < vis.length - 1 ? x(vis[i + 1].t) : x(now);
        ctx.fillStyle = h.on ? tk.ok : tk['panel-2'];
        ctx.fillRect(x0, by, Math.max(1, x1 - x0 + 0.5), bh);
        if (h.click) { ctx.fillStyle = tk.bad; ctx.fillRect(x0 - 1, by - 9, 2.5, 7); }
      });
    }
    ctx.strokeStyle = tk.line; ctx.strokeRect(L, by, pw, bh);
    ctx.fillStyle = tk.muted; ctx.textAlign = 'right';
    ctx.fillText('реле', L - 6, by + bh / 2);
    ctx.textAlign = 'left'; ctx.fillText(`−${span} с`, L, H - 10);
    ctx.textAlign = 'right'; ctx.fillText('зараз', W - Rm, H - 10);
    ctx.textAlign = 'left'; ctx.fillStyle = tk.muted; ctx.fillText('АЦП, відліки', L, 10);
    if (bad) { ctx.fillStyle = tk.bad; ctx.textAlign = 'center'; ctx.font = `600 14px ${mono}`; ctx.fillText(bad, L + pw / 2, T + 14); }
  }

  /* Two views of one bench («Макетка» = Kit parts, «Схема» = the 4 IEC panels) behind a segmented switch.
     group: .seg with buttons [data-v="kit"|"sch"]; render/sparkle/kick go to both (only the shown one draws). */
  function views(kitSvg, schSvg, group, opts = {}) {
    const a = real(kitSvg, opts), b = bench(schSvg, opts);
    let cur = 'kit', last = null;
    const show = (v) => {
      cur = v;
      kitSvg.toggleAttribute('hidden', v !== 'kit'); schSvg.toggleAttribute('hidden', v !== 'sch');
      if (group) group.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === v)));
      if (v === 'sch') b.place();
      if (last) (v === 'kit' ? a : b).render(last, 0);
    };
    if (group) group.querySelectorAll('button').forEach((x) => x.addEventListener('click', () => show(x.dataset.v)));
    show(cur);
    return {
      render(s, dt) { last = s; (cur === 'kit' && a ? a : b).render(s, dt); },
      sparkle() { if (a) a.sparkle(); b.sparkle(); }, kick() { if (a) a.kick(); b.kick(); },
      show, kit: a, sch: b,
    };
  }

  window.TwKit = { K, clamp, lerp, rOfLux, luxOfR, ldrAt, clock, adcOf, solve, decide, bench, real, views, plot, click, skyColor, el };
})();
