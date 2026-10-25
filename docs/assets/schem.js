// schem.js: schematic and breadboard helpers for the study site (design brief §3.5). Defines window.Schem.
//
// Classic script, load with `defer` after study.js. It does not need study.js (it only borrows Study.fmt when
// present). On DOMContentLoaded, after Study's boot and its `study:ready` handlers, it:
//   - inlines assets/symbols.svg once when the page has use[href^="#"] or [data-sprite] (so <use href="#res"> works),
//   - links every figure.dual[data-nets] and [data-schem-link] (net highlighting in both views).
//
// Symbols: write <use href="#res" x=".." y=".."/> (preferred; needs this script) — the external form
// <use href="../../assets/symbols.svg#res"/> also works over http, but not from file://. Do not give page elements
// ids that the sprite uses (res, led, cap, btn, sw, gnd, vcc, dot, …); see the list at the top of symbols.svg.
//
// Drawing classes (injected CSS, use them in hand-written SVG):
//   .sch-w      wire: no fill, 2,5 stroke, round caps; colour from a .net-* class (study.css) or --ink
//   .sch-sym    a <use> symbol in ink colour (put .net-* on it instead to colour it by net)
//   .sch-ref    designator text «R1»;  .sch-val value text «220 Ом»;  .sch-pin pin/net label (mono)
(() => {
  'use strict';
  const doc = document;
  const NS = 'http://www.w3.org/2000/svg';
  const self = doc.currentScript || doc.querySelector('script[src*="assets/schem.js"]');
  const SPRITE_URL = new URL('symbols.svg', self ? self.src : location.href).href;
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const $$ = (sel, scope = doc) => Array.from(scope.querySelectorAll(sel));

  /* ================================================================ small DOM helpers */
  // svg('path', {d: 'M0 0H10', class: 'sch-w'}, parent) → the new SVG element.
  function svg(tag, attrs = {}, parent = null) {
    const el = doc.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) el.setAttribute(k, v);
    if (parent) parent.appendChild(el);
    return el;
  }
  // use(parent, 'res', x, y, rot = 0, attrs) → <use href="#res"> placed with its pin 1 at (x, y).
  function use(parent, id, x, y, rot = 0, attrs = {}) {
    const a = { href: '#' + id, x, y, class: 'sch-sym', ...attrs };
    if (rot) a.transform = `rotate(${rot} ${x} ${y})`;
    return svg('use', a, parent);
  }

  /* ================================================================ injected CSS */
  // Kept here (not in study.css) so the kit is self-contained; every colour comes from the page tokens.
  const STYLE = `
.sch-w { fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
.sch-w:not([class*="net-"]) { stroke: var(--ink); }
.sch-sym { color: var(--ink); }
.sch-ref { fill: var(--ink); font: 600 14px var(--f-body, sans-serif); }
.sch-val { fill: var(--muted); font: 500 13px var(--f-mono, monospace); }
.sch-pin { fill: var(--muted); font: 500 13px var(--f-mono, monospace); }
text[class*="net-"].sch-pin, text[class*="net-"].sch-ref { fill: currentColor; }
/* labels use the *-ink companions (SPEC 3.3: wire ≠ label; amber and orange wires are too light for text) */
text.net-5v:is(.sch-pin, .sch-ref) { fill: var(--n5-ink, var(--n5)); }
text.net-3v3:is(.sch-pin, .sch-ref) { fill: var(--n33-ink, var(--n33)); }
text.net-gnd:is(.sch-pin, .sch-ref) { fill: var(--ngnd-ink, var(--ngnd)); }
text.net-sig:is(.sch-pin, .sch-ref) { fill: var(--nsig-ink, var(--nsig)); }
text.net-sig2:is(.sch-pin, .sch-ref) { fill: var(--nsig2-ink, var(--nsig2)); }
text.net-sig3:is(.sch-pin, .sch-ref) { fill: var(--nsig3-ink, var(--nsig3)); }
.schem-linked [data-net] { cursor: pointer; }
.schem-hit { fill: none !important; stroke: transparent !important; stroke-width: 14px !important; pointer-events: stroke; }
.nets-focus .schem-hit { opacity: 1 !important; }
.net-legend { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 0; padding: 0; }
.net-legend .nl-k { font: 600 13px var(--f-mono, monospace); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin-right: 2px; }
.net-btn {
  display: inline-flex; align-items: center; gap: 8px; min-height: 36px; padding: 4px 12px; cursor: pointer;
  border: 1px solid var(--line); border-radius: 999px; background: var(--panel); color: var(--ink);
  font: 600 14px var(--f-mono, monospace);
}
.net-btn:hover { border-color: var(--accent); }
.net-btn[aria-pressed="true"] { border-color: currentColor; box-shadow: inset 0 0 0 1px var(--accent); }
.net-btn .sw { width: 18px; height: 4px; border-radius: 2px; background: currentColor; flex: none; }
.net-btn .sw:not([class*="net-"]) { color: var(--ink); }
.schem-flow { fill: none; stroke: var(--flow); stroke-width: 3.5; stroke-linecap: round; stroke-dasharray: 2 10;
  pointer-events: none; animation: schem-flow var(--flow-dur, 1s) linear infinite; }
.schem-flow.rev { animation-direction: reverse; }
.schem-flow-arrow { fill: var(--flow); pointer-events: none; }
@keyframes schem-flow { to { stroke-dashoffset: -12; } }
[data-level="z"]:not(text):not(g) { stroke-dasharray: 6 5; }
[data-level="hi"]:not(text):not(g) { stroke-width: 3.5; }
.schem-lvl { pointer-events: none; }
.schem-lvl rect { fill: var(--sheet, var(--panel)); stroke: var(--ink); stroke-width: 1.2; }
.schem-lvl[data-level="lo"] rect { stroke-dasharray: 3 2; }
.schem-lvl text { fill: var(--ink); font: 700 13px var(--f-mono, monospace); letter-spacing: .02em; }
.net-btn .nl-lvl { margin-left: 2px; padding: 0 6px; border: 1.2px solid var(--ink); border-radius: 4px; color: var(--ink);
  font: 700 13px/1.35 var(--f-mono, monospace); }
.net-btn .nl-lvl[data-level="lo"] { border-style: dashed; }
.bb-board { fill: var(--bb, var(--panel-2)); stroke: var(--bb-edge, var(--line)); stroke-width: 1.5; }
.bb-channel { fill: color-mix(in srgb, var(--ink) 8%, var(--bb, var(--panel-2))); }
.bb-hole { fill: var(--hole, color-mix(in srgb, var(--ink) 55%, var(--panel-2))); transition: fill .12s; }
.bb-strip > .bb-hit { fill: transparent; }
.bb-strip:hover .bb-hole, .bb-strip:focus-visible .bb-hole { fill: var(--accent); }
.bb-strip[data-net]:hover .bb-hole, .bb-strip.net-on .bb-hole { fill: currentColor; }
.bb-strip:focus { outline: none; }
.bb-rail-p { stroke: var(--rail-p, var(--n5)); stroke-width: 2; }
.bb-rail-n { stroke: var(--rail-n, var(--nsig2)); stroke-width: 2; }
.bb-lbl { fill: var(--muted); font: 500 12px var(--f-mono, monospace); }
.bb-wire { fill: none; stroke-width: 4.5; stroke-linecap: round; stroke-linejoin: round; }
.bb-wire:not([class*="net-"]) { stroke: var(--muted); }
.bb-end { fill: var(--panel); stroke: currentColor; stroke-width: 1.5; }
.bb-lead { fill: none; stroke: var(--lead, #8d979e); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.bb-part-lbl { fill: var(--ink); font: 600 13px var(--f-body, sans-serif); paint-order: stroke; stroke: var(--bb, var(--panel-2)); stroke-width: 4px; stroke-linejoin: round; stroke-linecap: round; }
.bb-leader { fill: none; stroke: var(--muted); stroke-width: 1; stroke-linecap: round; }
.bb-btn-body { fill: #3b4249; stroke: #20262b; }
.bb-btn-cap { fill: #15191c; stroke: #59626a; }
.bb-btn-link { stroke: var(--accent); stroke-width: 1.5; stroke-dasharray: 3 3; fill: none; }
@media (prefers-reduced-motion: reduce) { .schem-flow { animation: none; } }
`;
  function injectCSS() {
    if (doc.getElementById('schem-css')) return;
    const st = doc.createElement('style');
    st.id = 'schem-css';
    st.textContent = STYLE;
    // First in <head>, so page styles can override the kit.
    doc.head.insertBefore(st, doc.head.firstChild);
  }
  injectCSS();

  /* ================================================================ sprite */
  let spritePromise = null;
  const refreshUses = (scope = doc) => $$('use', scope).forEach((u) => {
    const href = u.getAttribute('href') || u.getAttribute('xlink:href');
    if (href && href[0] === '#') u.setAttribute('href', href);
  });
  // Fetches symbols.svg once and puts it (hidden) at the start of <body>, so <use href="#res"> resolves.
  // Resolves with the injected <svg>. If the fetch fails (file://), local #ids are rewritten to the external URL.
  function inlineSprite(url = SPRITE_URL) {
    const have = doc.getElementById('schem-sprite');
    if (have) return Promise.resolve(have);
    if (spritePromise) return spritePromise;
    spritePromise = fetch(url)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then((txt) => {
        const parsed = new DOMParser().parseFromString(txt, 'image/svg+xml').documentElement;
        if (!parsed || parsed.nodeName !== 'svg') throw new Error('symbols.svg is not an SVG document');
        const sp = doc.importNode(parsed, true);
        sp.id = 'schem-sprite';
        sp.setAttribute('aria-hidden', 'true');
        sp.setAttribute('focusable', 'false');
        sp.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
        $$('symbol[id]', sp).forEach((s) => {
          const clash = doc.getElementById(s.id);
          if (clash) console.warn(`Schem: page element #${s.id} clashes with the symbol id; rename it.`);
        });
        doc.body.prepend(sp);
        refreshUses();
        return sp;
      })
      .catch((e) => {
        console.warn('Schem.inlineSprite: could not load symbols.svg, using external references.', e.message);
        $$('use').forEach((u) => {
          const href = u.getAttribute('href');
          if (href && href[0] === '#' && !doc.getElementById(href.slice(1))) u.setAttribute('href', url + href);
        });
        spritePromise = null;
        return null;
      });
    return spritePromise;
  }

  /* ================================================================ net linking */
  const NET_NAMES = { '5v': '+5 В', '3v3': '3V3', gnd: 'GND' };
  const netClass = (el) => Array.from(el.classList || []).find((c) => /^net-/.test(c) && c !== 'net-on') || '';
  const isGeom = (el) => /^(path|line|polyline|polygon)$/.test(el.localName);

  // Labels from figure[data-nets="5v=+5 В; led_a=Анод LED"], then data-net-label on any element, then defaults.
  function netLabels(fig) {
    const map = {};
    String(fig.dataset.nets || '').split(';').forEach((pair) => {
      const i = pair.indexOf('=');
      if (i > 0) map[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
    });
    $$('[data-net-label]', fig).forEach((el) => { if (!map[el.dataset.net]) map[el.dataset.net] = el.dataset.netLabel; });
    return (net) => map[net] || NET_NAMES[net] || net.toUpperCase();
  }

  // Hover / focus / tap on any [data-net] (or its legend button) highlights that net in every view of the figure.
  // Click or tap pins the highlight; Esc or a second click clears it. Call again after drawing more parts.
  function link(fig, { legend = true } = {}) {
    if (!fig) return null;
    const st = fig._schem || (fig._schem = { pinned: null, hover: null });
    fig.classList.add('schem-linked');
    $$('.schem-hit', fig).forEach((e) => e.remove());
    // Wide invisible strokes make thin wires easy to hover and tap.
    $$('[data-net]', fig).filter((el) => isGeom(el) && !el.closest('.net-legend') && !el.closest('.bb-strip')).forEach((el) => {
      const hit = el.cloneNode(false);
      hit.removeAttribute('id');
      hit.setAttribute('class', 'schem-hit');
      hit.setAttribute('aria-hidden', 'true');
      el.after(hit);
    });
    const els = () => $$('[data-net]', fig).filter((el) => !el.closest('.net-legend'));
    const nets = [];
    els().forEach((el) => { if (!nets.includes(el.dataset.net)) nets.push(el.dataset.net); });
    const label = netLabels(fig);

    const show = () => {
      const net = st.hover || st.pinned;
      fig.classList.toggle('nets-focus', !!net);
      els().forEach((el) => el.classList.toggle('net-on', el.dataset.net === net));
      $$('.net-btn', fig).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.for === st.pinned)));
      const live = fig.querySelector('.net-live');
      if (live) live.textContent = net ? `Виділено вузол ${label(net)}` : '';
    };
    st.show = show;
    st.set = (net) => { st.pinned = net || null; st.hover = null; show(); fig.dispatchEvent(new CustomEvent('netchange', { detail: { net: st.pinned }, bubbles: true })); };

    if (legend) {
      let box = fig.querySelector(':scope > .net-legend');
      if (!box) {
        box = doc.createElement('div');
        box.className = 'net-legend';
        box.setAttribute('role', 'group');
        box.setAttribute('aria-label', 'Вузли схеми: натисніть, щоб виділити');
        const cap = fig.querySelector(':scope > figcaption');
        cap ? fig.insertBefore(box, cap) : fig.appendChild(box);
      }
      box.innerHTML = '<span class="nl-k">Вузли</span><span class="net-live sr-only" aria-live="polite"></span>';
      nets.forEach((net) => {
        const first = els().find((el) => el.dataset.net === net && netClass(el)) || null;
        const b = doc.createElement('button');
        b.type = 'button';
        b.className = 'net-btn';
        b.dataset.for = net;
        b.setAttribute('aria-pressed', 'false');
        b.innerHTML = `<span class="sw ${first ? netClass(first) : ''}"></span>`;
        b.append(label(net));
        // link() may run again after setNetLevel (more parts drawn): keep the level tag.
        const lv = els().find((el) => el.dataset.net === net && el.dataset.level);
        if (lv) legendLevel(b, lv.dataset.level);
        b.addEventListener('click', () => st.set(st.pinned === net ? null : net));
        b.addEventListener('focus', () => { st.hover = net; show(); });
        b.addEventListener('blur', () => { st.hover = null; show(); });
        box.appendChild(b);
      });
    }

    if (!st.wired) {
      st.wired = true;
      const target = (e) => {
        const el = e.target.closest && e.target.closest('[data-net]');
        return el && fig.contains(el) && !el.closest('.net-legend') ? el.dataset.net : null;
      };
      fig.addEventListener('pointerover', (e) => {
        if (e.pointerType === 'touch') return;
        const net = target(e);
        if (net !== st.hover) { st.hover = net; show(); }
      });
      fig.addEventListener('pointerleave', () => { if (st.hover) { st.hover = null; show(); } });
      fig.addEventListener('click', (e) => {
        if (e.target.closest('.net-legend, button, a, input')) return;
        const net = target(e);
        st.set(net && st.pinned !== net ? net : null);
      });
      fig.addEventListener('keydown', (e) => { if (e.key === 'Escape' && st.pinned) { st.set(null); } });
      doc.addEventListener('keydown', (e) => { if (e.key === 'Escape' && st.pinned) st.set(null); });
    }
    show();
    return { nets, set: st.set, clear: () => st.set(null) };
  }

  /* ================================================================ current flow */
  const FLOW_K = 4; // user units per second per mA: the same current gives the same dot speed on every wire
  // Animated dots along a wire; mA = 0 hides them. Reduced motion → one static arrow in the middle of the wire.
  function flow(pathEl, { mA = 0, dir = 1, k = FLOW_K } = {}) {
    if (!pathEl) return null;
    if (pathEl._flow) { pathEl._flow.set(mA, dir); return pathEl._flow; }
    const ov = pathEl.cloneNode(false);
    ['id', 'data-net', 'data-level', 'style'].forEach((a) => ov.removeAttribute(a));
    ov.setAttribute('class', 'schem-flow');
    ov.setAttribute('aria-hidden', 'true');
    const arrow = svg('path', { class: 'schem-flow-arrow', d: 'M5 0L-4 -5V5Z', 'aria-hidden': 'true' });
    pathEl.after(ov, arrow);
    let cur = { mA, dir };
    const render = () => {
      const on = Math.abs(cur.mA) > 1e-6;
      const still = mqReduce.matches;
      ov.style.display = on && !still ? '' : 'none';
      arrow.style.display = on && still ? '' : 'none';
      if (!on) return;
      const d = (cur.dir < 0) !== (cur.mA < 0) ? -1 : 1;
      ov.classList.toggle('rev', d < 0);
      ov.style.setProperty('--flow-dur', (12 / Math.max(1, k * Math.abs(cur.mA))).toFixed(3) + 's');
      if (still && typeof pathEl.getTotalLength === 'function') {
        const L = pathEl.getTotalLength();
        const p = pathEl.getPointAtLength(L / 2), q = pathEl.getPointAtLength(Math.min(L, L / 2 + 1));
        const ang = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI + (d < 0 ? 180 : 0);
        arrow.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${ang})`);
      }
    };
    const onMotion = () => render();
    mqReduce.addEventListener('change', onMotion);
    const ctl = {
      set(m, dr = cur.dir) { cur = { mA: m, dir: dr }; render(); return ctl; },
      get mA() { return cur.mA; },
      remove() { ov.remove(); arrow.remove(); mqReduce.removeEventListener('change', onMotion); delete pathEl._flow; },
    };
    pathEl._flow = ctl;
    render();
    return ctl;
  }

  /* ================================================================ logic levels */
  const LEVEL_TEXT = { hi: 'HIGH', lo: 'LOW', z: 'Hi-Z' };
  const levelText = (el, level) => {
    const map = {};
    (el.dataset.levelLabel || '').split('|').forEach((p) => { const [k, v] = p.split(':'); if (v) map[k.trim()] = v.trim(); });
    return level ? (map[level] || LEVEL_TEXT[level] || level) : (map.none || el.dataset.levelDefault || '');
  };
  // Does the box (in the user space of `host`) touch any drawn line, symbol or text of the view? Lines are probed
  // with isPointInStroke, so an L-shaped wire does not block its whole bounding box; a box drawn fully inside a
  // rect (a chip outline) is fine, crossing its edge is not. Returns null when the view is hidden (no CTM).
  function boxHits(view, host, box, skip) {
    const hc = host.getScreenCTM && host.getScreenCTM();
    if (!hc || !host.getBoundingClientRect().width) return null;
    const inv = hc.inverse(), P = (x, y) => Object.assign(view.createSVGPoint(), { x, y });
    const xs = [], ys = [];
    for (let x = box.x - 2; x <= box.x + box.w + 2; x += 3) xs.push(x);
    for (let y = box.y - 2; y <= box.y + box.h + 2; y += 3) ys.push(y);
    return $$('path, line, polyline, polygon, rect, circle, use, text', view).some((el) => {
      if (skip.some((k) => k === el || k.contains(el)) || el.closest('.schem-hit, .schem-flow, .schem-flow-arrow, defs, symbol')) return false;
      const sc = el.getScreenCTM && el.getScreenCTM();
      if (!sc) return false;
      const m = inv.multiply(sc), mi = m.inverse();
      if (el.localName === 'text' || el.localName === 'use' || el.localName === 'circle') {
        let bb; try { bb = el.getBBox(); } catch { return false; }
        if (!bb.width) return false;
        const p1 = P(bb.x, bb.y).matrixTransform(m), p2 = P(bb.x + bb.width, bb.y + bb.height).matrixTransform(m);
        const x0 = Math.min(p1.x, p2.x), x1 = Math.max(p1.x, p2.x), y0 = Math.min(p1.y, p2.y), y1 = Math.max(p1.y, p2.y);
        return x0 < box.x + box.w + 2 && x1 > box.x - 2 && y0 < box.y + box.h + 2 && y1 > box.y - 2;
      }
      if (typeof el.isPointInStroke !== 'function') return false;
      return xs.some((x) => ys.some((y) => el.isPointInStroke(P(x, y).matrixTransform(mi))));
    });
  }
  // An ink «HIGH / LOW / Hi-Z» tag by the net's first text label in a schematic view: above it, else below it, else
  // beside it, whichever slot is clear of the drawing. The tag has one fixed width, so it never jumps between levels.
  function levelBadge(view, net, level) {
    const sel = `[data-net="${CSS.escape(net)}"]`;
    let b = view.querySelector(`.schem-lvl[data-for="${CSS.escape(net)}"]`);
    if (!level || view.querySelector(`[data-level-label]${sel}`)) { if (b) b.remove(); return; }
    const a = $$(`text${sel}`, view).find((t) => !t.closest('.schem-lvl'));
    if (!a) return;
    if (!b) {
      b = svg('g', { class: 'schem-lvl', 'data-for': net, 'aria-hidden': 'true' });
      svg('rect', { rx: 3 }, b);
      svg('text', { 'text-anchor': 'middle' }, b);
      a.parentNode.appendChild(b);
    }
    const [r, t] = b.children;
    if (b.dataset.placed !== '1') {
      // Mono 13 px ≈ 7,8 units a glyph; sizes come from attributes, so this also works while the view is hidden.
      const x = +a.getAttribute('x') || 0, y = +a.getAttribute('y') || 0, anc = a.getAttribute('text-anchor') || 'start';
      const lw = a.textContent.length * 7.8, w = 4 * 7.8 + 10, h = 17;
      const lx = anc === 'end' ? x - lw : anc === 'middle' ? x - lw / 2 : x;
      const ax = anc === 'end' ? x - w : anc === 'middle' ? x - w / 2 : x;
      const vb = view.viewBox && view.viewBox.baseVal && view.viewBox.baseVal.width ? view.viewBox.baseVal : null;
      const fit = (c) => (vb && a.parentNode === view
        ? { x: Math.max(vb.x + 1, Math.min(c.x, vb.x + vb.width - w - 1)), y: Math.max(vb.y + 1, Math.min(c.y, vb.y + vb.height - h - 1)), w, h }
        : { ...c, w, h });
      const slots = [{ x: ax, y: y - 14 - h }, { x: ax, y: y + 6 }, { x: lx - w - 6, y: y - 12.5 }, { x: lx + lw + 6, y: y - 12.5 }].map(fit);
      let pick = slots[0], known = true;
      for (const c of slots) {
        const hit = boxHits(view, a.parentNode, c, [b, a]);
        if (hit === null) { known = false; break; }
        if (!hit) { pick = c; break; }
      }
      ['x', 'y', 'width', 'height'].forEach((k) => r.setAttribute(k, pick[k[0]]));
      t.setAttribute('x', pick.x + w / 2);
      t.setAttribute('y', pick.y + h - 4.5);
      if (known) b.dataset.placed = '1';
    }
    b.dataset.level = level;
    t.textContent = LEVEL_TEXT[level] || level;
    fitBadge(b);
  }
  // Sizes the tag's frame from the measured text (the widest of HIGH / LOW / Hi-Z and the current word, so the frame
  // never jumps between levels): 7 units clear at each end of the rx 3 corners. Grows around its centre and only
  // ever grows; a hidden view measures 0 and keeps the estimate until it is shown or the web fonts arrive.
  function fitBadge(b) {
    const [r, t] = b.children;
    if (!r || !t || !t.getComputedTextLength) return;
    const cur = t.textContent;
    let tw = 0;
    try {
      for (const s of new Set([...Object.values(LEVEL_TEXT), cur])) { t.textContent = s; tw = Math.max(tw, t.getComputedTextLength()); }
    } catch { tw = 0; }
    t.textContent = cur;
    if (!tw) return;
    const w = +r.getAttribute('width') || 0, need = Math.ceil(tw + 14);
    if (need > w) {
      const cx = (+r.getAttribute('x') || 0) + w / 2;
      r.setAttribute('x', cx - need / 2);
      r.setAttribute('width', need);
    }
    // Height: the glyph box (ascent + descent of the mono font) plus 2 units above and below; its middle is the
    // middle of the capitals, so the word stays centred.
    let bb; try { bb = t.getBBox(); } catch { return; }
    const y = +r.getAttribute('y') || 0, h = +r.getAttribute('height') || 0;
    if (bb.height && (bb.y - 2 < y || bb.y + bb.height + 2 > y + h)) {
      r.setAttribute('y', +(bb.y - 2).toFixed(1));
      r.setAttribute('height', Math.ceil(bb.height + 4));
    }
  }
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => $$('.schem-lvl').forEach(fitBadge));
  function legendLevel(btn, level) {
    let tag = btn.querySelector('.nl-lvl');
    if (!level) { if (tag) tag.remove(); return; }
    if (!tag) { tag = doc.createElement('span'); tag.className = 'nl-lvl'; btn.appendChild(tag); }
    tag.dataset.level = level;
    tag.textContent = LEVEL_TEXT[level] || level;
  }
  // Marks one net with a logic level (hi / lo / z) without changing its colour, because the net colour already
  // means «which net» (SPEC 3.3): a thicker line for HIGH, a dashed one for Hi-Z, an ink «HIGH / LOW / Hi-Z» tag by
  // the net's label in each schematic view and in its legend button, and any [data-level-label] text on that net
  // («HIGH», «LOW», «Hi-Z», or the author's map "hi:3,3 В|lo:0 В"). level = null clears it.
  function setNetLevel(fig, net, level) {
    if (!fig) return;
    const sel = `[data-net="${CSS.escape(net)}"]`;
    $$(sel, fig).filter((el) => !el.closest('.net-legend') && !el.classList.contains('schem-hit')).forEach((el) => {
      if (level) el.dataset.level = level; else delete el.dataset.level;
      if (el.hasAttribute('data-level-label')) el.textContent = levelText(el, level);
    });
    // Breadboard views carry the tag only in the legend: their small pin labels sit inside the board art.
    $$('svg', fig).filter((v) => !v.closest('.net-legend') && !v.querySelector('.bb-board') && v.querySelector(`text${sel}`))
      .forEach((v) => levelBadge(v, net, level));
    $$(`.net-btn[data-for="${CSS.escape(net)}"]`, fig).forEach((btn) => legendLevel(btn, level));
    fig.dispatchEvent(new CustomEvent('netlevel', { detail: { net, level }, bubbles: true }));
  }

  /* ================================================================ breadboard (MB-102 geometry) */
  // 830-point MB-102: 63 columns × rows a–e / f–j (630) + 4 power rails of 50 holes (200). Pitch 2,54 mm = 10 units.
  // Rail holes come in groups of 5 with a one-hole gap, as on the real board.
  const ROWS = 'abcdefghij';
  const BB = { ox: 26, rowA: 56, rowF: 126, railTop: [16, 26], railBot: [196, 206], h: 222 };
  const rowY = (r) => { const i = ROWS.indexOf(String(r).toLowerCase()); return i < 5 ? BB.rowA + i * 10 : BB.rowF + (i - 5) * 10; };

  // colLabels: 'both' | 'top' | 'bottom' | false (column numbers every 5).
  function breadboard(host, { cols = 30, rails = true, split = false, x = 0, y = 0, labels = true, colLabels = 'both' } = {}) {
    cols = Math.max(5, Math.min(63, cols | 0));
    const W = BB.ox * 2 + (cols - 1) * 10;
    const H = rails ? BB.h : BB.h - 64;
    const dy = rails ? 0 : -32; // without rails the strips move up
    const g = svg('g', { class: 'bb', transform: `translate(${x} ${y})` }, host);
    svg('title', {}, g).textContent = `Макетна плата: ${cols} стовпчиків, рядки a–e і f–j${rails ? ', шини живлення' : ''}`;
    svg('rect', { class: 'bb-board', x: 0, y: 0, width: W, height: H, rx: 6 }, g);
    svg('rect', { class: 'bb-channel', x: 6, y: BB.rowA + 40 + 5 + dy, width: W - 12, height: 20, rx: 3 }, g);
    const colX = (c) => BB.ox + (c - 1) * 10;
    const strips = new Map(), railEls = new Map(), colNums = [];

    const hole = (gp, cx, cy) => svg('rect', { class: 'bb-hole', x: cx - 2.6, y: cy - 2.6, width: 5.2, height: 5.2, rx: 1 }, gp);
    const stripGroup = (key, title, pts) => {
      const sg = svg('g', { class: 'bb-strip', 'data-strip': key }, g);
      svg('title', {}, sg).textContent = title;
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      svg('rect', { class: 'bb-hit', x: Math.min(...xs) - 5, y: Math.min(...ys) - 5, width: Math.max(...xs) - Math.min(...xs) + 10, height: Math.max(...ys) - Math.min(...ys) + 10 }, sg);
      pts.forEach((p) => hole(sg, p.x, p.y));
      return sg;
    };

    for (let c = 1; c <= cols; c++) {
      for (const side of ['top', 'bottom']) {
        const rows = side === 'top' ? 'abcde' : 'fghij';
        const pts = rows.split('').map((r) => ({ x: colX(c), y: rowY(r) + dy }));
        strips.set(`${c}-${side}`, stripGroup(`${c}-${side}`, `Стовпчик ${c}, рядки ${rows[0]}–${rows[4]}: одна смужка, 5 отворів з'єднані`, pts));
      }
    }
    if (labels) {
      'abcdefghij'.split('').forEach((r) => {
        for (const lx of [10, W - 10]) {
          // 0,8 × pitch, inline so a page-level .bb-lbl size bump cannot make neighbouring letters touch.
          svg('text', { class: 'bb-lbl bb-row', x: lx, y: rowY(r) + dy + 2.8, 'text-anchor': 'middle', 'aria-hidden': 'true', style: 'font-size: 8px' }, g).textContent = r;
        }
      });
      for (let c = 1; c <= cols; c++) {
        if ((c !== 1 && c % 5) || !colLabels) continue;
        const num = (ny) => { const t = svg('text', { class: 'bb-lbl bb-col', x: colX(c), y: ny, 'text-anchor': 'middle', 'aria-hidden': 'true' }, g); t.textContent = c; colNums.push(t); };
        if (colLabels !== 'bottom') num(BB.rowA - 8 + dy);
        if (colLabels !== 'top') num(BB.rowF + 40 + 15 + dy);
      }
    }

    // Rails: top = «+» outer (red line above), «−» inner; bottom = «+» inner, «−» outer (blue line below).
    const railCols = [];
    for (let c = 1; c <= cols; c++) if ((c - 1) % 6 !== 5) railCols.push(c);
    const RY = { top: { '+': BB.railTop[0], '-': BB.railTop[1] }, bottom: { '+': BB.railBot[0], '-': BB.railBot[1] } };
    if (rails) {
      const mid = colX(Math.ceil(cols / 2)) + 5;
      for (const side of ['top', 'bottom']) {
        const lineY = side === 'top' ? { '+': 7, '-': 35 } : { '+': 187, '-': 215 };
        for (const sign of ['+', '-']) {
          const ly = lineY[sign], cls = sign === '+' ? 'bb-rail-p' : 'bb-rail-n';
          if (split) {
            svg('path', { class: cls, d: `M12 ${ly}H${mid - 8}M${mid + 8} ${ly}H${W - 12}` }, g);
          } else svg('path', { class: cls, d: `M12 ${ly}H${W - 12}` }, g);
          if (labels) {
            svg('text', { class: 'bb-lbl', x: 10, y: RY[side][sign] + 3.5, 'text-anchor': 'middle', 'aria-hidden': 'true' }, g).textContent = sign === '+' ? '+' : '−';
          }
          const halves = split ? [railCols.filter((c) => colX(c) < mid), railCols.filter((c) => colX(c) > mid)] : [railCols];
          halves.forEach((cs, i) => {
            const key = `${side}${sign}${split ? (i ? 'R' : 'L') : ''}`;
            const nm = sign === '+' ? 'плюс' : 'мінус';
            const t = `Шина живлення ${side === 'top' ? 'вгорі' : 'внизу'}, ${nm}${split ? (i ? ', права половина' : ', ліва половина') : ''}: усі отвори з'єднані`;
            railEls.set(key, stripGroup(key, t, cs.map((c) => ({ x: colX(c), y: RY[side][sign] }))));
          });
        }
      }
    }

    const abs = (p) => ({ x: p.x + x, y: p.y + y });
    // Free bands for part labels (absolute y of the text's top and baseline): the gutter between the top rail and
    // row a, the centre channel, and the gutter between row j and the bottom rail. part() picks the nearest one.
    const band = (base) => ({ top: y + base - 10, base: y + base });
    const info = {
      x, y, W, H, g, colNums, labels: [],
      rows: [y + rowY('a') + dy - 4, y + rowY('j') + dy + 4],
      lanes: [band(BB.rowA - 7 + dy), band(BB.rowA + 59.5 + dy), band(BB.rowF + 40 + 16 + dy)],
      gap: (px) => x + BB.ox + 5 + Math.round((px - x - BB.ox - 5) / 10) * 10, // nearest x between two columns
    };
    if (!boards.has(host)) boards.set(host, []);
    boards.get(host).push(info);
    const api = {
      g, width: W, height: H, cols,
      hole: (col, row) => abs({ x: colX(col), y: rowY(row) + dy }),
      strip: (col, side) => (side === 'top' ? 'abcde' : 'fghij').split('').map((r) => api.hole(col, r)),
      railY: (side, sign) => y + RY[side][sign === '−' ? '-' : sign],
      // Nearest rail hole to column `col` (rail holes skip every sixth column).
      rail: (side, sign, col) => {
        const c = railCols.reduce((b, k) => (Math.abs(k - col) < Math.abs(b - col) ? k : b), railCols[0]);
        return abs({ x: colX(c), y: RY[side][sign === '−' ? '-' : sign] });
      },
      stripEl: (col, side) => strips.get(`${col}-${side}`) || null,
      railEl: (side, sign, half = '') => railEls.get(`${side}${sign === '−' ? '-' : sign}${half}`) || null,
    };
    // Tag a strip / rail with data-net + a .net-* class so Schem.link highlights it with the wires.
    // mark(col, side, net, cls); markRail(side, sign, net, cls, half = '' | 'L' | 'R' when split).
    api.mark = (col, side, net, cls = '') => tag(api.stripEl(col, side), net, cls);
    api.markRail = (side, sign, net, cls = '', half = '') => tag(api.railEl(side, sign, half), net, cls);
    function tag(el, net, cls) {
      if (!el) return null;
      el.dataset.net = net;
      if (cls) el.classList.add(cls);
      return el;
    }
    return api;
  }

  /* ================================================================ breadboard parts */
  const BAND_HEX = {
    black: '#1b1b1b', brown: '#7a4a24', red: '#d0312d', orange: '#f07c0c', yellow: '#f6c915', green: '#2f8a3b',
    blue: '#1f62c4', violet: '#7d3fb0', grey: '#8c8f92', white: '#f4f4f4', gold: '#c9a032', silver: '#b8bec4',
  };
  const LED_HEX = { red: '#e5392f', green: '#2fb84a', blue: '#2f6fe5', yellow: '#f2c21b', white: '#eef2f5', orange: '#f28a1e' };
  const angleOf = (a, b) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;

  // Part labels on a breadboard go into a hole-free band (top gutter, centre channel, bottom gutter), next to the
  // part or with a short leader line, and never over holes; column numbers under a label or part are dropped.
  // box = the part's extent {x0, x1, y0, y1}; at = preferred {x, anchor}; old() = the off-board placement.
  const boards = new WeakMap();
  const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  function partLabel(host, layer, parent, text, box, at, old) {
    const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
    const b = (boards.get(host) || []).find((k) => cx >= k.x && cx <= k.x + k.W && cy >= k.y && cy <= k.y + k.H);
    if (!b || box.y1 < b.rows[0] || box.y0 > b.rows[1]) return old(); // off the board or on a rail
    const t = svg('text', { class: 'bb-part-lbl', 'text-anchor': 'start' }, parent);
    t.textContent = text;
    let w = 0;
    try { w = t.getComputedTextLength(); } catch { /* not rendered */ }
    if (!(w > 0)) w = text.length * 7.8;
    const dist = (ln) => (box.y1 <= ln.top ? ln.top - box.y1 : box.y0 >= ln.base ? box.y0 - ln.base : 0);
    const lane = b.lanes.reduce((m, ln) => (dist(ln) < dist(m) ? ln : m));
    const ty = { y0: lane.top, y1: lane.base + 1 };
    // Alternative layers (bug / fix) may repeat a label in place, so only same-layer or board-level labels collide.
    const others = b.labels.filter((o) => o.layer === layer || o.layer === host || layer === host).map((o) => o.box);
    if (box.y0 < ty.y1 && box.y1 > ty.y0) others.push({ x0: box.x0 - 2, x1: box.x1 + 2, ...ty });
    let x0 = at.anchor === 'middle' ? at.x - w / 2 : at.x;
    const lo = b.x + 18, hi = b.x + b.W - 18 - w;
    for (let i = 0; i < 8; i++) {
      const hit = others.find((o) => overlaps({ x0: x0 - 3, x1: x0 + w + 3, ...ty }, o));
      if (!hit) break;
      x0 = hit.x1 + 4 > hi ? hit.x0 - 4 - w : hit.x1 + 4;
    }
    x0 = Math.max(lo, Math.min(hi, x0));
    const lb = { x0, x1: x0 + w, ...ty };
    t.setAttribute('x', x0);
    t.setAttribute('y', lane.base);
    b.labels.push({ box: lb, layer });
    // Leader when the label does not touch the part: from the label edge to the part, between two columns.
    const gapX = Math.max(box.x0 - lb.x1, lb.x0 - box.x1, 0), gapY = dist(lane);
    if (gapX > 10 || gapY > 9) {
      const lx = Math.max(lb.x0 + 3, Math.min(lb.x1 - 3, cx));
      const px = gapX > 10 ? Math.max(box.x0, Math.min(box.x1, lx)) : b.gap(lx);
      const ly = box.y1 <= ty.y0 ? ty.y0 - 1 : box.y0 >= ty.y1 ? ty.y1 + 1 : (ty.y0 + ty.y1) / 2;
      const py = box.y1 <= ty.y0 ? box.y1 : box.y0 >= ty.y1 ? box.y0 : cy;
      const lxx = gapX > 10 && gapY <= 9 ? (lb.x1 < box.x0 ? lb.x1 + 2 : lb.x0 - 2) : (gapY > 9 ? px : lx);
      parent.insertBefore(svg('path', { class: 'bb-leader', d: `M${lxx} ${ly}L${px} ${py}` }), t);
    }
    // Column numbers under this label or under the part itself are dropped.
    b.colNums.forEach((n) => {
      const nx = +n.getAttribute('x') + b.x, ny = +n.getAttribute('y') + b.y;
      const nb = { x0: nx - 11, x1: nx + 11, y0: ny - 9, y1: ny + 1 };
      if (overlaps(nb, lb) || overlaps(nb, box)) n.setAttribute('visibility', 'hidden');
    });
    return t;
  }

  // part(svg, 'res', {from, to, ohms, bands = 4, label})
  // part(svg, 'led', {anode, cathode, color = 'red', label, h = 26})  long bent leg = anode; h = dome height above legs
  // part(svg, 'btn4', {x, y, w = 30, h = 30, label, pressed})   pins: (x,y) (x+w,y) (x,y+h) (x+w,y+h);
  //                                                              (x,y)–(x,y+h) and (x+w,y)–(x+w,y+h) are joined inside
  // part(svg, 'jumper', {from, to, net, cls, lift = 18})       arc wire; net/cls feed Schem.link
  // Returns the part's <g> (the jumper returns its <path>).
  function part(host, kind, o = {}) {
    const parent = o.parent || host;
    if (kind === 'jumper' || kind === 'wire') {
      const a = o.from, b = o.to, lift = o.lift ?? 18;
      const mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - lift;
      const d = lift ? `M${a.x} ${a.y}Q${mx} ${my} ${b.x} ${b.y}` : `M${a.x} ${a.y}L${b.x} ${b.y}`;
      const g = svg('g', { class: 'bb-jumper' }, parent);
      const p = svg('path', { class: `bb-wire ${o.cls || ''}`.trim(), d, 'data-net': o.net }, g);
      for (const e of [a, b]) svg('circle', { class: `bb-end ${o.cls || ''}`.trim(), cx: e.x, cy: e.y, r: 3.2, 'data-net': o.net }, g);
      if (o.title) svg('title', {}, g).textContent = o.title;
      return p;
    }
    if (kind === 'res') {
      const a = o.from, b = o.to, bands = colorBands(o.ohms, o.bands || 4);
      const g = svg('g', { class: 'bb-res' }, parent);
      svg('title', {}, g).textContent = `Резистор ${o.label || ''} ${fmtOhm(o.ohms)}: смужки ${bands.map((n) => BAND_UK[n]).join(', ')}`.replace(/\s+/g, ' ');
      svg('path', { class: 'bb-lead', d: `M${a.x} ${a.y}L${b.x} ${b.y}` }, g);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const body = svg('g', { transform: `translate(${mx} ${my}) rotate(${angleOf(a, b)})` }, g);
      svg('rect', { x: -17, y: -6, width: 34, height: 12, rx: 5, fill: '#dcc394', stroke: '#9c855a', 'stroke-width': 1 }, body);
      const xs = bands.length === 5 ? [-11, -6.5, -2, 2.5, 11] : [-10, -5, 0, 10];
      bands.forEach((n, i) => svg('rect', { x: xs[i] - 1.6, y: -6, width: 3.2, height: 12, fill: BAND_HEX[n], stroke: 'rgba(0,0,0,.35)', 'stroke-width': .5 }, body));
      for (const e of [a, b]) svg('circle', { cx: e.x, cy: e.y, r: 2, fill: '#6f7980' }, g);
      if (o.label) {
        const box = { x0: Math.min(a.x, b.x) - 4, x1: Math.max(a.x, b.x) + 4, y0: Math.min(a.y, b.y) - 6, y1: Math.max(a.y, b.y) + 6 };
        partLabel(host, parent, g, o.label, box, { x: mx, anchor: 'middle' },
          () => { svg('text', { class: 'bb-part-lbl', x: mx, y: my - 11, 'text-anchor': 'middle' }, g).textContent = o.label; });
      }
      return g;
    }
    if (kind === 'led') {
      const A = o.anode, K = o.cathode, col = LED_HEX[o.color] || o.color || LED_HEX.red;
      const g = svg('g', { class: 'bb-led' }, parent);
      svg('title', {}, g).textContent = `Світлодіод ${o.label || ''}: довга (зігнута) ніжка — анод +, коротка — катод −`.replace(/\s+/g, ' ');
      const cx = (A.x + K.x) / 2, top = Math.min(A.y, K.y) - (o.h || 26);
      // Anode leg bent (longer), cathode straight.
      svg('path', { class: 'bb-lead', d: `M${A.x} ${A.y}V${top + 16}L${cx - 3} ${top + 10}V${top + 6}` }, g);
      svg('path', { class: 'bb-lead', d: `M${K.x} ${K.y}V${top + 10}L${cx + 3} ${top + 6}` }, g);
      // Dome with the flat edge on the cathode side.
      svg('path', { d: `M${cx + 8} ${top + 7}V${top - 4}A8 8 0 1 0 ${cx - 8} ${top - 4}V${top + 7}Z`, fill: col, 'fill-opacity': .88, stroke: 'rgba(0,0,0,.45)', 'stroke-width': 1 }, g);
      svg('rect', { x: cx - 10, y: top + 5, width: 18, height: 4, rx: 1, fill: col, stroke: 'rgba(0,0,0,.45)', 'stroke-width': 1 }, g);
      for (const e of [A, K]) svg('circle', { cx: e.x, cy: e.y, r: 2, fill: '#6f7980' }, g);
      if (o.label) {
        const box = { x0: Math.min(cx - 10, A.x, K.x) - 2, x1: Math.max(cx + 10, A.x, K.x) + 2, y0: top - 12, y1: Math.max(A.y, K.y) + 2 };
        partLabel(host, parent, g, o.label, box, { x: cx + 12, anchor: 'start' },
          () => { svg('text', { class: 'bb-part-lbl', x: cx + 12, y: top - 4 }, g).textContent = o.label; });
      }
      return g;
    }
    if (kind === 'btn4') {
      const { x, y } = o, w = o.w || 30, h = o.h || 30;
      const g = svg('g', { class: 'bb-btn4' }, parent);
      svg('title', {}, g).textContent = `Тактова кнопка ${o.label || ''}: ліві ніжки з'єднані між собою завжди, праві теж; натискання з'єднує ліву пару з правою`.replace(/\s+/g, ' ');
      for (const [px, py] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) svg('circle', { cx: px, cy: py, r: 2, fill: '#6f7980' }, g);
      svg('rect', { class: 'bb-btn-body', x: x - 5, y: y + 2, width: w + 10, height: h - 4, rx: 3 }, g);
      svg('circle', { class: 'bb-btn-cap', cx: x + w / 2, cy: y + h / 2, r: Math.min(w, h) / 3.2 }, g);
      svg('path', { class: 'bb-btn-link', d: `M${x} ${y + 4}V${y + h - 4}M${x + w} ${y + 4}V${y + h - 4}${o.pressed ? `M${x} ${y + h / 2}H${x + w}` : ''}` }, g);
      if (o.label) {
        partLabel(host, parent, g, o.label, { x0: x - 5, x1: x + w + 5, y0: y - 2, y1: y + h + 2 }, { x: x + w / 2, anchor: 'middle' },
          () => { svg('text', { class: 'bb-part-lbl', x: x + w / 2, y: y - 6, 'text-anchor': 'middle' }, g).textContent = o.label; });
      }
      return g;
    }
    throw new Error(`Schem.part: unknown kind «${kind}»`);
  }

  /* ================================================================ values: colour code, E-series, notation */
  const DIGIT_COLORS = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white'];
  const BAND_UK = {
    black: 'чорний', brown: 'коричневий', red: 'червоний', orange: 'помаранчевий', yellow: 'жовтий', green: 'зелений',
    blue: 'синій', violet: 'фіолетовий', grey: 'сірий', white: 'білий', gold: 'золотий', silver: 'срібний', none: 'немає',
  };
  const TOL = { brown: 1, red: 2, green: 0.5, blue: 0.25, violet: 0.1, grey: 0.05, gold: 5, silver: 10, none: 20 };

  // colorBands(4700) → ['yellow','violet','red','gold'] (IEC 60062). bands = 4 (2 digits, ±5 % gold) or
  // 5 (3 digits, ±1 % brown). The value is rounded to 2 / 3 significant digits. 0 Ω → ['black']; [] if not encodable.
  function colorBands(ohms, bands = 4) {
    ohms = +ohms;
    if (!Number.isFinite(ohms) || ohms < 0) return [];
    if (ohms === 0) return ['black'];
    const n = bands >= 5 ? 3 : 2;
    let exp = Math.floor(Math.log10(ohms) + 1e-9) - (n - 1);
    let sig = Math.round(ohms / 10 ** exp);
    if (sig >= 10 ** n) { sig = Math.round(sig / 10); exp++; }
    if (exp < -2 || exp > 9) return [];
    const digits = String(sig).padStart(n, '0').split('').map((d) => DIGIT_COLORS[+d]);
    const mult = exp === -1 ? 'gold' : exp === -2 ? 'silver' : DIGIT_COLORS[exp];
    return [...digits, mult, n === 3 ? 'brown' : 'gold'];
  }
  // fromBands(['yellow','violet','red','gold']) → { ohms: 4700, tol: 5 }; 3 bands = ±20 %. null if invalid.
  function fromBands(names) {
    if (!Array.isArray(names) || names.length < 3 || names.length > 6) return null;
    if (names.length === 6) names = names.slice(0, 5);
    const n = names.length === 5 ? 3 : 2;
    const digits = names.slice(0, n).map((c) => DIGIT_COLORS.indexOf(c));
    if (digits.some((d) => d < 0)) return null;
    const m = names[n], exp = m === 'gold' ? -1 : m === 'silver' ? -2 : DIGIT_COLORS.indexOf(m);
    if (exp < -2 || (exp < 0 && m !== 'gold' && m !== 'silver')) return null;
    const tolName = names.length === 3 ? 'none' : names[n + 1];
    if (!(tolName in TOL)) return null;
    const ohms = +(+digits.join('') * 10 ** exp).toPrecision(6);
    return { ohms, tol: TOL[tolName] };
  }

  const E12 = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];
  const E24 = [10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91];
  // eSeries(130) → 150 (nearest value not below x); mode 'near' → closest by ratio. series: 12 or 24.
  function eSeries(x, { mode = 'up', series = 12 } = {}) {
    if (!(x > 0)) return NaN;
    const list = series === 24 ? E24 : E12;
    const dec = 10 ** (Math.floor(Math.log10(x) + 1e-9) - 1);
    const cands = [...list.map((v) => v * dec), list[0] * dec * 10, list[list.length - 1] * dec / 10];
    const fix = (v) => +v.toPrecision(3);
    if (mode === 'near') return fix(cands.reduce((b, v) => (Math.abs(Math.log(v / x)) < Math.abs(Math.log(b / x)) ? v : b)));
    return fix(cands.filter((v) => v >= x * (1 - 1e-9)).reduce((b, v) => Math.min(b, v), Infinity));
  }

  const fmtSI = (v, unit) => (window.Study && Study.fmt ? Study.fmt.si(v, unit, 3) : `${v} ${unit}`);
  const fmtOhm = (v) => (Number.isFinite(+v) ? fmtSI(+v, 'Ом') : '');
  const fmtNum = (v) => (window.Study && Study.fmt ? Study.fmt.num(v, 3) : String(v).replace('.', ','));
  const SUP = (e) => String(e).replace(/-/g, '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);

  // RKM letters (IEC 60062): the letter is the decimal point and the multiplier at once.
  const RKM = {
    R: [1, 'res'], r: [1, 'res'], k: [1e3, 'res'], K: [1e3, 'res'], M: [1e6, 'res'], G: [1e9, 'res'],
    m: [1e-3, 'res'], u: [1e-6, 'cap'], 'µ': [1e-6, 'cap'], 'μ': [1e-6, 'cap'], n: [1e-9, 'cap'], p: [1e-12, 'cap'],
    'к': [1e3, 'res'], 'М': [1e6, 'res'], 'мк': [1e-6, 'cap'], 'н': [1e-9, 'cap'], 'п': [1e-12, 'cap'],
  };
  const PREF_NAME = { 1: '', 1e3: 'кіло', 1e6: 'мега', 1e9: 'гіга', 1e-3: 'мілі', 1e-6: 'мікро', 1e-9: 'нано', 1e-12: 'піко' };

  // decode('4k7') → [{ kind: 'res', value: 4700, unit: 'Ом', text: '4,7 кОм', how: '…' }]
  // kind: 'auto' | 'res' | 'cap'. A bare 3-digit code is ambiguous, so 'auto' returns both readings.
  function decode(str, kind = 'auto') {
    const s = String(str ?? '').trim().replace(/\s+/g, '').replace(/Ω|ом|Ом|ohm/gi, '');
    const out = [];
    const add = (k, value, how) => {
      const unit = k === 'res' ? 'Ом' : 'Ф';
      out.push({ kind: k, value, unit, text: fmtSI(value, unit), how });
    };
    if (!s) return out;
    // 1) RKM: 4k7, 2R2, R47, 470R, 1M, 100n, 4n7, 10u, 2µ2, 4,7к
    let m = s.match(/^(\d*)(мк|[RrkKMGmuµμnpкМнп])(\d*)$/);
    if (m && (m[1] || m[3])) {
      const [f, k0] = RKM[m[2]];
      const k = kind === 'auto' ? k0 : kind;
      const num = parseFloat(`${m[1] || '0'}.${m[3] || '0'}`);
      const letter = m[2];
      const role = f === 1 ? '«R» стоїть на місці коми, множник ×1' : `«${letter}» стоїть на місці коми і означає ${PREF_NAME[f]} (×${f >= 1 ? fmtNum(f) : '10' + SUP(Math.round(Math.log10(f)))})`;
      let how = `${m[1] || '0'}${m[3] ? ',' + m[3] : ''} → ${role}`;
      if (letter === 'm' && k === 'res') how += '. Увага: мала «m» — мілі; для мегаом пишуть велику «M»';
      add(k, num * f * (k === 'cap' && f >= 1 ? 1e-12 : 1), how);
      return out;
    }
    // 2) Plain number with an optional unit: «4,7 кОм», «100 нФ», «0,1 мкФ», «220».
    if (/^[\d.,]+([a-zа-яµμ]*)$/i.test(s) && !/^\d{3,4}$/.test(s)) {
      const v = window.Study ? Study.parseNum(s.replace(/ф$/i, '')) : parseFloat(s.replace(',', '.'));
      if (Number.isFinite(v)) {
        const k = /ф|f$/i.test(s) ? 'cap' : kind === 'auto' ? 'res' : kind;
        add(k, k === 'cap' && !/[a-zа-яµμ]/i.test(s.replace(/ф$/i, '')) ? v * 1e-12 : v, 'звичайний запис числом');
        return out;
      }
    }
    // 3) Numeric codes: 472 (2 digits + zeros), 4701 (3 digits + zeros), 104 for capacitors in pF.
    m = s.match(/^(\d{2,3})(\d)$/);
    if (m) {
      const sig = +m[1], zeros = +m[2];
      if (s.length === 4 && kind !== 'cap') {
        add('res', sig * 10 ** zeros, `чотири цифри: ${m[1]} і ще ${zeros} нул${zeros === 1 ? 'ь' : 'і'} → ${m[1]} × 10${SUP(zeros)} Ом (точні резистори 1 %)`);
        return out;
      }
      if (s.length === 3) {
        if (kind !== 'cap') add('res', sig * 10 ** zeros, `SMD-резистор: ${m[1]} і ще ${zeros} нул${zeros === 1 ? 'ь' : 'і'} → ${m[1]} × 10${SUP(zeros)} Ом`);
        if (kind !== 'res') add('cap', sig * 10 ** zeros * 1e-12, `конденсатор: ${m[1]} × 10${SUP(zeros)} пФ (код завжди в пікофарадах)`);
        return out;
      }
    }
    if (/^\d{1,2}$/.test(s)) {
      if (kind !== 'cap') add('res', +s, 'одна-дві цифри — це саме значення');
      if (kind !== 'res') add('cap', +s * 1e-12, 'на конденсаторі одна-дві цифри — значення в пікофарадах');
      return out;
    }
    if (/^0+$/.test(s)) add('res', 0, '«0» або «000» — перемичка 0 Ом');
    return out;
  }

  /* ================================================================ boot */
  function autoRun() {
    if (doc.querySelector('[data-sprite], use[href^="#"]')) inlineSprite();
    $$('figure.dual[data-nets], [data-schem-link]').forEach((f) => { try { link(f); } catch (e) { console.error('Schem.link:', e); } });
  }
  const Schem = {
    SPRITE_URL, inlineSprite, link, flow, setNetLevel, breadboard, part, colorBands, fromBands, eSeries, decode,
    svg, use, E12, E24, BAND_HEX, BAND_UK, TOL,
  };
  window.Schem = Schem;
  // Run after Study's study:ready handlers (pages draw breadboards there), or on DOMContentLoaded without study.js.
  // readyState is already 'interactive' while deferred scripts run, so ask the navigation timing instead.
  const dclFired = () => {
    const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    return nav ? nav.domContentLoadedEventStart > 0 : doc.readyState === 'complete';
  };
  const start = () => { if (window.Study && !Study.isReady) Study.ready(autoRun); else autoRun(); };
  if (doc.readyState === 'loading' || !dclFired()) doc.addEventListener('DOMContentLoaded', start, { once: true });
  else setTimeout(start);
})();
