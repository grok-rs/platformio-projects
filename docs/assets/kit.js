/* kit.js — window.Kit: realistic, animatable SVG drawings of the parts in OUR kit (YD-ESP32-S3, WB-102, UNI-T UT136C+ …).
   Classic script, no dependencies, load with `defer`. Pure SVG generation, no images.

   SCALE. 1 SVG unit = 0.1 mm. Kit.P = 25.4 = the 2.54 mm breadboard pitch, Kit.MM = 10 units per mm.
   Every part is drawn at its real size, so parts placed on Kit.part('breadboard').hole(…) line up with the real holes.
   Silkscreen a student must read (ESP32 pin names) is >= 10 units (1 mm, like the real print): at a board 480 px wide
   that is ~18 px. Pick an SVG viewBox in the same units, e.g. viewBox="0 0 1700 700" for a full breadboard.

   API
     Kit.part(name, opts) → SVGGElement (real DOM; inner pieces animate). opts (all optional):
        x, y, rot (deg, about the part origin), scale, mirror (flip left↔right: e.g. an LED with K left of A), parent, title,
        shadow (false = no drop shadow), plus the part's own options listed below.
       g.pins      {name: {x, y}} anchor points in PARENT coordinates (updated by place()).
       g.pin(name) one anchor; g.local = the same in part coordinates.
       g.set(state) merge live state and redraw (returns g); g.state = current state.
       g.place(x, y, rot, scale) move the part; g.toParent(x, y) maps part coords → parent coords.
     Kit.route(parent, [p1, p2, …], colour, opts) → tidy orthogonal jumper along the hole grid (preferred on breadboards).
     Kit.wire(parent, from, to, colour, opts) → a flat thin arched wire with ring ends (the course's breadboard-drawing style);
                     opts.style 'dupont' = photo-like jumper with black housings; opts.width, lift, ends ('ring'|'none'|'banana').
        from/to: {x, y}; colour: name ('red','black','yellow','green','blue','orange','white','purple','grey','brown') or #hex;
        opts: lift (arch height, default ≈ 25 % of length, negative = arch the other way), width (default 14),
        ends ('male' default | 'none' | 'banana' | [startEnd, endEnd]). Returns g with .path (for Schem.flow-like effects).
     Kit.svg(host, viewBox, label) → a responsive <svg> appended to host.   Kit.fit(svg, pad) → viewBox = content bbox.
     Kit.bands(ohms, 4|5) → ['red','red','brown','gold'] colour code.   Kit.COLORS = band colour hex values.
     Kit.names = all part names.

   PARTS · origin · pins · states  (origin = the first pin, unless said otherwise)
     'esp32s3'        YD-ESP32-S3 «AI-S3» N16R8, upright: module at the top, USB-C at the bottom. Origin = header P1 pin 1 (3V3).
                      Headers are 9 pitches apart (drawn on a 10-pitch layout squeezed to 0.9): on a breadboard (rot −90) the pins
                      sit in rows b and i, rows a and j stay free.
                      Left header x = 0, right header x = 10·P, pin i at y = (i−1)·P. Placed with rot −90 the module points
                      left, both headers run along breadboard columns 10 rows apart (rows j and b) and pin labels read upright.
                      pins: L1…L22, R1…R22 and by name: 3V3, 3V3_2, RST, GPIO0…GPIO48 (GPIO43 = TX, GPIO44 = RX), 5V,
                      GND (left, by 5V), GND2 (R1), GND3 (R21), GND4 (R22), TX, RX, USB_COM, USB_OTG (connector mouths).
                      opts: labels (true), usbLabels (true: small «COM»/«USB» print).
                      state: power (true) red power LED · rgb ('#00ff00' | null) WS2812 on GPIO48 · rst, boot (pressed) ·
                             tx, rx (LEDs) · highlight ('GPIO15' | ['GPIO15','GND']).
     'breadboard'     WB-102: size 'full' (830, 63 columns) | 'half' (400, 30). Origin = top-left corner, horizontal,
                      row a at the top. g.hole(col, row) or g.hole(row, col) → {x,y} parent coords; g.rail(side, sign, col)
                      → nearest rail hole (side 'top'|'bottom', sign '+'|'-'); top rails: + outer (red), − inner (blue);
                      bottom rails: + inner, − outer. state: marks [{col, row, color}] rings around holes.
     'led'            5 mm LED, side view standing in the board. pins A (0,0), K (P,0) (span = opts.span pitches).
                      opts: color red|green|yellow|blue|white, leg (visible leg length, 50). state: on 0…1 (glow), burnt.
     'resistor'       axial, top view. pins 1 (0,0), 2 (span·P, 0); opts: ohms (220), bands 4|5, span (4), body ('beige'|'blue').
                      state: heat 0…1.
     'ldr'            GL55xx photoresistor face-on. pins 1, 2 (P apart). opts: leg. state: light 0…1 (rays + face).
     'button'         6×6 tactile, top view, straddling the trench. pins 1a (0,0), 1b (0,3P) — always joined —
                      2a (2P,0), 2b (2P,3P); pressing joins 1↔2. opts: cap colour. state: pressed.
     'npn'            TO-92, flat face to you, legs down. Legs 0, P, 2P. opts: model 'BC547B' (C-B-E) | '2N2222' (E-B-C) |
                      'BC557B' (PNP, C-B-E), legLabels (true). pins E, B, C (+ 1, 2, 3 left→right). 'pnp' = 'npn' with BC557B.
     'diode'          1N4007 (opts.model '1N4001'), top view. pins A (0,0), K (span·P, 0). Grey band = cathode.
     'cap-ceramic'    disc, opts: code '104'|'103', color 'blue'|'yellow'. pins 1, 2.
     'cap-electrolytic' 100 µF 25 V can, side view. pins + (0,0) longer leg, − (P,0) under the stripe. opts: uf, volts.
     'pot'            16 mm rotary pot, top view. pins 1, 2 (wiper), 3 at 0, 2P, 4P. opts: value 'B10K'|'B20K'.
                      state: pos 0…1 (shaft angle −150°…+150°).
     'relay-module'   1-channel 5 V relay module, top view. pins VCC (0,0), GND (0,P), IN (0,2P), NC, COM, NO (screw
                      terminal wire entries). opts: print 'tongling' (JQC-3FF-S-Z 5VDC, default: the kit photos) | 'songle' (SRD-05VDC-SL-C),
                      xray (false: draws the contact on the cube). state: on (coil → green LED, click), power (red LED).
     'tt-motor'       yellow TT gear motor, side view. Origin = shaft centre. pins + , − (motor tabs), shaft.
                      opts: wheel (false). state: angle (deg) or rpm + g.tick(dt) to advance.
     'multimeter'     UNI-T UT136C+ front. Origin = top-left of the holster (88 × 185 mm). pins COM, V (VΩmA jack), A (10 A).
                      state: dial 'OFF'|'V~'|'V'|'mV'|'Ω'|'CAP'|'Hz'|'hFE'|'TEMP'|'µA'|'mA'|'A', display ('1.92', 'OL', ''),
                      unit ('V','mV','mA','µA','A','Ω','kΩ','MΩ','nF','µF','Hz','°C'), ac, hold, fuse ('ok'|'blown').
                      opts: fuseView (show the mA-input fuse F1 0.5 A through an x-ray window; the jack print stays «400mA Max»).
     'logic-analyzer' 24 MHz 8-ch analyzer, top view, origin top-left. pins CH1…CH8, CLK, GND (2×5 header, right end),
                      USB. state: pwr, hl ('CH1' | [...]).
     'power-module'   MB102 breadboard power module, top view; origin = top-rail + pin. pins T+ (0,0), T- (0,P),
                      B+ (0,17P), B- (0,18P): drops straight into a 'breadboard' at rail(...,'+',c). state: on, top, bottom
                      ('5V'|'3.3V'|'OFF' jumper position).
     'probe'          multimeter test lead, tip at origin pointing up. opts: color 'red'|'black'. pins tip, end.
   Hardware colours never follow the site theme (a purple PCB stays purple); only labels drawn OUTSIDE a part use
   var(--ink) so they read on both page backgrounds. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const P = 25.4, MM = 10;
  const SANS = 'Arial, "Helvetica Neue", Helvetica, sans-serif';
  const INK = 'var(--ink, #231d16)';

  /* ------------------------------------------------------------------ helpers */
  function el(tag, a, parent) {
    const e = document.createElementNS(NS, tag);
    if (a) for (const k in a) if (a[k] != null && a[k] !== false) e.setAttribute(k, a[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const g_ = (parent, a) => el('g', a, parent);
  const rect = (p, x, y, w, h, fill, a = {}) => el('rect', Object.assign({ x, y, width: w, height: h, fill }, a), p);
  const circ = (p, cx, cy, r, fill, a = {}) => el('circle', Object.assign({ cx, cy, r, fill }, a), p);
  const path = (p, d, fill, a = {}) => el('path', Object.assign({ d, fill }, a), p);
  function text(p, x, y, s, o = {}) {
    const t = el('text', {
      x, y, fill: o.fill || '#fff', 'font-size': o.size || 10, 'font-family': o.family || SANS,
      'font-weight': o.weight || 700, 'text-anchor': o.anchor || 'middle', 'dominant-baseline': o.base || 'central',
      'letter-spacing': o.ls, 'font-style': o.italic ? 'italic' : null, textLength: o.len, lengthAdjust: o.len ? 'spacingAndGlyphs' : null,
      transform: o.rot ? `rotate(${o.rot} ${x} ${y})` : null, opacity: o.opacity, class: o.cls,
    }, p);
    t.textContent = s;
    return t;
  }
  const f1 = (n) => Math.round(n * 10) / 10;
  function shade(hex, k) { // k < 0 darker, k > 0 lighter
    const n = parseInt(hex.slice(1), 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k));
    return '#' + c.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
  }
  // a straight lead (tinned wire) with a soft highlight
  function lead(p, pts, w = 5, col = '#a7abb1') {
    const d = 'M' + pts.map((q) => f1(q[0]) + ' ' + f1(q[1])).join('L');
    path(p, d, 'none', { stroke: shade(col, -0.35), 'stroke-width': w + 1.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    path(p, d, 'none', { stroke: col, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    path(p, d, 'none', { stroke: '#eef0f3', 'stroke-width': w * 0.3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.8 });
  }

  /* ------------------------------------------------------------------ shared defs (one hidden <svg> in <body>) */
  let defs = null;
  const made = new Set();
  function ensureDefs() {
    if (defs && defs.isConnected) return defs;
    const host = el('svg', { 'aria-hidden': 'true', width: 0, height: 0, focusable: 'false', style: 'position:absolute;width:0;height:0;overflow:hidden' });
    defs = el('defs', null, host);
    (document.body || document.documentElement).appendChild(host);
    made.clear();
    // drop shadows (in parent coords: the filter sits on an untransformed group)
    for (const [id, dy, sd, op] of [['kit-shadow', 9, 9, 0.38], ['kit-shadow-lo', 6, 10, 0.22]]) {
      // user-space region: a percentage box clips the blur of thin parts (a resistor is 2.6 mm tall) into a visible rectangle
      // bounded region: a huge one makes Chrome paint a black tile in sideways-scrolling drawings on phones
      const f = el('filter', { id, filterUnits: 'userSpaceOnUse', x: -4000, y: -4000, width: 14000, height: 12000, 'color-interpolation-filters': 'sRGB' }, defs);
      el('feDropShadow', { dx: 0, dy, stdDeviation: sd, 'flood-color': '#000', 'flood-opacity': op }, f);
    }
    const blur = el('filter', { id: 'kit-blur', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    el('feGaussianBlur', { stdDeviation: 4 }, blur);
    lin('kit-metal-h', [[0, '#7d8288'], [0.25, '#e9ecef'], [0.5, '#b8bdc3'], [0.8, '#f4f5f7'], [1, '#8a8f95']], 0, 0, 1, 0);
    lin('kit-metal-v', [[0, '#8a8f95'], [0.3, '#eef0f2'], [0.55, '#b5bac0'], [0.85, '#e7e9ec'], [1, '#7c8187']], 0, 0, 0, 1);
    lin('kit-can', [[0, '#f6f1e8'], [0.6, '#e6dfd2'], [1, '#d3cbbd']], 0, 0, 1, 1);
    lin('kit-gold', [[0, '#f3d98b'], [0.5, '#c99b2e'], [1, '#e8c66a']], 0, 0, 1, 1);
    lin('kit-pcb-purple', [[0, '#7a2a80'], [1, '#5d1b63']], 0, 0, 1, 1);
    lin('kit-bb', [[0, '#f7f5ee'], [1, '#e9e6dc']], 0, 0, 0, 1);
    lin('kit-red', [[0, '#c4141f'], [0.18, '#f0373d'], [0.5, '#e3232c'], [1, '#a90f19']], 0, 0, 1, 0);
    lin('kit-yellow', [[0, '#fff27a'], [0.5, '#fbdf2a'], [1, '#d7b511']], 0, 0, 0, 1);
    lin('kit-cyl-black', [[0, '#0d0e10'], [0.3, '#3a3d42'], [0.55, '#202226'], [1, '#08090a']], 0, 0, 1, 0);
    lin('kit-cyl-blue', [[0, '#123c6e'], [0.3, '#3c86d6'], [0.6, '#1f5fae'], [1, '#0e2f57']], 0, 0, 1, 0);
    lin('kit-relay', [[0, '#2f7bd4'], [1, '#1a59ad']], 0, 0, 1, 1);
    lin('kit-lcd', [[0, '#c4eeec'], [1, '#9fd6d6']], 0, 0, 0, 1);
    rad('kit-knurl', [[0, '#f1f2f3'], [0.7, '#c8cbcf'], [1, '#8d9196']]);
    rad('kit-solder', [[0, '#ffffff'], [0.45, '#d6d9dd'], [1, '#868b92']], 0.35, 0.35);
    return defs;
  }
  function lin(id, stops, x1, y1, x2, y2) {
    if (made.has(id)) return 'url(#' + id + ')';
    made.add(id);
    const gr = el('linearGradient', { id, x1, y1, x2, y2 }, defs);
    stops.forEach(([o, c, op]) => el('stop', { offset: o, 'stop-color': c, 'stop-opacity': op }, gr));
    return 'url(#' + id + ')';
  }
  function rad(id, stops, fx, fy) {
    if (made.has(id)) return 'url(#' + id + ')';
    made.add(id);
    const gr = el('radialGradient', { id, fx, fy }, defs);
    stops.forEach(([o, c, op]) => el('stop', { offset: o, 'stop-color': c, 'stop-opacity': op }, gr));
    return 'url(#' + id + ')';
  }
  // a soft coloured glow (centre colour → transparent)
  const glowFill = (hex) => rad('kit-glow-' + hex.slice(1), [[0, hex, 0.95], [0.25, hex, 0.55], [0.6, hex, 0.18], [1, hex, 0]]);

  /* ------------------------------------------------------------------ part factory */
  const PARTS = {};
  function part(name, o = {}) {
    ensureDefs();
    const make = PARTS[name];
    if (!make) throw new Error('Kit.part: unknown part ' + name);
    const g = el('g', { class: 'kit-part kit-' + name, 'data-kit': name });
    if (o.title) el('title', null, g).textContent = o.title;
    const sh = g_(g, { class: 'kit-sh', filter: o.shadow === false ? null : `url(#${name === 'breadboard' ? 'kit-shadow-lo' : 'kit-shadow'})` });
    const body = g_(sh, { class: 'kit-xf' });
    const fx = g_(g, { class: 'kit-fx', 'pointer-events': 'none' });
    const api = make(body, o, fx) || {};
    g.local = api.pins || {};
    g.state = Object.assign({}, api.init || {});
    g.set = (s = {}) => { Object.assign(g.state, s); if (api.set) api.set(g.state, s); return g; };
    // opts.mirror: draw the part flipped left↔right about its origin (an LED put in the other way round: K left of A)
    const M = o.mirror ? -1 : 1;
    let T = { x: 0, y: 0, r: 0, s: 1 };
    g.toParent = (x, y) => {
      x *= M;
      const a = T.r * Math.PI / 180, c = Math.cos(a), si = Math.sin(a);
      return { x: f1(T.x + T.s * (x * c - y * si)), y: f1(T.y + T.s * (x * si + y * c)) };
    };
    g.place = (x = 0, y = 0, r = 0, s = 1) => {
      T = { x, y, r, s };
      const tf = `translate(${x} ${y})` + (r ? ` rotate(${r})` : '') + (s !== 1 || M < 0 ? ` scale(${s * M} ${s})` : '');
      body.setAttribute('transform', tf); fx.setAttribute('transform', tf);
      g.pins = {};
      for (const k in g.local) g.pins[k] = g.toParent(g.local[k].x, g.local[k].y);
      return g;
    };
    g.pin = (n) => g.pins[n];
    if (api.methods) Object.assign(g, api.methods(g));
    g.place(o.x || 0, o.y || 0, o.rot || 0, o.scale || 1);
    g.set();
    if (o.parent) o.parent.appendChild(g);
    return g;
  }
  const pt = (x, y) => ({ x, y });

  /* ================================================================== ESP32-S3 (YD-ESP32-S3 / «AI-S3» N16R8) */
  const ESP_L = ['3V3', '3V3', 'RST', '4', '5', '6', '7', '15', '16', '17', '18', '8', '3', '46', '9', '10', '11', '12', '13', '14', '5Vin', 'GND'];
  const ESP_R = ['GND', 'TX', 'RX', '1', '2', '42', '41', '40', '39', '38', '37', '36', '35', '0', '45', '48', '47', '21', '20', '19', 'GND', 'GND'];
  PARTS.esp32s3 = (g, o, fx) => {
    // The headers are 9 pitches apart on the real board (owner's bench: pins in rows b and i, rows a and j stay free).
    // The drawing below is laid out on a 10-pitch grid and squeezed to 0.9 across, so both headers land in real holes.
    const SX = 0.9;
    g = g_(g, { transform: `scale(${SX} 1)` });
    fx = g_(fx, { transform: `scale(${SX} 1)` });
    const W0 = -10, W1 = 264, T0 = -17, B1 = 549;
    const pins = {};
    // PCB
    rect(g, W0, T0, W1 - W0, B1 - T0, lin('kit-pcb-purple'), { rx: 7, stroke: '#4a1250', 'stroke-width': 1.5 });
    rect(g, W0 + 3, T0 + 3, W1 - W0 - 6, B1 - T0 - 6, 'none', { rx: 5, stroke: '#8b3a92', 'stroke-width': 1, opacity: 0.6 });
    // decorative copper traces under the mask
    const tr = g_(g, { fill: 'none', stroke: '#7f3088', 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.85 });
    ['M8 279H30L44 293V330', 'M8 305H24L40 321V360H58', 'M8 330H20L34 344V392', 'M8 381H18L28 391V440', 'M8 432H40L52 420',
      'M8 457H30', 'M246 228H226L210 244V300', 'M246 254H230L220 264V292', 'M246 279H232L222 289V330H190', 'M246 330H236L226 340V398',
      'M246 381H228L220 389V400', 'M246 406H230', 'M246 432H226L214 444V470', 'M58 196V214H120L134 228V300', 'M150 196V212L172 234V330',
      'M100 196V206', 'M114 440H160L176 456V470', 'M88 470V448L98 438', 'M140 300H180', 'M70 300V340']
      .forEach((d) => path(tr, d, 'none'));
    // vias
    [[73, 213], [228, 470], [154, 381], [110, 344], [170, 456], [60, 470], [128, 274]].forEach(([x, y]) => {
      circ(g, x, y, 4.5, '#8c3a94'); circ(g, x, y, 2, '#3a0f40');
    });
    // header pads (+ the soldered pin tip)
    const padG = g_(g);
    for (let i = 0; i < 22; i++) {
      for (const side of [0, 1]) {
        const x = side ? 10 * P : 0, y = i * P;
        if (i === 0) rect(padG, x - 9, y - 9, 18, 18, '#d7d6d2', { rx: 1.5, stroke: '#9c98a0', 'stroke-width': 1 });
        else circ(padG, x, y, 9, '#d7d6d2', { stroke: '#9c98a0', 'stroke-width': 1 });
        circ(padG, x, y, 6.2, 'url(#kit-solder)');
        rect(padG, x - 3, y - 3, 6, 6, '#c9ccd0', { rx: 1, opacity: 0.9 });
      }
    }
    // pin labels (rotated like the real silkscreen; upright when the board lies with rot = −90)
    if (o.labels !== false) {
      const lg = g_(g);
      // pin names read upright on the bench either way round: rot −90 (module left) or rot 90 (module right, README layout)
      const tr = ((o.rot || 0) % 360 + 360) % 360 === 90 ? -90 : 90;
      ESP_L.forEach((s, i) => text(lg, 18, i * P, s, { size: 12, rot: tr, len: s.length > 2 ? Math.min(23, s.length * 6.6) : null }));
      ESP_R.forEach((s, i) => text(lg, 10 * P - 18, i * P, s, { size: 12, rot: tr, len: s.length > 2 ? Math.min(23, s.length * 6.6) : null }));
    }
    // names
    ESP_L.forEach((s, i) => {
      const p = pt(0, i * P); pins['L' + (i + 1)] = p;
      const n = s === '3V3' ? (i ? '3V3_2' : '3V3') : s === 'RST' ? 'RST' : s === '5Vin' ? '5V' : s === 'GND' ? 'GND' : 'GPIO' + s;
      pins[n] = p;
    });
    ESP_R.forEach((s, i) => {
      const p = pt(10 * P, i * P); pins['R' + (i + 1)] = p;
      if (s === 'GND') pins[i === 0 ? 'GND2' : i === 20 ? 'GND3' : 'GND4'] = p;
      else if (s === 'TX') { pins.TX = p; pins.GPIO43 = p; } else if (s === 'RX') { pins.RX = p; pins.GPIO44 = p; } else pins['GPIO' + s] = p;
    });

    // ESP32-S3-WROOM-1 module
    const m = g_(g);
    rect(m, 36, -83, 181, 265, '#262a31', { rx: 3 });
    rect(m, 36, -83, 181, 70, '#30353d', { rx: 3 });
    path(m, 'M60 -40V-70H84V-40H108V-70H132V-40H156V-70H180V-40H196V-62', 'none', { stroke: '#353a42', 'stroke-width': 5 });
    circ(m, 168, -72, 2.6, '#c8b46a'); circ(m, 190, -72, 2.6, '#c8b46a');
    for (let k = 0; k < 14; k++) {
      const y = -6 + k * 12.7;
      rect(m, 36, y - 3.5, 8, 7, lin('kit-gold')); rect(m, 209, y - 3.5, 8, 7, lin('kit-gold'));
    }
    for (let k = 0; k < 13; k++) rect(m, 50.5 + k * 12.7 - 3.5, 172, 7, 10, lin('kit-gold'));
    rect(m, 45, -15, 163, 180, lin('kit-can'), { rx: 3, stroke: '#b9b1a3', 'stroke-width': 1.2 });
    // Espressif logo + print
    const lg = g_(m, { fill: 'none', stroke: '#8a847a', 'stroke-width': 2.2, 'stroke-linecap': 'round' });
    circ(lg, 74, 5, 11);
    path(lg, 'M66 -1C74 -1 80 5 80 13M65 4C71 4 75 8 75 14M68 -5C79 -4 85 3 86 11');
    text(m, 135, 5, 'ESPRESSIF', { fill: '#8a847a', size: 15, ls: 0.6, len: 96 });
    text(m, 127, 30, 'ESP32-S3-WROOM-1', { fill: '#8a847a', size: 11.5, weight: 400, len: 140 });
    text(m, 62, 50, 'CE', { fill: '#8a847a', size: 13, weight: 400 });
    [62, 74, 86, 98].forEach((y, k) => rect(m, 55, y, [96, 88, 102, 80][k], 4, '#bdb6aa', { rx: 1 }));
    circ(m, 64, 145, 3, '#2a2a2a');
    text(m, 105, 145, 'N16R8', { fill: '#a39d92', size: 9, weight: 400 });

    // passives, buttons, chips
    const smd = (x, y, w, h, s) => { // black SMD part with silver ends, white outline
      rect(g, x - w / 2 - 4, y - h / 2 - 4, w + 8, h + 8, 'none', { stroke: '#e9dff0', 'stroke-width': 1.4, rx: 2 });
      rect(g, x - w / 2, y - h / 2, w, h, '#1e1e20', { rx: 2 });
      rect(g, x - w / 2, y - h / 2, w, 7, '#bfc3c8'); rect(g, x - w / 2, y + h / 2 - 7, w, 7, '#bfc3c8');
      if (s) text(g, x, y, s, { size: 6.5, fill: '#d8d8d8', rot: 90, weight: 400 });
    };
    smd(59, 244, 23, 44, 'A226'); smd(95, 244, 23, 44, 'C106');
    const btns = {};
    for (const [k, x, lbl] of [['rst', 155, 'RST'], ['boot', 204, 'BOOT']]) {
      text(g, x, 207, lbl, { size: 11.5 });
      [[-21, -16], [17, -16], [-21, 10], [17, 10]].forEach(([dx, dy]) => rect(g, x + dx, 246 + dy, 4, 6, '#c9cdd2'));
      rect(g, x - 17, 223, 34, 46, lin('kit-metal-v'), { rx: 3, stroke: '#7b8086', 'stroke-width': 1 });
      circ(g, x, 246, 12.5, '#3c3f44');
      btns[k] = circ(g, x, 246, 10.5, '#1d1f22', { style: 'transition: r .08s, fill .08s' });
    }
    const sot = (x, y, w, h, legs) => {
      const lw = 4;
      for (let k = 0; k < legs[0]; k++) rect(g, x - w / 2 + (w / (legs[0] + 1)) * (k + 1) - lw / 2, y - h / 2 - 5, lw, 6, '#c3c6ca');
      for (let k = 0; k < legs[1]; k++) rect(g, x - w / 2 + (w / (legs[1] + 1)) * (k + 1) - lw / 2, y + h / 2 - 1, lw, 6, '#c3c6ca');
      rect(g, x - w / 2, y - h / 2, w, h, '#1f2023', { rx: 1.5 });
    };
    sot(78, 312, 28, 17, [2, 3]); sot(159, 314, 26, 15, [1, 2]); sot(203, 314, 26, 15, [1, 2]);
    sot(53, 425, 15, 26, [1, 1]); sot(76, 425, 15, 26, [1, 1]); sot(99, 425, 15, 26, [1, 1]);
    [[140, 284], [176, 284], [118, 330], [128, 440], [146, 440], [176, 404], [230, 395]].forEach(([x, y]) => {
      rect(g, x - 5, y - 3, 10, 6, '#9a6a3c'); rect(g, x - 5, y - 3, 2.5, 6, '#c8cbcf'); rect(g, x + 2.5, y - 3, 2.5, 6, '#c8cbcf');
    });
    // QFN (CH343 USB-UART)
    rect(g, 184, 398, 30, 30, '#1c1d20', { rx: 1.5 });
    for (let k = 0; k < 5; k++) { rect(g, 188 + k * 5.5, 395, 2.5, 3, '#c3c6ca'); rect(g, 188 + k * 5.5, 428, 2.5, 3, '#c3c6ca'); }
    circ(g, 189, 403, 1.6, '#4a4b50');
    // small LEDs: power (red), TX, RX
    const smallLed = {};
    for (const [k, x, y, col] of [['pwr', 158, 352, '#ff2a1a'], ['tx', 186, 352, '#ffb21a'], ['rx', 210, 354, '#3aa0ff']]) {
      rect(g, x - 9, y - 16, 18, 32, 'none', { stroke: '#efe6f2', 'stroke-width': 1.4, rx: 2 });
      rect(g, x - 5, y - 11, 10, 22, '#ece9e2', { rx: 1 });
      smallLed[k] = { core: rect(g, x - 3.5, y - 6, 7, 12, '#d6cfc4', { rx: 1 }), col, x, y };
    }
    // WS2812 RGB LED (5050)
    [[-26, -16], [21, -16], [-26, 10], [21, 10]].forEach(([dx, dy]) => rect(g, 74 + dx, 369 + dy, 5, 7, '#c9cdd2'));
    rect(g, 49, 344, 50, 50, '#f2efe9', { rx: 3, stroke: '#cfc9bf', 'stroke-width': 1 });
    circ(g, 74, 369, 18, '#e8e3dc', { stroke: '#d6d0c6', 'stroke-width': 1.5 });
    const rgbCore = circ(g, 74, 369, 14, '#efebe5');
    circ(g, 78, 372, 2.2, '#3a3330');
    text(g, 125, 346, 'RGB', { size: 11.5 });
    text(g, 33, 396, 'IN-OUT', { size: 8.5, rot: 90 });
    path(g, 'M40 440a5 5 0 0 1 10 0zM40 446a5 5 0 0 0 10 0z', lin('kit-gold'));
    // USB-C ×2 (left = COM / CH343, right = native USB)
    for (const [cx, lbl] of [[63, 'COM'], [187, 'USB']]) {
      for (let k = 0; k < 12; k++) rect(g, cx - 29 + k * 5.2, 462, 2.6, 10, lin('kit-gold'));
      rect(g, cx - 40, 471, 80, 87, lin('kit-metal-h'), { rx: 9, stroke: '#6f747a', 'stroke-width': 1.2 });
      rect(g, cx - 36, 474, 72, 6, '#d9dcdf', { rx: 2, opacity: 0.8 });
      [[-20, 498], [20, 498]].forEach(([dx, y]) => el('ellipse', { cx: cx + dx, cy: y, rx: 7, ry: 4, fill: '#9aa0a6' }, g));
      rect(g, cx - 31, 552, 62, 6, '#5d6268', { rx: 3 });
      if (o.usbLabels !== false) text(g, cx, 452, lbl, { size: 9, weight: 700 });
    }
    pins.USB_COM = pt(63, 558); pins.USB_OTG = pt(187, 558);

    // fx layer: glows + pin highlight
    const glows = {};
    for (const k in smallLed) glows[k] = circ(fx, smallLed[k].x, smallLed[k].y, 26, glowFill(smallLed[k].col), { opacity: 0 });
    const rgbGlow = circ(fx, 74, 369, 70, '#fff', { opacity: 0 });
    const hlG = g_(fx);
    const outPins = {};
    for (const k in pins) outPins[k] = pt(f1(pins[k].x * SX), pins[k].y);
    return {
      pins: outPins,
      init: { power: true, rgb: null, rst: false, boot: false, tx: false, rx: false, highlight: null },
      set(s) {
        for (const k of ['rst', 'boot']) { btns[k].setAttribute('r', s[k] ? 8 : 10.5); btns[k].setAttribute('fill', s[k] ? '#0b0c0d' : '#1d1f22'); }
        for (const k of ['pwr', 'tx', 'rx']) {
          const on = k === 'pwr' ? s.power : s.power && s[k];
          smallLed[k].core.setAttribute('fill', on ? shade(smallLed[k].col, 0.45) : '#d6cfc4');
          glows[k].setAttribute('opacity', on ? 0.9 : 0);
        }
        const c = s.power && s.rgb;
        rgbCore.setAttribute('fill', c ? shade(c, 0.55) : '#efebe5');
        rgbGlow.setAttribute('fill', c ? glowFill(c) : '#fff');
        rgbGlow.setAttribute('opacity', c ? 1 : 0);
        hlG.replaceChildren();
        [].concat(s.highlight || []).forEach((n) => {
          const p = pins[n]; if (!p) return;
          circ(hlG, p.x, p.y, 24, glowFill('#ffd23f'));
          circ(hlG, p.x, p.y, 13, 'none', { stroke: '#ffd23f', 'stroke-width': 4.5 });
        });
      },
    };
  };

  /* ================================================================== breadboard WB-102 */
  PARTS.breadboard = (g, o) => {
    const half = o.size === 'half';
    const N = o.cols || (half ? 30 : 63), groups = o.cols ? Math.max(1, Math.min(10, Math.floor((N - 1) / 6))) : (half ? 5 : 10);
    const W = (N + 2) * P, H = 21 * P;
    const ROWS = 'abcdefghij';
    const rowY = (r) => { const i = ROWS.indexOf(String(r).toLowerCase()); return (i < 5 ? 5 + i : 7 + i) * P; };
    const colX = (c) => (c + 0.5) * P;
    const RAIL = { top: { '+': 1.5 * P, '-': 2.5 * P }, bottom: { '+': 18.5 * P, '-': 19.5 * P } };
    const span = groups * 6 - 1, start = Math.floor((N - span) / 2) + 1; // whole columns: rail holes line up with the strips
    const railCols = []; for (let k = 0; k < span; k++) if (k % 6 !== 5) railCols.push(start + k);
    rect(g, 0, 0, W, H, lin('kit-bb'), { rx: 14, stroke: '#cfcabb', 'stroke-width': 2 });
    // rail strips and the centre trench
    rect(g, 6, 3.6 * P, W - 12, 0.5 * P, '#e3dfd2', { rx: 4 });
    rect(g, 6, 16.9 * P, W - 12, 0.5 * P, '#e3dfd2', { rx: 4 });
    rect(g, 6, 10.05 * P, W - 12, 0.9 * P, '#dcd7c8', { rx: 5 });
    rect(g, 6, 10.05 * P, W - 12, 3, '#cbc5b4');
    // red / blue lines. The group's WB-102 has its rails SPLIT in the middle (owner's reference: «розрив шини» between
    // columns 30 and 34): each rail is two separate halves, the lines show the gap. opts.split false = one-piece rails.
    const split = o.split ?? (!half && !o.cols && groups === 10);
    const gapX = split ? (colX(start + 28) + colX(start + 30)) / 2 : null; // between rail groups 5 and 6
    const line = (y, c) => {
      if (!split) { rect(g, 0.9 * P, y - 2.2, W - 1.8 * P, 4.4, c, { rx: 2 }); return; }
      rect(g, 0.9 * P, y - 2.2, gapX - 0.6 * P - 0.9 * P, 4.4, c, { rx: 2 });
      rect(g, gapX + 0.6 * P, y - 2.2, W - 0.9 * P - (gapX + 0.6 * P), 4.4, c, { rx: 2 });
    };
    line(0.75 * P, '#d8262c'); line(3.25 * P, '#2a5fd0'); line(17.75 * P, '#d8262c'); line(20.25 * P, '#2a5fd0');
    const sign = (x, y, s, c) => text(g, x, y, s, { fill: c, size: 17, weight: 700 });
    for (const x of [0.45 * P, W - 0.45 * P]) {
      sign(x, 1.5 * P, '+', '#d8262c'); sign(x, 2.5 * P, '−', '#2a5fd0'); sign(x, 18.5 * P, '+', '#d8262c'); sign(x, 19.5 * P, '−', '#2a5fd0');
    }
    // holes: one path
    let d = '';
    const hole = (x, y) => { d += `M${f1(x - 5.5)} ${f1(y - 5.5)}h11v11h-11z`; };
    for (let c = 1; c <= N; c++) for (const r of ROWS) hole(colX(c), rowY(r));
    for (const side of ['top', 'bottom']) for (const s of ['+', '-']) railCols.forEach((c) => hole(colX(c), RAIL[side][s]));
    path(g, d, '#c9c4b5', { transform: 'translate(0 1.2)' });
    path(g, d, '#3f3d39');
    // labels
    const lbl = g_(g);
    for (let c = 1; c <= N; c++) if (c === 1 || c % 5 === 0) {
      text(lbl, colX(c), 4.25 * P, String(c), { fill: '#77736a', size: 12, weight: 400 });
      text(lbl, colX(c), 16.75 * P, String(c), { fill: '#77736a', size: 12, weight: 400 });
    }
    for (const r of ROWS) { text(lbl, 0.75 * P, rowY(r), r, { fill: '#77736a', size: 12, weight: 400 }); text(lbl, W - 0.75 * P, rowY(r), r, { fill: '#77736a', size: 12, weight: 400 }); }
    const marks = g_(g);
    return {
      pins: { a1: pt(colX(1), rowY('a')) },
      init: { marks: [] },
      set(s) {
        marks.replaceChildren();
        (s.marks || []).forEach((m) => {
          const y = m.rail ? RAIL[m.side || 'top'][m.rail] : rowY(m.row || 'a');
          circ(marks, colX(m.col), y, 11, 'none', { stroke: m.color || '#ffb000', 'stroke-width': 4 });
        });
      },
      methods: (G) => ({
        hole(a, b) { const isRow = (v) => typeof v === 'string' && /^[a-j]$/i.test(v); const [c, r] = isRow(a) ? [b, a] : [a, b]; return G.toParent(colX(c), rowY(r)); },
        // 'j18' → hole j18; 'top+12' / 'top-12' / 'bottom+12' / 'bottom-12' → the rail hole nearest column 12
        at(name) {
          const m = /^([a-j])(\d+)$/i.exec(name);
          if (m) return G.toParent(colX(+m[2]), rowY(m[1]));
          const r = /^(top|bottom)([+\-−])(\d+)$/i.exec(name);
          if (r) return this.rail(r[1].toLowerCase(), r[2], +r[3]);
          throw new Error('Kit breadboard: unknown hole ' + name);
        },
        rail(side, sgn, col = 1) {
          const c = railCols.reduce((best, k) => (Math.abs(k - col) < Math.abs(best - col) ? k : best), railCols[0]);
          return G.toParent(colX(c), RAIL[side][sgn === '-' || sgn === '−' ? '-' : '+']);
        },
        cols: N, size: { w: W, h: H },
        // split rails: which half a column's rail hole belongs to (0 = left, 1 = right); always 0 when not split
        railHalf(col) { return split && colX(col) > gapX ? 1 : 0; },
        split,
      }),
    };
  };

  /* ================================================================== LED 5 mm */
  const LED = {
    red: { body: '#d8231b', lit: '#ff6a4a', glow: '#ff3b1f', edge: '#9d1510' },
    green: { body: '#22a63c', lit: '#9bff8f', glow: '#3dff5a', edge: '#167a2a' },
    yellow: { body: '#f0bf13', lit: '#fff59a', glow: '#ffd21a', edge: '#b88c08' },
    blue: { body: '#2a63e0', lit: '#a9d0ff', glow: '#3d84ff', edge: '#1a3f9a' },
    white: { body: '#e6ecf1', lit: '#ffffff', glow: '#e6f2ff', edge: '#b4bec7' },
  };
  PARTS.led = (g, o, fx) => {
    const c = LED[o.color] || LED.red, L = o.leg ?? 50, sp = (o.span || 1) * P, cx = sp / 2;
    const y0 = -L, top = y0 - 86;
    // legs: anode (left, long, with the kink), cathode (right)
    lead(g, [[0, 0], [0, y0 + 26], [cx - 9, y0 + 14], [cx - 9, y0]]);
    lead(g, [[sp, 0], [sp, y0 + 20], [cx + 9, y0 + 10], [cx + 9, y0]]);
    // flange with the flat on the cathode side
    path(g, `M${cx - 29} ${y0}v-9q0 -3 3 -3h${48}v12z`, c.edge);
    // body
    const bodyD = `M${cx - 25} ${y0 - 10}V${top + 25}a25 25 0 0 1 50 0V${y0 - 10}z`;
    const bd = path(g, bodyD, c.body, { opacity: 0.93 });
    // leadframe inside the epoxy: anode post (small) and cathode anvil (big)
    path(g, `M${cx - 9} ${y0 - 10}V${top + 50}h6v${36}z M${cx + 9} ${y0 - 10}V${top + 44}l-12 -4v6h8v${32}z`, shade(c.body, -0.4), { opacity: 0.45 });
    const lit = path(g, bodyD, c.lit, { opacity: 0 });
    path(g, `M${cx - 18} ${top + 30}a18 18 0 0 1 12 -16`, 'none', { stroke: '#fff', 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0.55 });
    rect(g, cx - 19, top + 36, 5, 40, '#fff', { rx: 2.5, opacity: 0.35 });
    const burnt = g_(g, { opacity: 0 });
    path(burnt, bodyD, '#2b1a12', { opacity: 0.72 });
    el('ellipse', { cx: cx + 2, cy: top + 26, rx: 14, ry: 10, fill: '#0d0805' }, burnt);
    path(burnt, `M${cx - 6} ${top + 14}l6 10 -4 8 7 9`, 'none', { stroke: '#0a0604', 'stroke-width': 2 });
    const glow = circ(fx, cx, top + 30, 95, glowFill(c.glow), { opacity: 0 });
    const core = circ(fx, cx, top + 34, 14, '#fff', { opacity: 0, filter: 'url(#kit-blur)' });
    return {
      pins: { A: pt(0, 0), K: pt(sp, 0), '+': pt(0, 0), '-': pt(sp, 0) },
      init: { on: 0, burnt: false },
      set(s) {
        const b = s.burnt ? 0 : Math.max(0, Math.min(1, +s.on || 0));
        lit.setAttribute('opacity', (b * 0.9).toFixed(2));
        bd.setAttribute('fill', s.burnt ? '#5a3a2a' : c.body);
        glow.setAttribute('opacity', (Math.pow(b, 0.7)).toFixed(2));
        core.setAttribute('opacity', (b * 0.9).toFixed(2));
        burnt.setAttribute('opacity', s.burnt ? 1 : 0);
      },
    };
  };

  /* ================================================================== resistor */
  const COLORS = { black: '#1b1b1b', brown: '#7b3a16', red: '#d21f1b', orange: '#f2781a', yellow: '#f7d117', green: '#1d8b3c',
    blue: '#1f55c9', violet: '#8a3fc2', grey: '#8d8d8d', white: '#f3f3f3', gold: '#c8a03a', silver: '#c3c5c8' };
  const DIG = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white'];
  function bands(ohms, n = 4) {
    const sig = n === 5 ? 3 : 2;
    let e = Math.floor(Math.log10(ohms)) - (sig - 1);
    let m = Math.round(ohms / Math.pow(10, e));
    if (m >= Math.pow(10, sig)) { m /= 10; e += 1; }
    const ds = String(m).padStart(sig, '0').split('').map((d) => DIG[+d]);
    const mult = e >= 0 ? DIG[e] : e === -1 ? 'gold' : 'silver';
    return ds.concat(mult, n === 5 ? 'brown' : 'gold');
  }
  PARTS.resistor = (g, o, fx) => {
    const sp = (o.span || 4) * P, n = o.bands === 5 ? 5 : 4, blue = o.body === 'blue' || (n === 5 && o.body !== 'beige');
    const BL = 66, x0 = (sp - BL) / 2, x1 = x0 + BL;
    lead(g, [[0, 0], [sp, 0]]);
    const bodyC = blue ? '#5f8fd0' : '#d9c7a4', hi = blue ? '#a8c6ee' : '#f3e7cf', lo = blue ? '#3c6aa8' : '#b8a27c';
    // dog-bone body: bulging end caps (Ø 2.7 mm) and a slimmer middle (Ø 2.2 mm), tapering into the leads
    const D = `M${x0 - 3} -3C${x0 - 2} -12 ${x0 + 4} -13.5 ${x0 + 10} -13.5S${x0 + 18} -12.5 ${x0 + 22} -10.5H${x1 - 22}C${x1 - 18} -12.5 ${x1 - 16} -13.5 ${x1 - 10} -13.5S${x1 + 2} -12 ${x1 + 3} -3V3C${x1 + 2} 12 ${x1 - 4} 13.5 ${x1 - 10} 13.5S${x1 - 18} 12.5 ${x1 - 22} 10.5H${x0 + 22}C${x0 + 18} 12.5 ${x0 + 16} 13.5 ${x0 + 10} 13.5S${x0 - 2} 12 ${x0 - 3} 3z`;
    path(g, D, bodyC, { stroke: lo, 'stroke-width': 1 });
    const bandG = g_(g);
    const cols = bands(o.ohms || 220, n);
    const pos = n === 4 ? [0.17, 0.33, 0.47, 0.8] : [0.15, 0.28, 0.41, 0.54, 0.83];
    cols.forEach((cn, i) => {
      const x = x0 + BL * pos[i], end = i === 0 || i === cols.length - 1, h = end ? 13.4 : 10.4;
      rect(bandG, x - 3.5, -h, 7, 2 * h, COLORS[cn], { rx: 1.5 });
    });
    const sheen = g_(g);
    path(sheen, D, 'none', { stroke: hi, 'stroke-width': 0, opacity: 0 }); rect(sheen, x0 + 2, -8, BL - 4, 3.5, hi, { rx: 1.75, opacity: 0.5 });
    rect(sheen, x0 + 2, 5, BL - 4, 4, lo, { rx: 2, opacity: 0.3 });
    const heat = path(g, D, '#ff5a1a', { opacity: 0 });
    const glow = el('ellipse', { cx: sp / 2, cy: 0, rx: 70, ry: 40, fill: glowFill('#ff6a1a'), opacity: 0 }, fx);
    return {
      pins: { 1: pt(0, 0), 2: pt(sp, 0) },
      init: { heat: 0 },
      set(s) {
        const h = Math.max(0, Math.min(1, +s.heat || 0));
        heat.setAttribute('opacity', (h * 0.55).toFixed(2));
        heat.setAttribute('fill', h > 0.8 ? '#7a2a10' : '#ff5a1a');
        glow.setAttribute('opacity', (h * h).toFixed(2));
      },
    };
  };

  /* ================================================================== LDR (GL55xx) */
  PARTS.ldr = (g, o, fx) => {
    const L = o.leg ?? 40, cx = P / 2, cy = -L - 30;
    lead(g, [[0, 0], [0, cy + 14]], 4.5); lead(g, [[P, 0], [P, cy + 14]], 4.5);
    circ(g, cx, cy, 28, '#a8361f');
    circ(g, cx, cy, 25.5, '#c4472a');
    circ(g, cx, cy, 23, '#efe4d4');
    // interdigitated electrodes + the CdS serpentine
    const face = circ(g, cx, cy, 23, '#000', { opacity: 0 });
    let d = `M${cx - 15} ${cy - 13}`;
    for (let k = 0; k < 6; k++) { const x = cx - 15 + k * 6; d += `V${cy + (k % 2 ? -13 : 13)}`; if (k < 5) d += `h6`; }
    path(g, d, 'none', { stroke: '#c9542a', 'stroke-width': 3.6, 'stroke-linejoin': 'round' });
    path(g, `M${cx - 21} ${cy - 6}a23 23 0 0 1 9 -15M${cx + 21} ${cy + 6}a23 23 0 0 1 -9 15`, 'none', { stroke: '#c7c9cc', 'stroke-width': 4 });
    circ(g, cx - 12, cy - 15, 3.4, '#d3d5d8'); circ(g, cx + 12, cy + 15, 3.4, '#d3d5d8');
    const rays = g_(fx, { opacity: 0, stroke: '#f4b400', 'stroke-width': 3.5, 'stroke-linecap': 'round', fill: '#f4b400' });
    for (const [dx, dy] of [[-20, -34], [4, -40]]) {
      path(rays, `M${cx + dx - 26} ${cy + dy - 22}L${cx + dx} ${cy + dy}`, 'none');
      path(rays, `M${cx + dx} ${cy + dy}l-11 -1 5 -8z`, '#f4b400', { 'stroke-width': 1 });
    }
    const glow = circ(fx, cx, cy, 55, glowFill('#ffe680'), { opacity: 0 });
    return {
      pins: { 1: pt(0, 0), 2: pt(P, 0) },
      init: { light: 0.6 },
      set(s) {
        const l = Math.max(0, Math.min(1, s.light ?? 0.6));
        face.setAttribute('opacity', ((1 - l) * 0.35).toFixed(2));
        rays.setAttribute('opacity', l.toFixed(2)); glow.setAttribute('opacity', (l * 0.8).toFixed(2));
      },
    };
  };

  /* ================================================================== 6×6 tactile switch */
  PARTS.button = (g, o) => {
    const cx = P, cy = 1.5 * P;
    for (const [x, y] of [[0, 0], [2 * P, 0], [0, 3 * P], [2 * P, 3 * P]]) {
      const dy = y ? -1 : 1;
      lead(g, [[x, y], [x, cy + dy * 30]], 7, '#b7bbc0');
    }
    rect(g, cx - 30, cy - 30, 60, 60, '#26272a', { rx: 3 });
    rect(g, cx - 27, cy - 27, 54, 54, '#1b1c1e', { rx: 2, stroke: '#3a3c40', 'stroke-width': 1 });
    for (const [dx, dy] of [[-20, -20], [20, -20], [-20, 20], [20, 20]]) circ(g, cx + dx, cy + dy, 3.4, '#0e0f10', { stroke: '#3f4146', 'stroke-width': 1 });
    const capC = { black: '#202124', red: '#d4232a', blue: '#2c5fd6', yellow: '#efc21a', white: '#ecebe6', green: '#2b9a44' }[o.cap || 'black'] || o.cap;
    circ(g, cx, cy, 19, '#0f1011');
    const cap = g_(g, { style: 'transition: transform .08s' });
    circ(cap, cx, cy, 17.5, capC);
    circ(cap, cx - 4, cy - 5, 10, '#fff', { opacity: 0.12 });
    return {
      pins: { '1a': pt(0, 0), '1b': pt(0, 3 * P), '2a': pt(2 * P, 0), '2b': pt(2 * P, 3 * P) },
      init: { pressed: false },
      set(s) {
        cap.setAttribute('transform', s.pressed ? `translate(${cx} ${cy}) scale(.86) translate(${-cx} ${-cy})` : '');
        cap.setAttribute('opacity', s.pressed ? 0.85 : 1);
      },
    };
  };

  /* ================================================================== TO-92 transistor */
  const TO92 = {
    BC547B: { pins: ['C', 'B', 'E'], lines: ['BC', '547B'] },
    '2N2222': { pins: ['E', 'B', 'C'], lines: ['2N', '2222A'] },
    BC557B: { pins: ['C', 'B', 'E'], lines: ['BC', '557B'] },
  };
  PARTS.npn = (g, o) => {
    const m = TO92[o.model] || TO92.BC547B, L = o.leg ?? 45, top = -L - 48;
    [0, 1, 2].forEach((k) => lead(g, [[k * P, 0], [k * P, -L + 18], [P + (k - 1) * 12.7, -L + 4], [P + (k - 1) * 12.7, -L]], 4.2));
    path(g, `M${P - 24} ${-L}V${top + 9}q0 -9 9 -9h30q9 0 9 9V${-L}z`, '#1c1c1e');
    path(g, `M${P - 20} ${-L - 2}V${top + 10}q0 -6 6 -6h28q6 0 6 6V${-L - 2}z`, '#2b2b2e');
    rect(g, P - 24, -L - 3, 48, 3, '#111');
    text(g, P, top + 17, m.lines[0], { fill: '#bdbdbd', size: 10, weight: 400 });
    text(g, P, top + 31, m.lines[1], { fill: '#bdbdbd', size: 10, weight: 400, len: m.lines[1].length > 4 ? 38 : null });
    if (o.legLabels !== false) m.pins.forEach((n, k) => text(g, k * P + (k - 1) * 0, 18, n, { fill: INK, size: 13, weight: 700 }));
    const pins = { 1: pt(0, 0), 2: pt(P, 0), 3: pt(2 * P, 0) };
    m.pins.forEach((n, k) => { pins[n] = pt(k * P, 0); });
    return { pins };
  };
  PARTS.pnp = (g, o, fx) => PARTS.npn(g, Object.assign({ model: 'BC557B' }, o), fx);

  /* ================================================================== diode 1N4007 */
  PARTS.diode = (g, o) => {
    const sp = (o.span || 4) * P, BL = 52, x0 = (sp - BL) / 2;
    lead(g, [[0, 0], [sp, 0]], 4.5);
    rect(g, x0, -13.5, BL, 27, 'url(#kit-cyl-black)', { rx: 4 });
    rect(g, x0 + 2, -9, BL - 4, 4, '#4a4c50', { rx: 2, opacity: 0.8 });
    rect(g, x0 + BL - 12, -13.5, 9, 27, '#b9bcc0');
    rect(g, x0 + BL - 12, -9, 9, 4, '#e3e5e8');
    text(g, x0 + (BL - 12) / 2, 1, o.model || '1N4007', { fill: '#9c9ea2', size: 7.5, weight: 400, len: 34 });
    return { pins: { A: pt(0, 0), K: pt(sp, 0) } };
  };

  /* ================================================================== capacitors */
  PARTS['cap-ceramic'] = (g, o) => {
    const L = o.leg ?? 40, cx = P / 2, cy = -L - 34, yellow = o.color === 'yellow';
    const body = yellow ? '#e6a432' : '#2e7fc6', dk = yellow ? '#b87a17' : '#1d5a96';
    lead(g, [[0, 0], [0, -L + 8], [cx - 6, cy + 10]], 4); lead(g, [[P, 0], [P, -L + 8], [cx + 6, cy + 10]], 4);
    path(g, `M${cx - 12} ${cy + 14}q12 18 24 0z`, dk);
    el('ellipse', { cx, cy, rx: 26, ry: 25, fill: body, stroke: dk, 'stroke-width': 1.5 }, g);
    el('ellipse', { cx: cx - 8, cy: cy - 9, rx: 11, ry: 7, fill: '#fff', opacity: 0.2 }, g);
    text(g, cx, cy + 1, o.code || '104', { fill: yellow ? '#3b2a0a' : '#0d2a47', size: 13 });
    return { pins: { 1: pt(0, 0), 2: pt(P, 0) } };
  };
  PARTS['cap-electrolytic'] = (g, o) => {
    const L = o.leg ?? 30, cx = P / 2, bot = -L - 6, top = bot - 110;
    lead(g, [[0, 0], [0, -L + 16], [cx - 12, -L + 4], [cx - 12, bot]], 4.5);
    lead(g, [[P, 0], [P, -L + 10], [cx + 12, -L], [cx + 12, bot]], 4.5);
    rect(g, cx - 28, bot - 4, 56, 10, '#2a2a2a', { rx: 3 });
    rect(g, cx - 31.5, top, 63, bot - top, 'url(#kit-cyl-black)', { rx: 6 });
    rect(g, cx + 11, top + 6, 17, bot - top - 12, '#c7cacd');
    for (let k = 0; k < 4; k++) rect(g, cx + 15, top + 18 + k * 24, 9, 3, '#222');
    rect(g, cx - 31.5, top, 63, 8, 'url(#kit-metal-h)', { rx: 4 });
    rect(g, cx - 31.5, top + 12, 63, 3, '#000', { opacity: 0.4 });
    text(g, cx - 12, (top + bot) / 2, `${o.uf || 100}µF ${o.volts || 25}V`, { fill: '#e8e8e8', size: 9.5, rot: -90, weight: 400 });
    text(g, cx - 16, -L + 22, '+', { fill: INK, size: 14 });
    return { pins: { '+': pt(0, 0), '-': pt(P, 0) } };
  };

  /* ================================================================== potentiometer 16 mm */
  PARTS.pot = (g, o) => {
    const cx = 2 * P, cy = -98;
    rect(g, cx - 62, -40, 124, 22, '#8a4e22', { rx: 3 });
    for (let k = 0; k < 3; k++) {
      const x = k * 2 * P;
      lead(g, [[x, 0], [x, -26]], 9, '#c3c6ca');
      rect(g, x - 8, -36, 16, 18, '#cfd2d6', { rx: 3 }); circ(g, x, -27, 3.5, '#6d4422');
    }
    circ(g, cx, cy, 81, '#9da2a8');
    circ(g, cx, cy, 78, 'url(#kit-knurl)');
    text(g, cx, cy + 58, o.value || 'B10K', { fill: '#3d4045', size: 13 });
    // hex nut, bushing, knurled shaft
    const hx = Array.from({ length: 6 }, (_, k) => { const a = Math.PI / 6 + k * Math.PI / 3; return `${f1(cx + 46 * Math.cos(a))} ${f1(cy + 46 * Math.sin(a))}`; });
    path(g, 'M' + hx.join('L') + 'z', '#c3c7cc', { stroke: '#82878d', 'stroke-width': 1.5 });
    circ(g, cx, cy, 35, '#d2d5d9', { stroke: '#8f949a', 'stroke-width': 1.2 });
    circ(g, cx, cy, 31, 'none', { stroke: '#a9adb2', 'stroke-width': 1 });
    const shaft = g_(g, { style: 'transition: transform .12s' });
    circ(shaft, cx, cy, 30, '#e3e5e8', { stroke: '#7d8288', 'stroke-width': 1.2 });
    for (let k = 0; k < 24; k++) {
      const a = k * Math.PI / 12;
      path(shaft, `M${f1(cx + 24 * Math.cos(a))} ${f1(cy + 24 * Math.sin(a))}L${f1(cx + 30 * Math.cos(a))} ${f1(cy + 30 * Math.sin(a))}`, 'none', { stroke: '#9aa0a6', 'stroke-width': 1.6 });
    }
    rect(shaft, cx - 3, cy - 24, 6, 48, '#55595f', { rx: 2 });
    circ(shaft, cx, cy - 18, 3.5, '#d33');
    return {
      pins: { 1: pt(0, 0), 2: pt(2 * P, 0), 3: pt(4 * P, 0), W: pt(2 * P, 0) },
      init: { pos: 0.5 },
      set(s) { const a = -150 + 300 * Math.max(0, Math.min(1, +s.pos)); shaft.setAttribute('transform', `rotate(${f1(a)} ${cx} ${cy})`); },
    };
  };

  /* ================================================================== relay module */
  PARTS['relay-module'] = (g, o, fx) => {
    const X0 = -38, X1 = 466, Y0 = -105, Y1 = 156;
    rect(g, X0, Y0, X1 - X0, Y1 - Y0, '#1c74b8', { rx: 6, stroke: '#145a90', 'stroke-width': 1.5 });
    for (const [x, y] of [[448, -86], [448, 136]]) { circ(g, x, y, 13, '#e6edf2'); circ(g, x, y, 9, '#1a1a1a'); }
    // header
    rect(g, -13, -13, 26, 77, '#18191b', { rx: 2 });
    [0, P, 2 * P].forEach((y) => { rect(g, -5, y - 5, 10, 10, lin('kit-gold')); });
    ['VCC', 'GND', 'IN'].forEach((s, k) => text(g, 33, k * P, s, { size: 11.5 }));
    // LEDs (3 mm, top view)
    const ledAt = (x, y, col) => { circ(g, x, y, 17, shade(col, -0.35)); const c = circ(g, x, y, 14.5, col); circ(g, x - 5, y - 5, 4, '#fff', { opacity: 0.35 }); return c; };
    const pwr = ledAt(-8, -68, '#b81d1d'), st = ledAt(-8, 118, '#1e8f35');
    text(g, 24, -68, 'PWR', { size: 10 });
    // SMD parts
    for (const [x, y, s] of [[86, -40, '222'], [86, 92, '222'], [114, -76, '102']]) {
      rect(g, x - 12, y - 7, 24, 14, '#161616', { rx: 1 }); rect(g, x - 12, y - 7, 5, 14, '#c3c6ca'); rect(g, x + 7, y - 7, 5, 14, '#c3c6ca');
      text(g, x, y, s, { size: 6.5, fill: '#ddd', weight: 400 });
    }
    rect(g, 74, 14, 24, 18, '#161616', { rx: 1.5 });
    [80, 92].forEach((x) => rect(g, x - 2, 32, 4, 5, '#c3c6ca')); rect(g, 84, 9, 4, 5, '#c3c6ca');
    text(g, 112, 23, 'Q1', { size: 8.5 });
    rect(g, 74, 52, 26, 13, '#1c1c1c', { rx: 1 }); rect(g, 92, 52, 4, 13, '#c3c6ca');
    text(g, 112, 58, 'D1', { size: 8.5 });
    // relay cube
    const cube = g_(g, { class: 'kit-relay-cube' });
    rect(cube, 136, -54, 192, 158, '#16508f', { rx: 6 });
    rect(cube, 140, -50, 184, 150, 'url(#kit-relay)', { rx: 5 });
    rect(cube, 144, -46, 176, 4, '#6fa7e8', { rx: 2, opacity: 0.6 });
    const tc = '#dbe8f7';
    if (o.print !== 'songle') {
      text(cube, 232, -26, 'TONGLING', { fill: tc, size: 15, ls: 1 });
      text(cube, 232, 4, '5VDC', { fill: tc, size: 12 });
      text(cube, 232, 24, '10A 250VAC  10A 125VAC', { fill: tc, size: 8.5, weight: 400 });
      text(cube, 232, 74, 'JQC-3FF-S-Z', { fill: tc, size: 13 });
    } else {
      text(cube, 232, -26, 'SONGLE', { fill: tc, size: 17, ls: 1 });
      text(cube, 232, 2, 'SRD-05VDC-SL-C', { fill: tc, size: 13, len: 150 });
      text(cube, 232, 26, '10A 250VAC  10A 125VAC', { fill: tc, size: 8.5, weight: 400 });
      text(cube, 232, 42, '10A 30VDC  10A 28VDC', { fill: tc, size: 8.5, weight: 400 });
      el('ellipse', { cx: 168, cy: 76, rx: 13, ry: 9, fill: 'none', stroke: tc, 'stroke-width': 1.4 }, cube);
      text(cube, 168, 76, 'CQC', { fill: tc, size: 7, weight: 400 });
      text(cube, 206, 76, 'c', { fill: tc, size: 9, weight: 400 }); text(cube, 222, 76, 'UL', { fill: tc, size: 11 }); text(cube, 238, 76, 'us', { fill: tc, size: 8, weight: 400 });
    }
    // x-ray contact (optional)
    let lever = null;
    if (o.xray) {
      const xg = g_(cube, { stroke: '#fff', 'stroke-width': 3, fill: '#fff', 'stroke-linecap': 'round' });
      rect(xg, 258, 50, 62, 44, '#0d3e75', { rx: 4, 'stroke-width': 1, opacity: 0.9 });
      circ(xg, 268, 72, 3); circ(xg, 306, 60, 3); circ(xg, 306, 84, 3);
      text(xg, 314, 58, 'NC', { size: 6, fill: '#fff', anchor: 'end', 'stroke-width': 0 });
      lever = path(xg, 'M268 72L304 62', 'none', { style: 'transition: d .1s' });
    }
    // screw terminal NC / COM / NO
    const termY = { NC: -24.6, COM: 25.4, NO: 75.4 };
    rect(g, 360, -55, 100, 161, '#2a8ad8', { rx: 4, stroke: '#1a64a6', 'stroke-width': 1.5 });
    Object.values(termY).forEach((y) => {
      rect(g, 372, y - 21, 42, 42, '#1d6cb4', { rx: 3 });
      circ(g, 393, y, 16, 'url(#kit-metal-h)', { stroke: '#6b7076', 'stroke-width': 1 });
      rect(g, 380, y - 2.5, 26, 5, '#4a4f55', { rx: 2, transform: `rotate(-35 393 ${y})` });
      rect(g, 432, y - 14, 30, 28, '#0d2f52', { rx: 2 });
      rect(g, 440, y - 9, 22, 18, 'url(#kit-metal-v)', { rx: 1 });
    });
    for (const [n, y] of Object.entries(termY)) text(g, 345, y, n, { size: 11, rot: -90, len: n.length > 2 ? 26 : null });
    const glowP = circ(fx, -8, -68, 40, glowFill('#ff3020'), { opacity: 0 }), glowS = circ(fx, -8, 118, 40, glowFill('#34ff60'), { opacity: 0 });
    return {
      pins: { VCC: pt(0, 0), GND: pt(0, P), IN: pt(0, 2 * P), NC: pt(460, termY.NC), COM: pt(460, termY.COM), NO: pt(460, termY.NO) },
      init: { on: false, power: true },
      set(s, ch) {
        pwr.setAttribute('fill', s.power ? '#ff5a4a' : '#b81d1d'); glowP.setAttribute('opacity', s.power ? 0.9 : 0);
        const on = s.power && s.on;
        st.setAttribute('fill', on ? '#7dff8e' : '#1e8f35'); glowS.setAttribute('opacity', on ? 0.9 : 0);
        if (lever) lever.setAttribute('d', on ? 'M268 72L304 82' : 'M268 72L304 62');
        if (ch && 'on' in ch && cube.animate && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
          cube.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(1.5px,-1px)' }, { transform: 'translate(-1px,1px)' }, { transform: 'translate(0,0)' }], { duration: 120 });
        }
      },
    };
  };

  /* ================================================================== TT gear motor */
  PARTS['tt-motor'] = (g, o, fx) => {
    // origin = output shaft centre; gearbox body x −330…120, y −112…112
    const GB = { x0: -330, x1: 118, y0: -112, y1: 112 };
    // motor can (silver) + clear end cap + clip
    rect(g, -560, -84, 250, 168, 'url(#kit-metal-v)', { rx: 10 });
    for (let k = 0; k < 3; k++) rect(g, -520 + k * 60, -84, 3, 168, '#8a8f95', { opacity: 0.5 });
    path(g, 'M-560 -86h70v172h-70q-30 0 -30 -30v-112q0 -30 30 -30z', '#e9f1f6', { opacity: 0.62, stroke: '#b9c7d0', 'stroke-width': 2 });
    rect(g, -470, -96, 100, 192, '#eaf2f8', { opacity: 0.5, stroke: '#b9c7d0', 'stroke-width': 2, rx: 8 });
    rect(g, -440, 10, 44, 44, 'none', { stroke: '#b9c7d0', 'stroke-width': 4, rx: 4 });
    rect(g, -432, 22, 16, 28, '#f6d32a', { rx: 3 });
    // terminals
    for (const y of [-112, 96]) { rect(g, -545, y, 22, 16, '#c8893c', { rx: 2 }); circ(g, -534, y + 8, 3.5, '#7a4b17'); }
    // gearbox
    path(g, `M${GB.x0 + 14} ${GB.y0}H${GB.x1 - 70}a70 70 0 0 1 70 70V${GB.y1 - 70}a70 70 0 0 1 -70 70H${GB.x0 + 14}a14 14 0 0 1 -14 -14V${GB.y0 + 14}a14 14 0 0 1 14 -14z`, 'url(#kit-yellow)', { stroke: '#c49d0c', 'stroke-width': 2 });
    rect(g, GB.x0 + 8, GB.y0 + 8, 40, GB.y1 - GB.y0 - 16, '#e9c41c', { rx: 8, opacity: 0.7 });
    // mounting ear
    path(g, `M${GB.x1 - 2} -24h50v48h-50z`, '#f3d628', { stroke: '#c49d0c', 'stroke-width': 2 });
    circ(g, GB.x1 + 28, 0, 9, '#8a6d06');
    // screws + boss + small holes
    for (const y of [-58, 50]) {
      circ(g, -296, y, 15, '#c8ccd1', { stroke: '#7b8086', 'stroke-width': 1.5 });
      path(g, `M-305 ${y}h18M-296 ${y - 9}v18`, 'none', { stroke: '#555a60', 'stroke-width': 3 });
    }
    circ(g, -200, 22, 22, '#f7dc3c', { stroke: '#c49d0c', 'stroke-width': 2 });
    circ(g, -205, 16, 8, '#fff', { opacity: 0.4 });
    for (const [x, y] of [[-110, -70], [60, -90], [80, 95], [-240, 98]]) circ(g, x, y, 4.5, '#b38f0a');
    // output shaft (white, double-D)
    circ(g, 0, 0, 40, '#e7c11b', { stroke: '#c49d0c', 'stroke-width': 2 });
    const rot = g_(g);
    let wheel = null;
    if (o.wheel) {
      wheel = g_(fx);
      circ(wheel, 0, 0, 330, '#1d1e20'); circ(wheel, 0, 0, 255, '#f2cf1d', { stroke: '#c9a40e', 'stroke-width': 4 });
      for (let k = 0; k < 6; k++) { const a = k * 60; rect(wheel, -20, -240, 40, 180, '#f7dc3c', { transform: `rotate(${a})`, rx: 10 }); }
      circ(wheel, 0, 0, 230, 'none', { stroke: '#c9a40e', 'stroke-width': 10 });
      for (let k = 0; k < 36; k++) rect(wheel, -6, -330, 12, 22, '#000', { transform: `rotate(${k * 10})`, opacity: 0.6 });
      circ(wheel, 0, 0, 60, '#f7dc3c', { stroke: '#c9a40e', 'stroke-width': 4 });
      circ(wheel, 0, 0, 14, '#9b7b06');
    }
    path(rot, 'M-17 -22A28 28 0 0 1 17 -22V22A28 28 0 0 1 -17 22Z', '#f2efe8', { stroke: '#b9b2a4', 'stroke-width': 2 });
    rect(rot, -17, -6, 34, 12, '#d9d3c6', { rx: 2 });
    circ(rot, 0, 0, 5, '#9c9486');
    return {
      pins: { '+': pt(-534, -104), '-': pt(-534, 104), shaft: pt(0, 0) },
      init: { angle: 0, rpm: 0 },
      set(s) {
        const t = `rotate(${f1(((s.angle % 360) + 360) % 360)})`;
        rot.setAttribute('transform', t); if (wheel) wheel.setAttribute('transform', t);
      },
      methods: (G) => ({ tick(dt) { G.set({ angle: (G.state.angle || 0) + (G.state.rpm || 0) * 6 * dt }); return G; } }),
    };
  };

  /* ================================================================== UNI-T UT136C+ */
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
    '-': 'g', L: 'fed', O: 'abcdef', o: 'cdeg', E: 'afged', r: 'eg', n: 'ceg', F: 'afge', H: 'bcefg', P: 'abefg', A: 'abcefg',
    C: 'adef', U: 'bcdef', u: 'cde', b: 'cdefg', d: 'bcdeg', t: 'defg', S: 'afgcd', ' ': '' };
  function segShapes(w, h, t) { // hexagon segments a…g in a w×h cell, thickness t
    const q = t / 2, gp = 3, m = h / 2;
    const H = (y) => { const x0 = q + gp, x1 = w - q - gp; return `M${x0} ${y}L${x0 + q} ${y - q}H${x1 - q}L${x1} ${y}L${x1 - q} ${y + q}H${x0 + q}z`; };
    const V = (x, y0, y1) => { y0 += gp; y1 -= gp; return `M${x} ${y0}L${x + q} ${y0 + q}V${y1 - q}L${x} ${y1}L${x - q} ${y1 - q}V${y0 + q}z`; };
    return { a: H(q), g: H(m), d: H(h - q), f: V(q, q, m), b: V(w - q, q, m), e: V(q, m, h - q), c: V(w - q, m, h - q) };
  }
  const DIAL = { OFF: 173, 'V~': 189, V: 204, mV: 218, 'Ω': 243, CAP: 260, Hz: 277, hFE: 294, TEMP: 318, 'µA': 331, mA: 347, A: 6 };
  const DIAL_LBL = { OFF: 'OFF', 'V~': 'V~', V: 'V⎓', mV: 'mV', 'Ω': 'Ω', CAP: '⊣⊢', Hz: 'Hz', hFE: 'hFE', TEMP: '°C°F', 'µA': 'µA', mA: 'mA', A: 'A' };
  PARTS.multimeter = (g, o) => {
    const W = 880, H = 1850, DC = { x: 451, y: 1094 };
    // holster
    rect(g, 0, 0, W, H, '#a50f19', { rx: 120 });
    rect(g, 6, 4, W - 12, H - 14, 'url(#kit-red)', { rx: 116 });
    rect(g, 40, 18, W - 80, 30, '#ff8a8a', { rx: 15, opacity: 0.28 });
    // face
    rect(g, 96, 100, 688, 1655, '#2a292c', { rx: 46 });
    rect(g, 104, 108, 672, 1639, '#333236', { rx: 42 });
    // LCD frame + glass
    rect(g, 118, 126, 644, 456, '#1a1a1c', { rx: 18 });
    rect(g, 220 - 52, 136, 104, 36, '#d42530', { rx: 4 });
    text(g, 220, 154, 'UNI-T', { size: 28, ls: 1 });
    text(g, 720, 155, 'UT136C+', { size: 30, italic: true, anchor: 'end' });
    const glass = rect(g, 140, 186, 600, 380, 'url(#kit-lcd)', { rx: 8 });
    const lcd = g_(g);
    // 7-segment digits: minus + 4 digits with decimal points
    const cw = 96, ch = 236, gap = 30, x0 = 256, y0 = 262;
    const shapes = segShapes(cw, ch, 22);
    const digits = [], dps = [];
    for (let i = 0; i < 4; i++) {
      const dg = g_(lcd, { transform: `translate(${x0 + i * (cw + gap)} ${y0}) skewX(-7)` });
      const segs = {};
      for (const s in shapes) segs[s] = path(dg, shapes[s], '#111');
      digits.push(segs);
      if (i < 3) dps.push(rect(dg, cw + 4, ch - 22, 22, 22, '#111', { class: 'kit-dp' }));
    }
    const minus = rect(lcd, 200, y0 + ch / 2 - 10, 44, 20, '#111');
    const ann = {
      ac: text(lcd, 196, 300, 'AC', { fill: '#111', size: 36, anchor: 'middle' }),
      dc: text(lcd, 196, 300, 'DC', { fill: '#111', size: 36, anchor: 'middle' }),
      unit: text(lcd, 700, 222, 'V', { fill: '#111', size: 40, anchor: 'end' }),
      auto: text(lcd, 290, 540, 'Auto', { fill: '#111', size: 34 }),
      apo: text(lcd, 410, 540, 'APO', { fill: '#111', size: 34 }),
      hold: text(lcd, 640, 540, 'H', { fill: '#111', size: 34 }),
    };
    // buttons
    rect(g, 138, 670, 132, 66, '#f7a52a', { rx: 6 }); text(g, 204, 640, 'SELECT', { size: 24 });
    rect(g, 382, 670, 130, 66, '#7c99e6', { rx: 6 }); text(g, 456, 640, 'HOLD/☼>2Sec', { size: 22, len: 170 });
    // hFE socket
    circ(g, 676, 712, 44, '#2b2a2e', { stroke: '#4a494e', 'stroke-width': 2 });
    for (const [dx, dy] of [[-16, -12], [0, 0], [16, 12], [-16, 12], [16, -12]]) circ(g, 676 + dx, 712 + dy, 5, '#111');
    text(g, 712, 652, 'NPN', { size: 18, anchor: 'start' }); text(g, 712, 772, 'PNP', { size: 18, fill: '#f7a52a', anchor: 'start' });
    // dial ring, labels
    circ(g, DC.x, DC.y, 268, '#222124');
    for (const k in DIAL) {
      const a = DIAL[k] * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      circ(g, DC.x + 292 * c, DC.y + 292 * s, 6, '#e8e8e8');
      const lx = DC.x + 350 * c, ly = DC.y + 336 * s;
      const orange = k === 'Ω' || k === 'TEMP';
      const an = c < -0.3 ? 'end' : c > 0.3 ? 'start' : 'middle';
      text(g, an === 'end' ? lx + 24 : an === 'start' ? lx - 24 : lx, ly, DIAL_LBL[k], { size: 30, fill: '#f2f2f2', anchor: an });
      if (orange) text(g, lx + (k === 'Ω' ? -60 : 40), ly, k === 'Ω' ? '→·))' : '', { size: 24, fill: '#f7a52a' });
    }
    const knob = g_(g, { style: 'transition: transform .25s' });
    circ(knob, DC.x, DC.y, 232, '#1c1c1e', { stroke: '#101012', 'stroke-width': 4 });
    circ(knob, DC.x, DC.y, 220, '#262628');
    path(knob, `M${DC.x - 250} ${DC.y - 46}h500q24 0 24 24v44q0 24 -24 24h-500q-24 0 -24 -24v-44q0 -24 24 -24z`, '#141416');
    path(knob, `M${DC.x - 240} ${DC.y - 34}h480`, 'none', { stroke: '#3a3a3e', 'stroke-width': 6, 'stroke-linecap': 'round' });
    rect(knob, DC.x - 262, DC.y - 6, 70, 12, '#f0f0f0', { rx: 6 });
    text(g, 443, 1410, '4000  Count', { size: 30, italic: true, fill: '#f0f0f0' });
    // jacks
    const jack = (x, c) => {
      circ(g, x, 1585, 62, '#1d1d1f', { stroke: '#4a494e', 'stroke-width': 3 });
      circ(g, x, 1585, 46, c || '#2e2e31'); circ(g, x, 1585, 30, '#0a0a0b'); circ(g, x, 1585, 12, '#7f848a');
    };
    jack(244); jack(445); jack(655);
    text(g, 244, 1497, '10A', { size: 30 }); text(g, 445, 1497, 'COM', { size: 30, fill: '#f7a52a' });
    text(g, 663, 1462, '→+·))⊣⊢ Hz mA', { size: 20, len: 170 }); text(g, 663, 1492, 'VΩ µA°C°F', { size: 22, len: 150 });
    for (const x of [352, 554]) { path(g, `M${x} 1532l22 38h-44z`, '#f7a52a'); text(g, x, 1558, '!', { size: 22, fill: '#111' }); }
    text(g, 345, 1636, 'FUSED', { size: 17, weight: 400 }); text(g, 345, 1658, '10A Max', { size: 17, weight: 400 });
    text(g, 554, 1636, 'FUSED', { size: 17, weight: 400 }); text(g, 554, 1658, '400mA Max', { size: 17, weight: 400 });
    text(g, 554, 1680, 'CAT II 1000V', { size: 15, weight: 400 }); text(g, 554, 1700, 'CAT III 600V', { size: 15, weight: 400 });
    // fuse x-ray (optional)
    let fuse = null;
    if (o.fuseView) {
      const fg = g_(g);
      rect(fg, 610, 1625, 150, 94, '#0f1012', { rx: 10, stroke: '#7ab8ff', 'stroke-width': 3, 'stroke-dasharray': '8 6' });
      rect(fg, 626, 1655, 118, 34, '#dfe9ee', { rx: 6, opacity: 0.55 });
      rect(fg, 626, 1655, 18, 34, 'url(#kit-metal-v)'); rect(fg, 726, 1655, 18, 34, 'url(#kit-metal-v)');
      fuse = { ok: path(fg, 'M644 1672H726', 'none', { stroke: '#d8dde2', 'stroke-width': 3 }),
        bad: g_(fg, { opacity: 0 }) };
      path(fuse.bad, 'M644 1672H676M694 1672H726', 'none', { stroke: '#d8dde2', 'stroke-width': 3 });
      el('ellipse', { cx: 685, cy: 1672, rx: 18, ry: 12, fill: '#3a2a20', opacity: 0.8 }, fuse.bad);
      text(fg, 685, 1712, 'F1 0.5A', { size: 12, weight: 400, fill: '#cfd6dc' });
    }
    const cell = (i, ch) => { const on = SEG[ch] ?? ''; for (const s in digits[i]) digits[i][s].setAttribute('opacity', on.includes(s) ? 1 : 0.045); };
    return {
      pins: { COM: pt(445, 1585), V: pt(655, 1585), A: pt(244, 1585), mA: pt(655, 1585) },
      init: { dial: 'V', display: '0.00', unit: 'V', ac: false, hold: false, fuse: 'ok' },
      set(s) {
        const on = s.dial !== 'OFF';
        knob.setAttribute('transform', `rotate(${f1((DIAL[s.dial] ?? 173) - 180)} ${DC.x} ${DC.y})`);
        glass.setAttribute('fill', on ? 'url(#kit-lcd)' : '#9fb3b1');
        lcd.setAttribute('opacity', on ? 1 : 0);
        let str = on ? String(s.display ?? '') : '';
        if (str === 'OL') str = ' 0.L';
        let neg = false;
        if (str[0] === '-' && str.length > 1 && /[\d.]/.test(str[1])) { neg = true; str = str.slice(1); }
        const chars = [], dp = [];
        for (const chx of str) { if (chx === '.' || chx === ',') { dp[chars.length - 1] = true; } else chars.push(chx); }
        while (chars.length < 4) { chars.unshift(' '); dp.unshift(false); }
        const off = chars.length - 4;
        for (let i = 0; i < 4; i++) cell(i, chars[i + off]);
        dps.forEach((r, i) => r.setAttribute('opacity', dp[i + off] ? 1 : 0.045));
        minus.setAttribute('opacity', neg ? 1 : 0.045);
        ann.ac.setAttribute('opacity', s.ac ? 1 : 0); ann.dc.setAttribute('opacity', s.ac ? 0 : 1);
        ann.unit.textContent = s.unit || '';
        ann.hold.setAttribute('opacity', s.hold ? 1 : 0);
        if (fuse) { fuse.ok.setAttribute('opacity', s.fuse === 'blown' ? 0 : 1); fuse.bad.setAttribute('opacity', s.fuse === 'blown' ? 1 : 0); }
      },
    };
  };

  /* ================================================================== logic analyzer 24 MHz 8 ch */
  PARTS['logic-analyzer'] = (g, o, fx) => {
    const W = 540, H = 262;
    // mini-USB (left), header (right)
    rect(g, -26, 100, 40, 62, 'url(#kit-metal-v)', { rx: 4 }); rect(g, -26, 116, 14, 30, '#202124', { rx: 2 });
    rect(g, 0, 0, W, H, '#151517', { rx: 34 });
    rect(g, 6, 6, W - 12, H - 12, '#232326', { rx: 30 });
    rect(g, 52, 24, 400, 214, '#f4f4f2', { rx: 14 });
    const hx = W - 6, hy = (H - 5 * P) / 2 - 14;
    rect(g, hx, hy, 82, 5 * P + 28, '#18191b', { rx: 4 });
    rect(g, hx + 8, hy + 8, 66, 5 * P + 12, '#0b0b0c', { rx: 2 });
    const pins = { USB: pt(-26, 131) };
    const col = [['CH1', 'CH3', 'CH5', 'CH7', 'CLK'], ['CH2', 'CH4', 'CH6', 'CH8', 'GND']];
    const px = [hx + 28, hx + 28 + P];
    col.forEach((names, c) => names.forEach((n, r) => {
      const p = pt(px[c], hy + 26 + r * P); pins[n] = p;
      rect(g, p.x - 5, p.y - 5, 10, 10, lin('kit-gold'));
    }));
    path(g, `M${hx + 4} ${hy + 6}l12 0 -12 12z`, '#e8e8e8');
    // label print
    const ink = '#1d1d1f';
    text(g, 120, 205, '24MHz8CH', { fill: ink, size: 30, anchor: 'start', len: 176 });
    const dx0 = 250, dy0 = 108;
    rect(g, dx0 - 14, dy0 - 18, 5 * 34 + 10, 56, 'none', { stroke: ink, 'stroke-width': 2 });
    col[1].forEach((n, k) => { rect(g, dx0 + k * 34, dy0 - 10, 12, 12, 'none', { stroke: ink, 'stroke-width': 2 }); text(g, dx0 + 6 + k * 34, dy0 - 36, n, { fill: ink, size: 14 }); });
    col[0].forEach((n, k) => { rect(g, dx0 + k * 34, dy0 + 12, 12, 12, 'none', { stroke: ink, 'stroke-width': 2 }); text(g, dx0 + 6 + k * 34, dy0 + 52, n, { fill: ink, size: 14 }); });
    text(g, 400, 52, 'PWR', { fill: ink, size: 15 });
    const led = circ(g, 436, 52, 7, '#3a4a5a');
    const glow = circ(fx, 436, 52, 30, glowFill('#3aa8ff'), { opacity: 0 });
    const hl = g_(fx);
    return {
      pins,
      init: { pwr: false, hl: null },
      set(s) {
        led.setAttribute('fill', s.pwr ? '#9fd6ff' : '#3a4a5a'); glow.setAttribute('opacity', s.pwr ? 1 : 0);
        hl.replaceChildren();
        [].concat(s.hl || []).forEach((n) => { const p = pins[n]; if (p) circ(hl, p.x, p.y, 11, 'none', { stroke: '#ffd23f', 'stroke-width': 4 }); });
      },
    };
  };

  /* ================================================================== MB102 breadboard power module */
  PARTS['power-module'] = (g, o, fx) => {
    const X0 = -175, X1 = 175, Y0 = -48, Y1 = 18 * P + 48;
    rect(g, X0, Y0, X1 - X0, Y1 - Y0, '#161618', { rx: 8, stroke: '#2d2d30', 'stroke-width': 2 });
    for (const [x, y] of [[X0 + 18, Y0 + 18], [X1 - 18, Y1 - 18]]) { circ(g, x, y, 12, '#d8d8d8'); circ(g, x, y, 8, '#0a0a0a'); }
    // rail pins (2 columns per rail; column 0 = the named pins)
    const railY = { 'T+': 0, 'T-': P, 'B+': 17 * P, 'B-': 18 * P };
    for (const y of Object.values(railY)) for (const x of [0, P]) { rect(g, x - 10, y - 10, 20, 20, '#0c0c0d'); rect(g, x - 4, y - 4, 8, 8, lin('kit-gold')); }
    text(g, 40, -28, '+', { size: 18 }); text(g, 40, P + 30, '−', { size: 18 });
    text(g, 40, 17 * P - 30, '+', { size: 18 }); text(g, 40, 18 * P + 30, '−', { size: 18 });
    // DC jack + push switch + LED
    rect(g, X0 - 40, 60, 150, 110, '#121213', { rx: 6, stroke: '#2a2a2c', 'stroke-width': 2 });
    circ(g, X0 - 2, 115, 30, '#050505', { stroke: '#2b2b2d', 'stroke-width': 3 }); circ(g, X0 - 2, 115, 8, 'url(#kit-metal-h)');
    rect(g, X0 + 6, 200, 76, 76, '#c9c9c4', { rx: 4 }); rect(g, X0 + 20, 214, 48, 48, '#f6f6f2', { rx: 3 });
    const sw = rect(g, X0 + 28, 222, 32, 32, '#ffffff', { rx: 2, stroke: '#d0d0ca', 'stroke-width': 1 });
    circ(g, 78, 238, 15, shade('#1e8f35', -0.35)); const led = circ(g, 78, 238, 12.5, '#1e8f35');
    // electrolytic (top view), regulators
    circ(g, 115, 160, 30, '#151515', { stroke: '#555', 'stroke-width': 3 });
    circ(g, 115, 160, 26, '#2a3f5f'); path(g, 'M115 138v44M93 160h44', 'none', { stroke: '#8a9bb3', 'stroke-width': 2 });
    for (const y of [70, 330]) { rect(g, 80, y, 70, 36, '#1f1f22', { rx: 2 }); rect(g, 92, y - 12, 46, 12, '#b8bcc1'); text(g, 115, y + 18, 'AMS1117', { size: 7.5, fill: '#cfcfcf', weight: 400 }); }
    // USB-A
    rect(g, X0 - 30, 300, 130, 140, 'url(#kit-metal-h)', { rx: 4, stroke: '#6d7278', 'stroke-width': 1.5 });
    rect(g, X0 - 20, 320, 26, 100, '#222', { rx: 2 });
    // jumpers (5V | OFF | 3.3V) for each rail side
    const jumpers = {};
    for (const [side, y] of [['top', -28], ['bottom', 18 * P + 28]]) {
      const xs = [100, 125.4, 150.8];
      rect(g, xs[0] - 13, y - 13, 77, 26, '#efe6cc', { rx: 3, stroke: '#cbbf9c', 'stroke-width': 1 });
      xs.forEach((x) => rect(g, x - 4, y - 4, 8, 8, lin('kit-gold')));
      text(g, 100, y + (side === 'top' ? 26 : -26), '5V', { size: 10 }); text(g, 150.8, y + (side === 'top' ? 26 : -26), '3.3V', { size: 10 });
      jumpers[side] = { cap: rect(g, 0, y - 13, 50, 26, '#f2c43c', { rx: 4, stroke: '#b38b14', 'stroke-width': 1.5 }), xs };
    }
    // output header 2×4 (GND / 5V / 3.3V) and small SMD parts
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) { const x = -20 + c * P, y = 250 + r * P; rect(g, x - 10, y - 10, 20, 20, '#111'); rect(g, x - 4.5, y - 4.5, 9, 9, lin('kit-gold')); }
    ['GND', 'GND', '5V', '3.3V'].forEach((t, r) => text(g, -36, 250 + r * P, t, { size: 10, anchor: 'end' }));
    for (const [x, y] of [[-40, 60], [-10, 60], [60, 400], [90, 400], [-60, 200], [-30, 200]]) {
      rect(g, x - 9, y - 5, 18, 10, '#1d1d1d', { stroke: '#555', 'stroke-width': 1 }); rect(g, x - 9, y - 5, 4, 10, '#c3c6ca'); rect(g, x + 5, y - 5, 4, 10, '#c3c6ca');
    }
    text(g, X1 - 30, 230, 'YwRobot', { size: 15, rot: -90 });
    text(g, X1 - 54, 230, '545043', { size: 11, rot: -90, weight: 400 });
    const glow = circ(fx, 78, 238, 40, glowFill('#34ff60'), { opacity: 0 });
    return {
      pins: { 'T+': pt(0, 0), 'T-': pt(0, P), 'B+': pt(0, 17 * P), 'B-': pt(0, 18 * P) },
      init: { on: true, top: '5V', bottom: '3.3V' },
      set(s) {
        led.setAttribute('fill', s.on ? '#7dff8e' : '#1e8f35'); glow.setAttribute('opacity', s.on ? 0.9 : 0);
        sw.setAttribute('transform', s.on ? 'translate(2 2) scale(.94)' : '');
        for (const side of ['top', 'bottom']) {
          const j = jumpers[side], v = s[side];
          const x = v === '3.3V' ? j.xs[1] : v === 'OFF' ? null : j.xs[0];
          j.cap.setAttribute('opacity', x == null ? 0 : 1);
          if (x != null) j.cap.setAttribute('x', f1(x - 12));
        }
      },
    };
  };

  /* ================================================================== multimeter probe */
  PARTS.probe = (g, o) => {
    const c = o.color === 'black' ? ['#1b1b1d', '#3a3a3e', '#000'] : ['#c8141e', '#f04048', '#8d0b12'];
    // tip (pointing up from the origin), finger guard, handle, strain relief
    path(g, 'M-3 0L-6 30V150H6V30L3 0z', 'url(#kit-metal-h)');
    rect(g, -24, 150, 48, 60, c[0], { rx: 6 });
    rect(g, -42, 210, 84, 34, c[0], { rx: 14 });
    path(g, 'M-34 244h68l-8 640h-52z', c[0]);
    rect(g, -22, 260, 10, 600, c[1], { rx: 5, opacity: 0.6 });
    for (let k = 0; k < 9; k++) rect(g, -31, 420 + k * 40, 62, 6, c[2], { opacity: 0.6, rx: 3 });
    path(g, 'M-26 884h52l-10 160h-32z', c[0]);
    return { pins: { tip: pt(0, 0), end: pt(0, 1040) } };
  };

  /* ================================================================== Dupont wire */
  const WIRE = { red: '#d42a2a', black: '#222326', yellow: '#f1c40f', green: '#22a04a', blue: '#2a62d4', orange: '#f07a12',
    white: '#efefea', purple: '#8a3fc2', violet: '#8a3fc2', grey: '#8d8f94', gray: '#8d8f94', brown: '#7b3a16' };
  function dupont(parent, a, b, col, o) {
    const w = o.width || 8;
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len, ny = dx / len;
    if (ny > 0 || (ny === 0 && nx > 0)) { nx = -nx; ny = -ny; } // arch upward (screen)
    const lift = o.lift ?? Math.min(220, len * 0.25);
    const ends = Array.isArray(o.ends) ? o.ends : [o.ends || 'male', o.ends || 'male'];
    const HL = 90; // Dupont housing, drawn shorter than the real 14 mm so it does not read as a black bar at lesson scale
    const c1 = { x: a.x + dx * 0.15 + nx * lift, y: a.y + dy * 0.15 + ny * lift };
    const c2 = { x: a.x + dx * 0.85 + nx * lift, y: a.y + dy * 0.85 + ny * lift };
    const g = el('g', { class: 'kit-wire', filter: 'url(#kit-shadow-lo)' }, parent);
    const along = (p, q, d) => { const L = Math.hypot(q.x - p.x, q.y - p.y) || 1; return { x: p.x + (q.x - p.x) / L * d, y: p.y + (q.y - p.y) / L * d }; };
    const sA = ends[0] === 'male' || ends[0] === 'female' ? along(a, c1, Math.min(HL, len / 3)) : a;
    const sB = ends[1] === 'male' || ends[1] === 'female' ? along(b, c2, Math.min(HL, len / 3)) : b;
    const d = `M${f1(sA.x)} ${f1(sA.y)}C${f1(c1.x)} ${f1(c1.y)} ${f1(c2.x)} ${f1(c2.y)} ${f1(sB.x)} ${f1(sB.y)}`;
    path(g, d, 'none', { stroke: shade(col.startsWith('#') ? col : '#888888', -0.35), 'stroke-width': w + 1.6, 'stroke-linecap': 'round', opacity: 0.85 });
    const p = path(g, d, 'none', { stroke: col, 'stroke-width': w, 'stroke-linecap': 'round', class: 'kit-wire-core' });
    path(g, d, 'none', { stroke: '#fff', 'stroke-width': w * 0.22, 'stroke-linecap': 'round', opacity: 0.3, transform: `translate(${f1(-w * 0.16)} ${f1(-w * 0.16)})` });
    const housing = (tip, from, kind) => {
      if (kind === 'banana') { circ(g, tip.x, tip.y, w * 2.4, shade(col.startsWith('#') ? col : '#888888', -0.2)); circ(g, tip.x, tip.y, w * 1.2, '#222'); return; }
      if (kind !== 'male' && kind !== 'female') return;
      const ang = Math.atan2(from.y - tip.y, from.x - tip.x) * 180 / Math.PI;
      const hg = g_(g, { transform: `translate(${f1(tip.x)} ${f1(tip.y)}) rotate(${f1(ang)})` });
      // short jumpers: the housing never gets a negative width
      const hl = Math.min(HL, len / 3);
      if (hl > 8) rect(hg, 6, -9, hl - 6, 18, '#26262a', { rx: 3 });
      if (hl > 16) rect(hg, 10, -6, hl - 14, 3, '#47474d', { rx: 1.5 });
      if (kind === 'male') rect(hg, -2, -3, 10, 6, lin('kit-gold'));
    };
    housing(a, c1, ends[0]); housing(b, c2, ends[1]);
    g.path = p;
    g.pins = { a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } };
    return g;
  }
  // Default look = the course's own breadboard drawings (esp32-s3-bright-module/docs/breadboard.svg): a flat, thin, single-colour
  // wire that leaves each hole straight up (control points above the ends), with a small ring where it enters the hole —
  // no housings, outline or shadow. opts.style 'dupont' keeps the photo-like jumper with black housings; ends 'banana' = meter leads.
  function wire(parent, a, b, colour = 'red', o = {}) {
    ensureDefs();
    const col = WIRE[colour] || colour;
    const ends = Array.isArray(o.ends) ? o.ends : [o.ends || 'ring', o.ends || 'ring'];
    if (o.style === 'dupont') return dupont(parent, a, b, col, o);
    const w = o.width || 6;
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len, ny = dx / len;
    if (ny > 0 || (ny === 0 && nx > 0)) { nx = -nx; ny = -ny; } // arch upward (screen)
    const lift = o.lift ?? Math.max(15, Math.min(160, len * 0.15));
    const c1 = { x: a.x + nx * lift, y: a.y + ny * lift }, c2 = { x: b.x + nx * lift, y: b.y + ny * lift };
    const g = el('g', { class: ends.includes('banana') ? 'kit-wire kit-lead' : 'kit-wire' }, parent);
    const d = `M${f1(a.x)} ${f1(a.y)}C${f1(c1.x)} ${f1(c1.y)} ${f1(c2.x)} ${f1(c2.y)} ${f1(b.x)} ${f1(b.y)}`;
    const p = path(g, d, 'none', { stroke: col, 'stroke-width': w, 'stroke-linecap': 'round', class: 'kit-wire-core' });
    const end = (tip, kind) => {
      if (kind === 'banana') { circ(g, tip.x, tip.y, w * 2.4, shade(col.startsWith('#') ? col : '#888888', -0.2)); circ(g, tip.x, tip.y, w * 1.2, '#222'); return; }
      if (kind === 'none') return;
      circ(g, tip.x, tip.y, w * 0.72, '#e4e4e0', { stroke: col, 'stroke-width': w * 0.34 });
    };
    end(a, ends[0]); end(b, ends[1]);
    g.path = p;
    g.pins = { a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } };
    return g;
  }

  /* ------------------------------------------------------------------ orthogonal jumper (the tidy breadboard style)
     Kit.route(parent, points, colour, opts) → a flat wire through the given points (parent coords, e.g. bb.at('j18')) made of
     straight segments joined by rounded corners — the way a careful builder lays flat jumpers along the hole grid. Consecutive
     points should differ in x OR y only (a diagonal step is drawn straight but reported by tools/site-check/wires.mjs).
     opts: width (6), r (corner radius, default 0.45 pitch), ends ('ring' | 'none' | [a, b]). Returns <g class="kit-wire"> with .path. */
  function route(parent, pts, colour = 'red', o = {}) {
    ensureDefs();
    const col = WIRE[colour] || colour, w = o.width || 6, R = o.r ?? P * 0.45;
    const q = pts.map((p) => ({ x: p.x, y: p.y })).filter((p, i, a) => !i || Math.hypot(p.x - a[i - 1].x, p.y - a[i - 1].y) > 0.01);
    let d = `M${f1(q[0].x)} ${f1(q[0].y)}`;
    for (let i = 1; i < q.length; i++) {
      const p = q[i];
      if (i < q.length - 1) {
        const a = q[i - 1], n = q[i + 1];
        const l1 = Math.hypot(p.x - a.x, p.y - a.y), l2 = Math.hypot(n.x - p.x, n.y - p.y), r = Math.min(R, l1 / 2, l2 / 2);
        const s1 = { x: p.x - (p.x - a.x) / l1 * r, y: p.y - (p.y - a.y) / l1 * r }, s2 = { x: p.x + (n.x - p.x) / l2 * r, y: p.y + (n.y - p.y) / l2 * r };
        d += `L${f1(s1.x)} ${f1(s1.y)}Q${f1(p.x)} ${f1(p.y)} ${f1(s2.x)} ${f1(s2.y)}`;
      } else d += `L${f1(p.x)} ${f1(p.y)}`;
    }
    const g = el('g', { class: 'kit-wire kit-route' }, parent);
    const pth = path(g, d, 'none', { stroke: col, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'kit-wire-core' });
    const ends = Array.isArray(o.ends) ? o.ends : [o.ends || 'ring', o.ends || 'ring'];
    [[q[0], ends[0]], [q[q.length - 1], ends[1]]].forEach(([t, k]) => { if (k !== 'none') circ(g, t.x, t.y, w * 0.72, '#e4e4e0', { stroke: col, 'stroke-width': w * 0.34 }); });
    g.path = pth;
    g.pins = { a: { ...q[0] }, b: { ...q[q.length - 1] } };
    return g;
  }

  /* ------------------------------------------------------------------ svg helpers */
  function svg(host, viewBox, label) {
    const s = el('svg', { viewBox, role: label ? 'img' : null, 'aria-label': label, xmlns: NS }, host);
    s.style.display = 'block'; s.style.width = '100%'; s.style.height = 'auto';
    return s;
  }
  function fit(s, pad = 20) {
    const b = s.getBBox();
    s.setAttribute('viewBox', `${f1(b.x - pad)} ${f1(b.y - pad)} ${f1(b.width + 2 * pad)} ${f1(b.height + 2 * pad)}`);
    return s;
  }

  /* ================================================================== viewer: «⤢ Роздивитися» on every drawing with kit parts
     A button in the corner of each such <svg> opens a large view of a snapshot of the drawing: wheel / pinch / + − to zoom,
     drag to pan, click a part to zoom onto it and read what it is. The page's own clicks on parts stay untouched. */
  const INFO = {
    esp32s3: ['Плата YD-ESP32-S3 N16R8', 'ESP32-S3-WROOM-1: 16 МБ flash, 8 МБ PSRAM, логіка 3,3 В. Два USB-C: COM (через CH343) і USB (нативний). Кнопки RST і BOOT, RGB-світлодіод на GPIO48.'],
    breadboard: ['Макетна плата WB-102', '830 отворів, крок 2,54 мм. П\'ять отворів у рядку a–e (і f–j) з\'єднані між собою; шини + і − тягнуться вздовж краю.'],
    led: ['Світлодіод 5 мм', 'Довга ніжка — анод (+), коротка й пласкій бік корпусу — катод (−). Завжди через резистор.'],
    resistor: ['Резистор 0,5 Вт', 'Номінал читають за кольоровими смужками; смужка допуску (золота) — праворуч.'],
    ldr: ['Фоторезистор (LDR)', 'Що більше світла, то менший опір. Працює в подільнику напруги з постійним резистором.'],
    button: ['Тактова кнопка 6×6 мм', 'Чотири ніжки: попарно з\'єднані завжди, а натискання з\'єднує пари. Ставлять через канавку макетки.'],
    npn: ['Транзистор NPN (TO-92)', 'BC547B: виводи C-B-E, 2N2222: E-B-C (дивлячись на пласку сторону). Ключ на «мінусі» для реле й мотора.'],
    pnp: ['Транзистор PNP BC557B (TO-92)', 'Ключ на «плюсі»; керується низьким рівнем на базі.'],
    diode: ['Діод 1N4007', 'Смужка — катод. Захист від переполюсовки і від викиду котушки (flyback).'],
    'cap-ceramic': ['Керамічний конденсатор', '103 = 10 нФ, 104 = 100 нФ. Без полярності; ставлять біля живлення мікросхем.'],
    'cap-electrolytic': ['Електролітичний конденсатор 100 мкФ', 'Полярний: смужка на корпусі — мінус, довга ніжка — плюс. Запас енергії для мотора.'],
    pot: ['Потенціометр 10/20 кОм', 'Крайні виводи — на 3,3 В і GND, середній (повзунок) — на вхід АЦП.'],
    'relay-module': ['Модуль реле 5 В', 'Входи VCC, GND, IN; контакти NC, COM, NO. Червоний LED — живлення, зелений — котушка ввімкнена.'],
    'tt-motor': ['Мотор-редуктор TT', 'Жовтий редуктор, 3–6 В. Старт бере сотні міліампер, тож лише через транзисторний ключ, з діодом.'],
    multimeter: ['Мультиметр UNI-T UT136C+', 'Напруга — гнізда VΩmA і COM паралельно; струм до 400 мА — VΩmA у розрив кола; 10A — окреме гніздо.'],
    'logic-analyzer': ['Логічний аналізатор 8 каналів, 24 МГц', 'CH1–CH8 і GND до схеми, USB до ноутбука; дивимося фронти, брязкіт, UART, I²C, SPI.'],
    'power-module': ['Модуль живлення MB102', 'Вставляють у шини макетки; перемичками для кожної пари шин вибирають 5 В або 3,3 В.'],
    probe: ['Щуп мультиметра', 'Червоний — у VΩmA (або 10A), чорний — завжди в COM.'],
    wire: ['Перемичка Dupont', 'Дріт із контактами «тато» на кінцях: з\'єднує отвори макетки й виводи плати.'],
  };
  let vw = null;
  function viewerCSS() {
    if (document.getElementById('kit-viewer-css')) return;
    const st = document.createElement('style');
    st.id = 'kit-viewer-css';
    st.textContent = `
.kit-zoom-host { position: relative; }
.kit-zoom { position: absolute; top: 6px; right: 6px; z-index: 3; display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; padding: 0;
  border: 1px solid var(--line-strong, #8c7d68); border-radius: 999px; background: color-mix(in srgb, var(--panel, #fff) 88%, transparent);
  color: var(--ink, #222); font: 600 13px/1 var(--f-body, system-ui); cursor: zoom-in; backdrop-filter: blur(4px); box-shadow: 0 2px 8px -4px rgba(0,0,0,.35); }
.kit-zoom:hover { border-color: var(--accent, #17634d); }
@media (pointer: coarse) { .kit-zoom { width: 44px; height: 44px; } }
.kit-viewer { width: min(1400px, 100vw - 16px); height: min(940px, 100dvh - 16px); max-width: none; max-height: none; padding: 0; border: 1px solid var(--line, #ddd);
  border-radius: 16px; background: var(--panel, #fff); color: var(--ink, #222); box-shadow: 0 30px 80px -20px rgba(0,0,0,.6); overflow: hidden; }
.kit-viewer::backdrop { background: rgba(10, 8, 6, .62); }
.kit-viewer[open] { display: grid; grid-template-rows: auto 1fr auto; }
.kv-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 14px; border-bottom: 1px solid var(--line, #ddd); }
.kv-bar b { font: 600 13px var(--f-mono, monospace); letter-spacing: .06em; text-transform: uppercase; color: var(--copper, #a3461f); }
.kv-bar .kv-hint { flex: 1; min-width: 12em; font-size: 14px; color: var(--muted, #666); }
.kv-bar button { min-width: 40px; min-height: 40px; padding: 0 12px; border: 1px solid var(--line-strong, #8c7d68); border-radius: 10px;
  background: var(--panel, #fff); color: var(--ink, #222); font: 600 16px/1 var(--f-body, system-ui); cursor: pointer; }
.kv-bar button:hover { border-color: var(--accent, #17634d); }
.kv-stage { position: relative; overflow: hidden; background: var(--sheet, #fffefb); touch-action: none; cursor: grab; }
.kv-stage.drag { cursor: grabbing; }
.kv-stage > svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.kv-stage .kit-part { cursor: pointer; }
.kv-stage .kit-part.kv-sel { filter: drop-shadow(0 0 6px var(--accent, #17634d)) drop-shadow(0 0 2px var(--accent, #17634d)); }
.kv-info { min-height: 3.2em; margin: 0; padding: 10px 16px 12px; border-top: 1px solid var(--line, #ddd); font-size: 15px; line-height: 1.5; }
.kv-info b { font-family: var(--f-display, serif); font-size: 17px; }`;
    document.head.appendChild(st);
  }
  function buildViewer() {
    if (vw) return vw;
    viewerCSS();
    const dlg = document.createElement('dialog');
    dlg.className = 'kit-viewer';
    dlg.setAttribute('aria-label', 'Збільшений малюнок');
    dlg.innerHTML = `<div class="kv-bar"><b>Роздивитися</b><span class="kv-hint">Колесо або два пальці — масштаб, тягніть — рух, клацніть деталь — що це.</span>
      <button type="button" data-z="out" aria-label="Зменшити">−</button><button type="button" data-z="in" aria-label="Збільшити">+</button>
      <button type="button" data-z="fit">Усе</button><button type="button" data-z="close" aria-label="Закрити">✕</button></div>
      <div class="kv-stage"></div><p class="kv-info" aria-live="polite">Клацніть будь-яку деталь, щоб наблизити її й прочитати, що це.</p>`;
    document.body.appendChild(dlg);
    const stage = dlg.querySelector('.kv-stage'), info = dlg.querySelector('.kv-info');
    const S = { svg: null, vb: null, home: null };
    const setVB = (b) => { S.vb = b; S.svg.setAttribute('viewBox', `${b.x} ${b.y} ${b.w} ${b.h}`); };
    const zoomAt = (k, cx, cy) => {       // k > 1 zooms in, about the svg point (cx, cy)
      const b = S.vb, w = Math.min(S.home.w * 4, Math.max(S.home.w / 40, b.w / k)), f = w / b.w;
      setVB({ x: cx - (cx - b.x) * f, y: cy - (cy - b.y) * f, w, h: b.h * f });
    };
    const toSvg = (ev) => { const r = stage.getBoundingClientRect(), b = S.vb, s = Math.max(b.w / r.width, b.h / r.height);
      const ox = b.x + b.w / 2 - (r.width * s) / 2, oy = b.y + b.h / 2 - (r.height * s) / 2;
      return { x: ox + (ev.clientX - r.left) * s, y: oy + (ev.clientY - r.top) * s, s }; };
    const centre = () => ({ x: S.vb.x + S.vb.w / 2, y: S.vb.y + S.vb.h / 2 });
    dlg.querySelector('.kv-bar').addEventListener('click', (e) => {
      const z = e.target.closest('button') && e.target.closest('button').dataset.z; if (!z || !S.svg) return;
      if (z === 'close') dlg.close();
      else if (z === 'fit') { setVB(S.home); select(null); }
      else { const c = centre(); zoomAt(z === 'in' ? 1.5 : 1 / 1.5, c.x, c.y); }
    });
    stage.addEventListener('wheel', (e) => { if (!S.svg) return; e.preventDefault(); const p = toSvg(e); zoomAt(e.deltaY < 0 ? 1.18 : 1 / 1.18, p.x, p.y); }, { passive: false });
    const pts = new Map(); let moved = 0, pinch = 0;
    stage.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, e); moved = 0; stage.classList.add('drag'); try { stage.setPointerCapture(e.pointerId); } catch { /* synthetic */ } });
    stage.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId) || !S.svg) return;
      const prev = pts.get(e.pointerId); pts.set(e.pointerId, e);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (pinch) { const m = toSvg({ clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 }); zoomAt(d / pinch, m.x, m.y); }
        pinch = d; moved += 10; return;
      }
      const s = toSvg(e).s, dx = (e.clientX - prev.clientX) * s, dy = (e.clientY - prev.clientY) * s;
      moved += Math.abs(dx / s) + Math.abs(dy / s);
      setVB({ ...S.vb, x: S.vb.x - dx, y: S.vb.y - dy });
    });
    const up = (e) => {
      const wasTap = pts.size === 1 && moved < 6;
      pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; if (!pts.size) stage.classList.remove('drag');
      if (wasTap && e.type === 'pointerup') {
        // the page's own hit areas may lie over the parts: take the first kit part under the pointer
        const part = document.elementsFromPoint(e.clientX, e.clientY).map((t) => t.closest && t.closest('.kv-stage .kit-part, .kv-stage .kit-wire')).find(Boolean);
        if (part) select(part, true);
      }
    };
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    dlg.addEventListener('keydown', (e) => {
      if (!S.svg) return; const c = centre();
      if (e.key === '+' || e.key === '=') zoomAt(1.4, c.x, c.y);
      else if (e.key === '-') zoomAt(1 / 1.4, c.x, c.y);
      else if (e.key === '0') setVB(S.home);
      else if (/^Arrow/.test(e.key)) { const k = S.vb.w * 0.1; setVB({ ...S.vb, x: S.vb.x + (e.key === 'ArrowRight' ? k : e.key === 'ArrowLeft' ? -k : 0), y: S.vb.y + (e.key === 'ArrowDown' ? k : e.key === 'ArrowUp' ? -k : 0) }); }
      else return;
      e.preventDefault();
    });
    function select(part, zoom) {
      stage.querySelectorAll('.kv-sel').forEach((x) => x.classList.remove('kv-sel'));
      if (!part) { info.innerHTML = 'Клацніть будь-яку деталь, щоб наблизити її й прочитати, що це.'; return; }
      part.classList.add('kv-sel');
      const key = part.classList.contains('kit-wire') ? 'wire' : part.getAttribute('data-kit');
      const [name, text] = INFO[key] || [key, ''];
      const t = part.getAttribute('data-title') || (part.querySelector(':scope > title') || {}).textContent || '';
      info.innerHTML = `<b>${name}</b>${t && t !== name ? ` · ${t.replace(/[<&]/g, '')}` : ''}<br>${text}`;
      if (zoom) {
        try {
          const bb = part.getBBox(), m = part.getCTM(), r = S.svg.getScreenCTM();
          const rel = r && m ? r.inverse().multiply(m) : null;
          const p1 = rel ? new DOMPoint(bb.x, bb.y).matrixTransform(rel) : { x: bb.x, y: bb.y };
          const p2 = rel ? new DOMPoint(bb.x + bb.width, bb.y + bb.height).matrixTransform(rel) : { x: bb.x + bb.width, y: bb.y + bb.height };
          const x = Math.min(p1.x, p2.x), y = Math.min(p1.y, p2.y), w = Math.abs(p2.x - p1.x), h = Math.abs(p2.y - p1.y), pad = Math.max(w, h) * 0.35;
          setVB({ x: x - pad, y: y - pad, w: w + pad * 2, h: h + pad * 2 });
        } catch { /* keep the view */ }
      }
    }
    vw = {
      open(src, label) {
        stage.textContent = '';
        const c = src.cloneNode(true);
        c.removeAttribute('width'); c.removeAttribute('height'); c.removeAttribute('style'); c.removeAttribute('class');
        c.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id')); // the page keeps the ids (gradients live in Kit's shared defs)
        c.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        stage.appendChild(c); S.svg = c;
        const vb = (src.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
        let home;
        if (vb.length === 4 && vb.every(Number.isFinite)) home = { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
        else { const b = src.getBBox(); home = { x: b.x, y: b.y, w: b.width || 100, h: b.height || 100 }; }
        S.home = home; setVB(home); select(null);
        dlg.querySelector('.kv-bar b').textContent = label || 'Роздивитися';
        dlg.showModal();
      },
    };
    return vw;
  }
  function attachZoom(svgEl) {
    if (svgEl.__kitZoom || svgEl.closest('.kit-viewer') || svgEl.getAttribute('aria-hidden') === 'true') return;
    const r = svgEl.getBoundingClientRect(); if (r.width && r.width < 120) return;
    svgEl.__kitZoom = true;
    viewerCSS();
    const host = svgEl.parentElement; if (!host) return;
    if (getComputedStyle(host).position === 'static') host.classList.add('kit-zoom-host');
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'kit-zoom'; b.innerHTML = '<span aria-hidden="true">⤢</span>'; b.title = 'Роздивитися збільшеним';
    const label = svgEl.getAttribute('aria-label') || '';
    b.setAttribute('aria-label', 'Роздивитися малюнок збільшеним' + (label ? ': ' + label.slice(0, 80) : ''));
    b.addEventListener('click', (e) => { e.stopPropagation(); buildViewer().open(svgEl, 'Роздивитися'); });
    host.appendChild(b);
  }
  let scanT = 0;
  function scan() {
    scanT = 0;
    document.querySelectorAll('svg').forEach((s) => { if (!s.__kitZoom && s.querySelector(':scope .kit-part')) attachZoom(s); });
  }
  const queueScan = () => { if (!scanT) scanT = setTimeout(scan, 250); };
  if (typeof MutationObserver === 'function') {
    const start = () => { queueScan(); new MutationObserver(queueScan).observe(document.body, { childList: true, subtree: true }); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
  }

  window.Kit = { P, MM, part, wire, route, svg, fit, bands, COLORS, names: Object.keys(PARTS), LED_COLORS: Object.keys(LED), INFO, view: (s, l) => buildViewer().open(s, l), version: 1 };
})();
