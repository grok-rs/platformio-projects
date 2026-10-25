// study.js: shared runtime for lesson hubs and global study pages (design brief §3.2).
//
// Classic script, loaded with `defer` after course.js and site-nav.js. It defines window.Study right away, then
// wires every component on DOMContentLoaded (by then quiz.js, flashcards.js and schem.js have run too) and
// dispatches `study:ready` on document. Page widgets: document.addEventListener('study:ready', () => { … }).
//
// Storage is always optional: every localStorage call sits in try/catch and falls back to memory for the visit.
(() => {
  'use strict';
  const doc = document, root = doc.documentElement;
  const MINUS = '−', NBSP = ' ';

  // docs/ root from this script's own URL (…/docs/assets/study.js → …/docs/), so pages work at any depth.
  const self = doc.currentScript || doc.querySelector('script[src*="assets/study.js"]');
  const base = new URL('../', self ? self.src : location.href).href;

  const $ = (sel, scope = doc) => scope.querySelector(sel);
  const $$ = (sel, scope = doc) => Array.from(scope.querySelectorAll(sel));
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mqDark = matchMedia('(prefers-color-scheme: dark)');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const h = (tag, attrs = {}, html = '') => {
    const el = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) el.setAttribute(k, v === true ? '' : v);
    if (html) el.innerHTML = html;
    return el;
  };

  /* ================================================================ scrollbar width → --sbw (for .wide) */
  // 100vw includes a classic scrollbar, so .wide subtracts --sbw. Re-measured when the viewport or the page
  // height changes (a growing page is what makes the scrollbar appear).
  let sbw = -1;
  const measureSbw = () => {
    const w = Math.max(0, Math.round(innerWidth - root.clientWidth));
    if (w !== sbw) { sbw = w; root.style.setProperty('--sbw', w + 'px'); }
  };
  measureSbw();
  addEventListener('resize', measureSbw, { passive: true });
  if (window.ResizeObserver) try { new ResizeObserver(measureSbw).observe(root); } catch { /* old browser */ }

  /* ================================================================ storage */
  // JSON values; when localStorage is blocked (private mode, file://, policy) values live in memory for this visit.
  const mem = new Map();
  const store = {
    get(key, fallback = null) {
      try {
        const raw = localStorage.getItem(key);
        if (raw !== null) return JSON.parse(raw);
      } catch { /* blocked or bad JSON: fall through */ }
      return mem.has(key) ? mem.get(key) : fallback;
    },
    set(key, value) {
      mem.set(key, value);
      try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
    },
    del(key) {
      mem.delete(key);
      try { localStorage.removeItem(key); } catch { /* per visit */ }
    },
  };
  // Read-modify-write of one sub-key inside a namespaced object such as study.measure.v1.
  const patch = (key, sub, value) => {
    const all = store.get(key, {}) || {};
    if (value === undefined) delete all[sub]; else all[sub] = value;
    store.set(key, all);
  };
  const pageKey = () => (doc.body && doc.body.dataset.lesson) || location.pathname.replace(/index\.html$/, '');

  /* ================================================================ numbers */
  // Ukrainian style: decimal comma, true minus, NBSP thousands separator from 5 digits up («10 000», «4700»).
  function num(x, dec = 2, fixed = false) {
    if (typeof x !== 'number' || !Number.isFinite(x)) return '—';
    let s = Math.abs(x).toFixed(Math.max(0, dec));
    if (!fixed && s.includes('.')) s = s.replace(/\.?0+$/, '');
    let [i, f] = s.split('.');
    if (i.length > 4) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
    s = f ? `${i},${f}` : i;
    return (x < 0 && /[1-9]/.test(s) ? MINUS : '') + s;
  }

  const PREFIX = { 'п': 1e-12, 'н': 1e-9, 'мк': 1e-6, 'м': 1e-3, '': 1, 'к': 1e3, 'М': 1e6, 'Г': 1e9 };
  const SI_SETS = {
    'Ом': ['', 'к', 'М'], 'Ф': ['п', 'н', 'мк'], 'В': ['мк', 'м', '', 'к'], 'А': ['мк', 'м', ''],
    'Гц': ['', 'к', 'М', 'Г'], 'с': ['н', 'мк', 'м', ''], 'Вт': ['мк', 'м', '', 'к'], 'Гн': ['мк', 'м', ''],
  };
  // si(0.0136, 'А') → «13,6 мА»; dec = significant digits, trailing zeros dropped.
  function si(x, unit = '', dec = 3) {
    if (typeof x !== 'number' || !Number.isFinite(x)) return '—';
    const set = SI_SETS[unit] || ['п', 'н', 'мк', 'м', '', 'к', 'М', 'Г'];
    const ax = Math.abs(x);
    let idx = set.includes('') && ax === 0 ? set.indexOf('') : 0;
    if (ax > 0) set.forEach((p, k) => { if (ax >= PREFIX[p] * 0.99995) idx = k; });
    let v, d;
    for (;;) {
      v = x / PREFIX[set[idx]];
      d = v === 0 ? 0 : Math.max(0, dec - 1 - Math.floor(Math.log10(Math.abs(v))));
      v = +v.toFixed(d);
      if (Math.abs(v) >= 1000 && idx < set.length - 1) { idx++; continue; }
      break;
    }
    return `${num(v, d)}${NBSP}${set[idx]}${unit}`;
  }

  const P_IN = [['мк', 1e-6], ['µ', 1e-6], ['μ', 1e-6], ['u', 1e-6], ['п', 1e-12], ['p', 1e-12], ['н', 1e-9], ['n', 1e-9],
    ['м', 1e-3], ['m', 1e-3], ['к', 1e3], ['К', 1e3], ['k', 1e3], ['K', 1e3], ['М', 1e6], ['M', 1e6], ['Г', 1e9], ['G', 1e9]];
  const UNITS = new Set(['ом', 'ω', 'ohm', 'вт', 'в', 'v', 'w', 'а', 'a', 'ф', 'f', 'гц', 'hz', 'гн', 'h', 'с', 's', '%']);
  // Multiplier for a suffix such as «мА», «к», «кОм», «%»; null when it is not a known prefix/unit.
  function suffixFactor(rest) {
    if (!rest) return 1;
    if (UNITS.has(rest.toLowerCase())) return 1;
    for (const [p, f] of P_IN) {
      if (!rest.startsWith(p)) continue;
      const r = rest.slice(p.length);
      if (!r || UNITS.has(r.toLowerCase())) return f;
    }
    return null;
  }
  // Parses «4,7», «4.7», «4k7», «2R2», «4,7к», «13,6 мА», «−5», «1 000» → { value (base units), raw, scaled }.
  function parseQty(str) {
    const bad = { value: NaN, raw: NaN, scaled: false };
    if (typeof str === 'number') return { value: str, raw: str, scaled: false };
    let s = String(str ?? '').trim().replace(/[−–—]/g, '-').replace(/(\d)[\s  ]+(?=\d)/g, '$1');
    if (!s) return bad;
    const rkm = s.match(/^([+-]?)(\d+)(мк|[pnuµμmkKMGRrпнмкКМГ])(\d+)\s*(.*)$/);
    if (rkm) {
      const f = /[Rr]/.test(rkm[3]) ? 1 : (P_IN.find(([p]) => p === rkm[3]) || [0, NaN])[1];
      const tail = rkm[5].trim();
      if (tail && suffixFactor(tail) !== 1) return bad;
      const raw = parseFloat(`${rkm[1]}${rkm[2]}.${rkm[4]}`);
      return { value: raw * f, raw, scaled: f !== 1 };
    }
    const m = s.match(/^([+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?)\s*(.*)$/);
    if (!m) return bad;
    const raw = parseFloat(m[1].replace(',', '.'));
    const f = suffixFactor(m[2].trim());
    if (f === null) return bad;
    return { value: raw * f, raw, scaled: !!m[2].trim() };
  }
  const parseNum = (str) => parseQty(str).value;

  /* ================================================================ theme and tokens */
  let tokCache = null;
  const KNOWN_TOKENS = ['paper', 'grid', 'panel', 'panel-2', 'ink', 'muted', 'line', 'accent', 'accent-ink', 'hi', 'hi-ink', 'ok', 'bad', 'warn', 'hl',
    'n5', 'n33', 'ngnd', 'nsig', 'nsig2', 'nsig3', 'flow', 'electron', 'lvl-hi', 'lvl-lo', 'lvl-z', 'teach',
    'team-ohm', 'team-volt', 'team-amp', 'team-farad', 'f-display', 'f-body', 'f-mono'];
  // {name: value} of the CSS custom properties on :root, keyed without the leading «--» (t.accent, t['panel-2']).
  function tokens() {
    if (tokCache) return tokCache;
    const cs = getComputedStyle(root), out = {};
    for (let i = 0; i < cs.length; i++) {
      const n = cs[i];
      if (n.startsWith('--')) out[n.slice(2)] = cs.getPropertyValue(n).trim();
    }
    for (const n of KNOWN_TOKENS) if (!(n in out)) out[n] = cs.getPropertyValue('--' + n).trim();
    return (tokCache = out);
  }
  const isDark = () => root.dataset.theme === 'dark' || (root.dataset.theme !== 'light' && mqDark.matches);
  const themeFns = new Set();
  const themeChanged = () => {
    tokCache = null;
    const t = tokens();
    themeFns.forEach((fn) => { try { fn(t); } catch (e) { console.error(e); } });
  };
  // Registered before any page code, so the token cache is cleared before page handlers run.
  window.addEventListener('themechange', themeChanged);
  mqDark.addEventListener('change', themeChanged);
  const onTheme = (fn) => { themeFns.add(fn); return () => themeFns.delete(fn); };

  /* ================================================================ canvas + animation */
  // DPR-aware canvas. The canvas fills its container width; height follows the width/height attribute
  // aspect ratio unless CSS gives it a fixed height. Call again on resize. ctx.w / ctx.h = CSS pixels.
  function fitCanvas(cv) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (!cv._fit) {
      cv._fit = { aspect: (cv.height || 150) / (cv.width || 300) };
      if (!cv.style.width) cv.style.width = '100%';
      const r0 = cv.getBoundingClientRect();
      cv._fit.auto = !r0.height || Math.abs(r0.height - r0.width * cv._fit.aspect) < 2;
    }
    const r = cv.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const hgt = cv._fit.auto ? w * cv._fit.aspect : Math.max(1, r.height);
    if (cv._fit.auto) cv.style.height = hgt + 'px';
    const W = Math.round(w * dpr), H = Math.round(hgt * dpr);
    if (cv.width !== W) cv.width = W;
    if (cv.height !== H) cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.w = w; ctx.h = hgt; ctx.dpr = dpr;
    return ctx;
  }

  // One shared rAF loop; a sim only runs while visible and not paused. frame(dt, t) in seconds.
  const sims = new Set();
  let rafId = 0, lastTs = 0;
  const loop = (now) => {
    rafId = 0;
    const dt = lastTs ? Math.min(0.1, (now - lastTs) / 1000) : 0;
    lastTs = now;
    let any = false;
    for (const s of sims) {
      if (!s.on || !s.visible) continue;
      any = true;
      s.t += dt;
      try { s.frame(dt, s.t); } catch (e) { console.error(e); s.ctl.pause(); }
    }
    if (any) rafId = requestAnimationFrame(loop); else lastTs = 0;
  };
  const kick = () => { if (!rafId) rafId = requestAnimationFrame(loop); };
  const visObs = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    for (const e of entries) { const s = e.target._sim; if (s) { s.visible = e.isIntersecting; if (s.visible) kick(); } }
  }, { rootMargin: '80px' }) : null;

  function sim(el, frame) {
    // Gates are soft (the widget is usable before the prediction), so an animation never waits for one.
    const s = { el, frame, t: 0, on: !mqReduce.matches, visible: !visObs };
    const label = () => {
      el.dataset.sim = s.on ? 'running' : 'paused';
      el.title = s.on ? 'Натисніть, щоб зупинити' : 'Натисніть, щоб запустити';
    };
    s.ctl = {
      play() { s.on = true; label(); kick(); },
      pause() { s.on = false; label(); },
      toggle() { s.on ? s.ctl.pause() : s.ctl.play(); },
      draw() { try { frame(0, s.t); } catch (e) { console.error(e); } },
      get running() { return s.on; },
      get t() { return s.t; },
      destroy() { sims.delete(s); if (visObs) visObs.unobserve(el); delete el._sim; },
    };
    el._sim = s;
    sims.add(s);
    if (visObs) visObs.observe(el);
    // Clicks on controls inside the element must not toggle the animation.
    el.addEventListener('click', (e) => { if (!e.target.closest('input,button,select,textarea,a,label') || e.target === el) s.ctl.toggle(); });
    if (el.tabIndex < 0 && !/^(BUTTON|A|INPUT)$/.test(el.tagName)) el.tabIndex = 0;
    el.addEventListener('keydown', (e) => {
      if (e.target === el && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); s.ctl.toggle(); }
    });
    label();
    s.ctl.draw();
    if (s.on) kick();
    return s.ctl;
  }

  /* ================================================================ animated explainer: a short «video» in steps */
  // <figure class="anim"><div class="anim-stage">svg or canvas</div></figure>
  // Study.anim(fig, { steps: [{ title, cap, dur }], draw(i, p, t) }) redraws step i at progress p ∈ [0, 1]
  // (t = seconds into the step). Adds ⏮ ▶ ⏭, a chapter strip and an aria-live caption (cap may hold inline HTML).
  // Plays when scrolled into view, stops at the end; under reduced motion it waits for ▶. ← / → step through.
  function anim(fig, { steps, draw }) {
    const stage = $('.anim-stage', fig) || fig;
    const cap = $('.anim-cap', fig) || fig.appendChild(h('figcaption', { class: 'anim-cap', 'aria-live': 'polite' }));
    const bar = h('div', { class: 'anim-ctl' });
    bar.innerHTML = `<button type="button" class="anim-btn" data-a="prev" aria-label="Попередній крок">⏮</button>
      <button type="button" class="anim-btn play" data-a="play">▶</button>
      <button type="button" class="anim-btn" data-a="next" aria-label="Наступний крок">⏭</button>
      <ol class="anim-steps">${steps.map((st, k) => `<li><button type="button" data-k="${k}" title="${esc(st.title || '')}"
        aria-label="Крок ${k + 1}${st.title ? ': ' + esc(st.title) : ''}"><span></span></button></li>`).join('')}</ol>
      <span class="anim-n" aria-hidden="true"></span>`;
    fig.appendChild(bar);
    const playBtn = $('[data-a="play"]', bar), ticks = $$('.anim-steps button', bar), n = $('.anim-n', bar);
    const dur = (k) => steps[k].dur || 4;
    let i = 0, t = 0, ended = false, ctl = null;
    const paint = () => {
      const p = Math.min(1, t / dur(i));
      try { draw(i, p, t); } catch (e) { console.error(e); }
      ticks.forEach((b, k) => {
        b.firstChild.style.setProperty('--p', k < i ? 1 : k === i ? p.toFixed(3) : 0);
        b.setAttribute('aria-current', k === i ? 'step' : 'false');
      });
    };
    const sync = () => {
      const on = !!(ctl && ctl.running);
      playBtn.textContent = on ? '⏸' : ended ? '↻' : '▶';
      playBtn.setAttribute('aria-label', on ? 'Пауза' : ended ? 'Переглянути ще раз' : 'Відтворити');
      fig.classList.toggle('playing', on);
    };
    const caption = () => { cap.innerHTML = steps[i].cap || ''; n.textContent = `${i + 1} / ${steps.length}`; };
    const go = (k) => { i = Math.max(0, Math.min(steps.length - 1, k)); t = 0; ended = false; caption(); paint(); sync(); };
    ctl = sim(stage, (dt) => {
      if (dt) {
        t += dt;
        if (t >= dur(i)) {
          if (i < steps.length - 1) { i++; t = 0; caption(); }
          else { t = dur(i); ended = true; ctl.pause(); sync(); }
        }
      }
      paint();
    });
    playBtn.addEventListener('click', () => { if (ended) go(0); ctl.toggle(); sync(); });
    $('[data-a="prev"]', bar).addEventListener('click', () => go(t > 0.6 ? i : i - 1));
    $('[data-a="next"]', bar).addEventListener('click', () => go(i + 1));
    ticks.forEach((b, k) => b.addEventListener('click', () => go(k)));
    stage.addEventListener('click', sync);
    stage.addEventListener('keydown', sync);
    fig.addEventListener('keydown', (e) => {
      if (e.target.closest('input,select,textarea')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); }
    });
    caption(); paint(); sync();
    return { ...ctl, go, get step() { return i; } };
  }

  /* ================================================================ on/off switches */
  // <button type="button" class="sw" aria-checked="false">Діод</button> — a click flips aria-checked and fires a
  // bubbling `switch` event with detail.on. Pages: el.addEventListener('switch', (e) => …(e.detail.on)).
  function switches(scope = doc) {
    $$('button.sw', scope).forEach((b) => {
      b.type = 'button';
      b.setAttribute('role', 'switch');
      if (!b.hasAttribute('aria-checked')) b.setAttribute('aria-checked', 'false');
    });
  }
  doc.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('button.sw');
    if (!b || b.disabled) return;
    const on = b.getAttribute('aria-checked') !== 'true';
    b.setAttribute('aria-checked', String(on));
    b.dispatchEvent(new CustomEvent('switch', { bubbles: true, detail: { on } }));
  });

  /* ================================================================ toast, copy, fetch */
  let toastEl, toastTimer;
  function toast(msg, kind = '') {
    if (!toastEl) {
      toastEl = h('div', { class: 'study-toast', role: 'status', 'aria-live': 'polite' });
      doc.body.appendChild(toastEl);
    }
    toastEl.className = 'study-toast' + (kind ? ' ' + kind : '');
    toastEl.textContent = msg;
    void toastEl.offsetWidth; // restart the transition
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), kind === 'bad' ? 6000 : 2400);
  }

  function legacyCopy(text) {
    const ta = h('textarea', { readonly: true, 'aria-hidden': 'true', style: 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0' });
    ta.value = text;
    doc.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = doc.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
  async function copy(text) {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch { ok = legacyCopy(text); }
    toast(ok ? 'Скопійовано' : 'Не вдалося скопіювати: виділіть текст і скопіюйте вручну', ok ? '' : 'bad');
    return ok;
  }

  const jsonCache = new Map();
  // fetch(Study.base + relPath) as JSON. On failure shows a toast (always on file://) and rejects.
  function fetchJSON(relPath, { quiet = false } = {}) {
    if (jsonCache.has(relPath)) return jsonCache.get(relPath);
    const p = fetch(new URL(relPath, base)).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }).catch((err) => {
      jsonCache.delete(relPath);
      const file = location.protocol === 'file:';
      if (file) toast(`Не вдалося завантажити ${relPath} (відкрийте сайт через http://, не file://)`, 'bad');
      else if (!quiet) toast(`Не вдалося завантажити ${relPath}. Оновіть сторінку або спробуйте пізніше.`, 'bad');
      throw err;
    });
    jsonCache.set(relPath, p);
    return p;
  }

  /* ================================================================ course manifest */
  // Lesson record from window.COURSE (course.js) with its module attached, or null.
  function lessonInfo(id = Study.lesson) {
    const C = window.COURSE;
    if (!C || !id || !Array.isArray(C.modules)) return null;
    for (const m of C.modules) for (const l of m.lessons || []) if (l.id === id) return { ...l, module: m };
    return null;
  }
  const lessonLabel = () => {
    const l = lessonInfo();
    return l ? `Урок ${l.n || l.id} · ${l.title}` : doc.title;
  };

  /* ================================================================ predict → gated widget */
  const CHECKS = 'study.checks.v1';
  const predictKey = (p, i) => p.id || (p.dataset.gate ? 'gate:' + p.dataset.gate : 'p' + i);

  // Soft gate: the widget is always usable (students want to play with it); until the prediction is made a small
  // hint above it points back to the question. `predict` still fires on the gate when the prediction is made.
  function lockGate(g) {
    if (g._gate) return;
    g._gate = true;
    g.classList.add('open');
    if ($('.gate-hint', g)) return;
    const p = $(`.predict[data-gate="${CSS.escape(g.id)}"]`);
    if (!p || p.dataset.done) return;
    const hint = h('button', { type: 'button', class: 'gate-hint' }, 'Порада: спершу спрогнозуйте ↑, потім перевірте тут');
    hint.addEventListener('click', () => {
      p.scrollIntoView({ behavior: mqReduce.matches ? 'auto' : 'smooth', block: 'center' });
      const first = $('.opt:not(:disabled)', p);
      if (first) first.focus({ preventScroll: true });
    });
    p.addEventListener('predicted', () => hint.remove(), { once: true });
    g.prepend(hint);
  }
  function openGate(g, detail) {
    if (!g) return;
    $$(':scope > :is(.gate-msg, .gate-hint)', g).forEach((m) => m.remove());
    for (const c of g.children) c.inert = false;
    g.removeAttribute('aria-label');
    g.classList.add('open');
    g._gate = false;
    g.dispatchEvent(new CustomEvent('predict', { detail, bubbles: true }));
  }

  function wirePredict(p, i) {
    if (p._wired) return;
    p._wired = true;
    const opts = $$('.opt', p);
    const okIdx = p.dataset.ok === undefined || p.dataset.ok === '' ? null : +p.dataset.ok;
    let fb = $('.fb', p);
    if (!fb) { fb = h('div', { class: 'fb', 'aria-live': 'polite' }); p.appendChild(fb); }
    const key = predictKey(p, i);
    const gate = p.dataset.gate ? doc.getElementById(p.dataset.gate) : null;
    if (p.dataset.gate && !gate) console.warn(`Study: .predict data-gate="${p.dataset.gate}" has no matching element`);
    opts.forEach((b) => { b.type = 'button'; b.setAttribute('aria-pressed', 'false'); });

    const choose = (j, restored = false) => {
      if (p.dataset.done) return;
      p.dataset.done = '1';
      const ok = okIdx === null ? null : j === okIdx;
      opts.forEach((o, k) => {
        o.disabled = true;
        o.setAttribute('aria-pressed', String(k === j));
        o.classList.toggle('chosen', k === j);
        if (okIdx !== null && k === okIdx) o.classList.add('right');
        else if (okIdx !== null && k === j) o.classList.add('wrong');
      });
      const next = gate ? ' Тепер перевірте на віджеті нижче.' : '';
      fb.className = 'fb ' + (ok === false ? 'no' : 'ok');
      fb.textContent = ok === null ? 'Прогноз записано.' + next
        : ok ? 'Так, ваш прогноз правильний.' + next
        : 'Не зовсім: правильна відповідь позначена ✓.' + next;
      if (p.dataset.why) {
        const ex = h('div', { class: 'explain' });
        ex.innerHTML = `<span class="tag">Поясніть собі</span>
          <p>${esc(p.dataset.prompt || 'Чому вийшло саме так? Скажіть собі одним реченням, а потім звірте з поясненням.')}</p>
          <details><summary>Пояснення</summary><p>${esc(p.dataset.why)}</p></details>`;
        fb.after(ex);
      }
      const redo = h('button', { type: 'button', class: 'btn sm ghost redo' }, 'Спробувати ще раз');
      redo.addEventListener('click', reset);
      (p.querySelector('.explain') || fb).after(redo);
      if (!restored) patch(CHECKS, pageKey(), { ...(store.get(CHECKS, {})[pageKey()] || {}), [key]: j });
      const detail = { choice: j, ok, restored };
      if (gate) openGate(gate, detail);
      p.dispatchEvent(new CustomEvent('predicted', { detail, bubbles: true }));
    };
    function reset() {
      delete p.dataset.done;
      opts.forEach((o) => { o.disabled = false; o.classList.remove('right', 'wrong', 'chosen'); o.setAttribute('aria-pressed', 'false'); });
      fb.className = 'fb'; fb.textContent = '';
      $$('.explain, .redo', p).forEach((x) => x.remove());
      const saved = { ...(store.get(CHECKS, {})[pageKey()] || {}) };
      delete saved[key];
      patch(CHECKS, pageKey(), saved);
      if (gate) { gate.classList.remove('open'); lockGate(gate); }
      if (opts[0]) opts[0].focus();
    }
    opts.forEach((b, j) => b.addEventListener('click', () => choose(j)));
    p._restore = () => {
      const j = (store.get(CHECKS, {})[pageKey()] || {})[key];
      if (Number.isInteger(j) && opts[j]) choose(j, true);
    };
  }

  const predict = {
    init(scope = doc) {
      $$('.gated', scope).forEach(lockGate);
      $$('.predict', scope).forEach(wirePredict);
    },
    // Re-applies saved predictions (fires `predict` with detail.restored = true). Runs after study:ready.
    restore(scope = doc) { $$('.predict', scope).forEach((p) => p._restore && p._restore()); },
  };

  /* ================================================================ try (numeric self-check) */
  function wireTry(tr) {
    if (tr._wired) return;
    tr._wired = true;
    const ans = parseNum(tr.dataset.ans), tol = tr.dataset.tol ? parseNum(tr.dataset.tol) : 0.02;
    const unit = tr.dataset.unit || '', d = tr.dataset.dec ? +tr.dataset.dec : 2;
    let inp = $('input', tr), btn = $('button', tr), fb = $('.fb', tr);
    if (!inp) {
      const row = h('div', { class: 'row' });
      inp = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': 'Ваша відповідь' + (unit ? `, ${unit}` : '') });
      row.append(inp);
      if (unit) row.append(h('span', { class: 'unit' }, esc(unit)));
      btn = h('button', { type: 'button', class: 'btn' }, 'Перевірити');
      row.append(btn);
      const hint = $(':scope > details', tr);
      hint ? hint.before(row) : tr.append(row);
    }
    if (!inp.hasAttribute('inputmode')) inp.setAttribute('inputmode', 'decimal');
    if (!btn) { btn = h('button', { type: 'button', class: 'btn' }, 'Перевірити'); inp.after(btn); }
    if (!fb) { fb = h('div', { class: 'fb', 'aria-live': 'polite' }); (inp.closest('.row') || inp).after(fb); }
    const unitFactor = unit ? (parseQty('1 ' + unit).value || 1) : 1;
    let wrong = 0;
    const check = () => {
      let raw = inp.value.trim();
      if (unit && raw.toLowerCase().endsWith(unit.toLowerCase())) raw = raw.slice(0, -unit.length).trim();
      const q = parseQty(raw);
      inp.classList.remove('ok', 'no');
      if (!Number.isFinite(q.value)) { fb.className = 'fb'; fb.textContent = 'Введіть число (кома чи крапка — неважливо).'; return; }
      // «13,6» is read in the task's unit; «0,0136 А» or «13,6 мА» in base units.
      const v = q.scaled ? q.value / unitFactor : q.raw;
      const ok = ans === 0 ? Math.abs(v) <= tol : Math.abs(v - ans) <= Math.abs(ans) * tol;
      const hint = $(':scope > details', tr);
      if (ok) {
        fb.className = 'fb ok';
        fb.textContent = `Так: ${num(ans, d)}${unit ? NBSP + unit : ''}.`;
        inp.classList.add('ok');
        tr.classList.add('solved');
      } else {
        wrong++;
        fb.className = 'fb no';
        fb.textContent = `Ні, спробуйте ще: правильна відповідь ${v < ans ? 'більша' : 'менша'}.` + (hint ? ' Гляньте підказку.' : '');
        inp.classList.add('no');
        if (hint) hint.open = true;
        if (wrong >= 2 && !$('.show-ans', tr)) {
          const sa = h('button', { type: 'button', class: 'btn sm ghost show-ans' }, 'Показати відповідь');
          sa.addEventListener('click', () => { fb.className = 'fb'; fb.textContent = `Відповідь: ${num(ans, d)}${unit ? NBSP + unit : ''}. Перерахуйте ще раз самостійно.`; sa.remove(); });
          btn.after(sa);
        }
      }
    };
    btn.addEventListener('click', check);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
  }
  const tryInit = (scope = doc) => $$('.try', scope).forEach(wireTry);

  /* ================================================================ measure table */
  const MEASURE = 'study.measure.v1';
  const cellText = (td) => {
    const i = $('input,textarea,select', td);
    return (i ? i.value : td.textContent).trim();
  };
  function measureRows(table) {
    return $$('tbody tr', table).map((tr) => ({ tr, cells: Array.from(tr.cells) }));
  }
  function calcDiff(table) {
    if (table.dataset.calc !== 'diff') return;
    for (const { tr } of measureRows(table)) {
      const pc = $('[data-col="pred"]', tr), mc = $('[data-col="meas"]', tr), dc = $('[data-col="diff"]', tr);
      if (!pc || !mc || !dc) continue;
      const a = parseQty(cellText(pc)), b = parseQty(cellText(mc));
      // Units on both sides → compare base values; otherwise compare the bare numbers.
      const pv = a.scaled && b.scaled ? a.value : a.raw, mv = a.scaled && b.scaled ? b.value : b.raw;
      if (!Number.isFinite(pv) || !Number.isFinite(mv) || pv === 0) { dc.textContent = '—'; dc.classList.remove('diff-big'); continue; }
      const d = (mv - pv) / Math.abs(pv) * 100;
      dc.textContent = (d > 0 ? '+' : '') + num(d, 1) + NBSP + '%';
      dc.classList.toggle('diff-big', Math.abs(d) > 20);
      dc.title = Math.abs(d) > 20 ? 'Велика різниця: перевірте вимірювання або прогноз' : '';
    }
  }
  function wireMeasure(table) {
    if (table._wired) return;
    table._wired = true;
    const key = table.dataset.key || pageKey() + ':measure';
    if (!table.parentElement.classList.contains('tbl')) {
      const wrap = h('div', { class: 'tbl' });
      table.before(wrap);
      wrap.append(table);
    }
    const heads = $$('thead th', table).map((th) => th.textContent.trim());
    // Phones stack the rows (study.css): every cell carries its column name, and explicit roles keep the table
    // semantics that a display change would otherwise drop in some screen readers.
    table.parentElement.classList.add('tbl-stack');
    table.setAttribute('role', 'table');
    $$('thead, tbody', table).forEach((g) => g.setAttribute('role', 'rowgroup'));
    $$('tr', table).forEach((tr) => tr.setAttribute('role', 'row'));
    $$('thead th', table).forEach((th) => th.setAttribute('role', 'columnheader'));
    const saved = store.get(MEASURE, {})[key] || {};
    measureRows(table).forEach(({ tr, cells }, r) => {
      const rowName = cells[0] ? cells[0].textContent.trim() : String(r + 1);
      let col = 0;
      cells.forEach((td) => {
        if (!td.hasAttribute('data-label') && heads[col]) td.dataset.label = heads[col];
        td.setAttribute('role', td.tagName === 'TH' ? 'rowheader' : 'cell');
        col += td.colSpan || 1;
      });
      cells.forEach((td, c) => {
        if (td.tagName === 'TH' || td.dataset.col === 'diff') return;
        let inp = $('input,textarea', td);
        if (!inp && !td.textContent.trim()) { inp = h('input', { type: 'text' }); td.append(inp); }
        if (!inp) return;
        if (!inp.hasAttribute('aria-label')) inp.setAttribute('aria-label', `${heads[c] || 'Значення'}: ${rowName}`);
        if (td.dataset.col === 'pred' || td.dataset.col === 'meas') inp.setAttribute('inputmode', 'decimal');
        else td.classList.add('why-col');
        const id = `${r}:${td.dataset.col || c}`;
        if (saved[id] != null) inp.value = saved[id];
        inp.addEventListener('input', () => {
          const all = store.get(MEASURE, {});
          const t = all[key] || {};
          t[id] = inp.value;
          all[key] = t;
          store.set(MEASURE, all);
          calcDiff(table);
        });
      });
    });
    calcDiff(table);
    const bar = h('div', { class: 'measure-bar' });
    const cp = h('button', { type: 'button', class: 'btn' }, 'Скопіювати для Slack/Discussions');
    const clr = h('button', { type: 'button', class: 'btn ghost sm' }, 'Очистити таблицю');
    cp.addEventListener('click', () => measure.copy(key));
    clr.addEventListener('click', () => {
      if (!confirm('Очистити всі значення в цій таблиці?')) return;
      $$('input,textarea', table).forEach((i) => { i.value = ''; });
      patch(MEASURE, key, undefined);
      calcDiff(table);
    });
    bar.append(cp, clr, h('span', { class: 'saved' }, 'Значення зберігаються в цьому браузері.'));
    table.parentElement.after(bar);
  }
  const mdCell = (s) => String(s).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ') || ' ';
  const measure = {
    init(scope = doc) { $$('table.measure', scope).forEach(wireMeasure); },
    // Markdown table text of the table with data-key = key (also copied to the clipboard).
    copy(key) {
      const table = $$('table.measure').find((t) => (t.dataset.key || pageKey() + ':measure') === key);
      if (!table) return '';
      const cap = table.caption ? table.caption.textContent.trim() : (table.dataset.title || 'Вимірювання');
      const heads = $$('thead th', table).map((th) => mdCell(th.textContent.trim()));
      const rows = measureRows(table).map(({ cells }) => cells.map((td) => mdCell(cellText(td) || '—')));
      const lines = [`**${lessonLabel()} · ${cap}**`, '', `| ${heads.join(' | ')} |`, `|${heads.map(() => '---').join('|')}|`,
        ...rows.map((r) => `| ${r.join(' | ')} |`)];
      const text = lines.join('\n');
      copy(text);
      return text;
    },
  };

  /* ================================================================ exit ticket */
  const EXIT = 'study.exit.v1';
  // `code` in a data-q question → <code>code</code> (on text that is already escaped).
  const ticks = (html) => html.replace(/`([^`]+)`/g, '<code>$1</code>');
  function buildExitFields(form) {
    // Per-lesson texts: data-q (question 1), data-placeholder (its hint), data-muddy (hint for question 2).
    const d = form.dataset;
    const q1 = d.q || 'Поясніть одним реченням головну ідею уроку.';
    const ph1 = d.placeholder || (/двома реченнями/i.test(q1) ? 'Два речення своїми словами' : 'Одне речення своїми словами');
    const ph2 = d.muddy || 'Можна коротко: яке слово, крок чи число ще плутається';
    form.innerHTML = `
      <label class="et-field"><span>1. ${ticks(esc(q1))}</span><textarea name="explain" rows="2" placeholder="${esc(ph1)}"></textarea></label>
      <label class="et-field"><span>2. Що було найменш зрозуміло?</span><textarea name="muddy" rows="2" placeholder="${esc(ph2)}"></textarea></label>
      <fieldset><legend>3. Наскільки ви впевнені в темі?</legend>
        <div class="scale">${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="conf" value="${n}"><span>${n}</span></label>`).join('')}</div>
        <div class="scale-ends"><span>1 — зовсім ні</span><span>5 — поясню іншим</span></div>
      </fieldset>`;
  }
  function wireExit(form) {
    if (form._wired) return;
    form._wired = true;
    if (!$('textarea,input', form)) buildExitFields(form);
    const key = pageKey();
    const saved = store.get(EXIT, {})[key] || {};
    const fields = $$('textarea[name],input[name]', form);
    fields.forEach((f) => {
      if (saved[f.name] == null) return;
      if (f.type === 'radio') f.checked = f.value === String(saved[f.name]);
      else f.value = saved[f.name];
    });
    const save = () => {
      const data = {};
      fields.forEach((f) => { if (f.type !== 'radio' || f.checked) data[f.name] = f.value; });
      data.at = new Date().toISOString();
      patch(EXIT, key, data);
    };
    form.addEventListener('input', save);
    form.addEventListener('change', save);

    let actions = $('.actions', form);
    if (!actions) {
      actions = h('div', { class: 'actions' });
      actions.innerHTML = '<button type="submit" class="btn primary">Скопіювати</button>';
      const url = window.COURSE && window.COURSE.exitTicketUrl;
      if (url) actions.append(h('a', { class: 'btn', href: url, target: '_blank', rel: 'noopener' }, 'Надіслати у форму ↗'));
      const clr = h('button', { type: 'button', class: 'btn ghost sm' }, 'Очистити');
      clr.addEventListener('click', () => { form.reset(); patch(EXIT, key, undefined); });
      actions.append(clr);
      form.append(actions, h('p', { class: 'et-note' }, 'Нічого не надсилається автоматично. Текст копіюється, а ви самі вставляєте його в особисте повідомлення викладачу (Zoom чи Slack) або у форму.'));
    }
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      copy(exit.text(form));
    });
  }
  const exit = {
    init(scope = doc) { $$('form.exit-ticket', scope).forEach(wireExit); },
    // Plain-text ticket: «Квиток на вихід · Урок 1.1 · …» + each question and answer.
    text(form = $('form.exit-ticket')) {
      if (!form) return '';
      const out = [`Квиток на вихід · ${lessonLabel()} · ${new Date().toLocaleDateString('uk-UA')}`];
      $$('label.et-field, .et-field, fieldset', form).forEach((blk) => {
        const q = (blk.querySelector('legend, span') || blk).textContent.trim();
        const f = blk.querySelector('textarea, input:not([type="radio"])');
        const radio = blk.querySelector('input[type="radio"]:checked');
        const a = radio ? `${radio.value}/5` : f ? f.value.trim() : '';
        if (q) out.push('', q, a || '—');
      });
      return out.join('\n');
    },
  };

  /* ================================================================ teacher mode */
  const TEACHER = 'study.teacher';
  const teacherBtns = new Set();
  const teacher = {
    get on() { return root.classList.contains('teacher'); },
    set(on, persist = true) {
      root.classList.toggle('teacher', !!on);
      if (persist) store.set(TEACHER, !!on);
      teacherBtns.forEach((b) => b.setAttribute('aria-pressed', String(!!on)));
      doc.dispatchEvent(new CustomEvent('teacherchange', { detail: { on: !!on } }));
      return !!on;
    },
    toggle() { return teacher.set(!teacher.on); },
    bind(btn) {
      teacherBtns.add(btn);
      btn.setAttribute('aria-pressed', String(teacher.on));
      btn.addEventListener('click', (e) => { e.preventDefault(); teacher.toggle(); });
    },
  };
  {
    // ?teacher=1 / ?teacher=0 switch the mode and remember it; otherwise the stored choice applies.
    const q = new URLSearchParams(location.search).get('teacher');
    if (q === '1' || q === '0') teacher.set(q === '1');
    else root.classList.toggle('teacher', store.get(TEACHER, false) === true);
  }
  function mountTeacherButton() {
    const own = $$('[data-teacher-toggle], .teacher-btn');
    if (own.length) { own.forEach(teacher.bind); return; }
    const head = $('.hub > header, .hub-head');
    if (!head) return;
    const btn = h('button', { type: 'button', class: 'btn teach sm teacher-btn' }, 'Режим викладача');
    // Students should not wonder whether to press it: it lives at the end of the page, and stays in the hero
    // only while the mode is on or the link asks for it (?teacher).
    if (teacher.on || new URLSearchParams(location.search).has('teacher')) {
      let row = $('.actions', head);
      if (!row) { row = h('div', { class: 'actions' }); head.append(row); }
      row.append(btn);
    } else {
      const foot = h('div', { class: 'teacher-foot' }, '<span>Для викладача: показує нотатки для проведення заняття.</span>');
      foot.append(btn);
      (head.closest('.hub, main') || head.parentElement).append(foot);
      injectCSS();
    }
    teacher.bind(btn);
  }
  // The few rules for markup this script builds itself; study.css may restyle them.
  function injectCSS() {
    if (doc.getElementById('study-js-css')) return;
    const st = h('style', { id: 'study-js-css' });
    st.textContent = `.teacher-foot { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; margin: 48px 0 8px; padding-top: 16px;
  border-top: 1px dashed var(--line-2, var(--line)); font-size: 14px; color: var(--muted); }
@media print { .teacher-foot { display: none; } }
.hub-end { margin: 48px 0 0; padding: 18px 20px; border: 1.5px solid var(--line-2, var(--line)); border-radius: 16px; background: var(--panel); }
.hub-end-status { list-style: none; margin: 0 0 14px; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.hub-end-status > li { margin: 0; display: inline-flex; flex-wrap: wrap; gap: 2px 8px; align-items: baseline; padding: 5px 12px; border-radius: 999px;
  border: 1px solid var(--line-2, var(--line)); background: var(--panel); }
.he-k { font: 600 13px var(--f-mono, monospace); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.hub-end-status > li.ok > b::after { content: " ✓"; color: var(--ok); }
.hub-end-btns { display: flex; flex-wrap: wrap; gap: 10px; }
.ch-roles { list-style: none; margin: 8px 0 4px; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
@media (max-width: 420px) { .ch-roles { grid-template-columns: minmax(0, 1fr); } }
/* a role card: the chip row (icon, role, this week's name) over the unchanged description */
.ch-roles > .ch-role { margin: 0; padding: 8px 12px 10px; display: flex; flex-direction: column; align-items: stretch; justify-content: flex-start; gap: 4px;
  border: 1px solid var(--line-2, var(--line)); border-radius: 12px; background: var(--panel-2); }
.ch-rhead { display: flex; align-items: center; gap: 8px; min-width: 0; min-height: 28px; }
.ch-rhead .name { margin-left: auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 600 13px var(--f-mono, monospace); color: var(--ink); }
.ch-ic { flex: none; width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round;
  color: var(--copper, var(--accent)); }
.ch-desc { display: block; font-size: 15px; line-height: 1.45; }
.challenge dd > details.ch-crit { margin: 4px 0 0; }
.ch-when { margin-right: 4px; vertical-align: baseline; }`;
    doc.head.prepend(st);
  }

  /* ================================================================ TOC */
  const mqWide = matchMedia('(min-width: 1100px)');
  function toc() {
    const hub = $('.hub');
    if (!hub || $(':scope > .hub-toc', hub)) return null;
    const secs = $$('section.hs', hub).filter((s) => s.id && $(':scope > h2', s));
    if (secs.length < 3) return null;
    const items = secs.map((s) => {
      const h2 = $(':scope > h2', s).cloneNode(true);
      const n = $('.n', h2);
      const num = n ? n.textContent.trim() : '';
      if (n) n.remove();
      $$('.cite', h2).forEach((c) => c.remove());
      const cls = s.classList.contains('t-only') ? ' class="t-only"' : '';
      return `<li${cls}><a href="#${esc(s.id)}"><span class="n">${esc(num)}</span><span>${esc(h2.textContent.trim())}</span></a></li>`;
    });
    const box = h('details', { class: 'hub-toc' });
    // Reference pages set <main class="hub" data-toc="Зміст сторінки">; lesson hubs keep the default.
    const label = esc(hub.dataset.toc || 'Зміст уроку');
    box.innerHTML = `<summary>${label}</summary><nav aria-label="${label}"><ol>${items.join('')}</ol></nav>`;
    const head = $(':scope > header', hub);
    head ? head.after(box) : hub.prepend(box);
    hub.classList.add('has-toc');
    const sync = () => { box.open = mqWide.matches; };
    sync();
    mqWide.addEventListener('change', sync);
    box.addEventListener('click', (e) => { if (e.target.closest('a') && !mqWide.matches) box.open = false; });
    // Highlight the section being read: the last one whose top is above 30 % of the viewport (the first one
    // before that, the last one at the very bottom of the page). Hidden (teacher-only) sections are skipped.
    const links = $$('a', box);
    const subs = [(i) => links.forEach((a, k) => (k === i ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current')))];
    let cur = -1, raf = 0;
    const spy = () => {
      raf = 0;
      const shown = secs.map((s, k) => [s, k]).filter(([s]) => s.getClientRects().length);
      if (!shown.length) return;
      const lim = innerHeight * 0.3;
      let i = shown[0][1];
      for (const [s, k] of shown) if (s.getBoundingClientRect().top <= lim) i = k;
      if (innerHeight + scrollY >= root.scrollHeight - 2) i = shown[shown.length - 1][1];
      if (i !== cur) { cur = i; subs.forEach((fn) => fn(i)); }
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(spy); };
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue, { passive: true });
    doc.addEventListener('teacherchange', queue);
    spy();
    mbar(hub, secs, box, (fn) => { subs.push(fn); if (cur >= 0) fn(cur); });
    return box;
  }

  /* ================================================================ phone section bar */
  // <900 px: a bar at the bottom with the current section («03 / 16 Назва ▾», opens a sheet with the TOC links),
  // «На початок» and a reading-progress line. study.css styles it; .is-on once the hero has scrolled away.
  const mqPhone = matchMedia('(max-width: 899.98px)');
  function mbar(hub, secs, box, onSection) {
    let bar = null;
    const build = () => {
      bar = h('nav', { class: 'hub-mbar', 'aria-label': 'Розділи' });
      bar.innerHTML = `<div class="hub-mbar-progress" aria-hidden="true"></div>
        <button type="button" class="hub-mbar-toc" aria-expanded="false" aria-controls="hub-mbar-sheet"></button>
        <a class="hub-mbar-top" href="#top" aria-label="На початок"><span aria-hidden="true">↑</span></a>
        <div class="hub-mbar-sheet" id="hub-mbar-sheet" hidden></div>`;
      const btn = $('.hub-mbar-toc', bar), sheet = $('.hub-mbar-sheet', bar), prog = $('.hub-mbar-progress', bar);
      sheet.append($('ol', box).cloneNode(true));
      const sheetLinks = $$('a', sheet);
      const nums = secs.map((s) => { const n = $(':scope > h2 .n', s); return n ? n.textContent.trim() : ''; });
      const titles = $$('a', box).map((a) => (a.lastElementChild || a).textContent.trim());
      onSection((i) => {
        btn.innerHTML = `<span class="n">${esc(nums[i] || String(i + 1).padStart(2, '0'))} / ${secs.length}</span> <span class="t">${esc(titles[i])}</span> <span aria-hidden="true">▾</span>`;
        sheetLinks.forEach((a, k) => (k === i ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current')));
      });
      const open = (on, refocus = true) => {
        if (on === !sheet.hidden) return;
        sheet.hidden = !on;
        btn.setAttribute('aria-expanded', String(on));
        // preventScroll: the bar is fixed, so focusing inside it must not move the page.
        if (on) (sheetLinks.find((a) => a.hasAttribute('aria-current')) || sheetLinks[0])?.focus({ preventScroll: true });
        else if (refocus) btn.focus({ preventScroll: true });
      };
      btn.addEventListener('click', () => open(sheet.hidden));
      sheet.addEventListener('click', (e) => { if (e.target.closest('a')) open(false, false); });
      bar.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) { e.preventDefault(); open(false); } });
      doc.addEventListener('click', (e) => { if (!sheet.hidden && !bar.contains(e.target)) open(false, false); });
      $('.hub-mbar-top', bar).addEventListener('click', (e) => {
        e.preventDefault();
        open(false, false);
        scrollTo({ top: 0, behavior: mqReduce.matches ? 'auto' : 'smooth' });
      });
      const progress = () => {
        const max = root.scrollHeight - innerHeight;
        prog.style.setProperty('--p', max > 0 ? Math.min(1, Math.max(0, scrollY / max)).toFixed(4) : '0');
      };
      addEventListener('scroll', progress, { passive: true });
      addEventListener('resize', progress, { passive: true });
      progress();
      const head = $(':scope > header', hub) || $('.hub-head');
      if (head && 'IntersectionObserver' in window) {
        new IntersectionObserver(([e]) => bar.classList.toggle('is-on', !e.isIntersecting && e.boundingClientRect.top < 0)).observe(head);
      } else bar.classList.add('is-on');
      doc.body.append(bar);
    };
    const sync = () => {
      if (mqPhone.matches && !bar) build();
      if (bar) {
        bar.hidden = !mqPhone.matches;
        if (bar.hidden) { const sh = $('.hub-mbar-sheet', bar); sh.hidden = true; $('.hub-mbar-toc', bar).setAttribute('aria-expanded', 'false'); }
      }
    };
    sync();
    mqPhone.addEventListener('change', sync);
  }

  /* ================================================================ citations */
  const fmtDate = (s) => {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : String(s || '');
  };
  const STATUS = { disputed: 'спірне', unverified: 'не перевірено' };
  function factsIndex(data) {
    const list = Array.isArray(data) ? data : Array.isArray(data && data.facts) ? data.facts
      : data && typeof data === 'object' ? Object.entries(data).map(([id, f]) => ({ id, ...f })) : [];
    return new Map(list.filter((f) => f && f.id).map((f) => [f.id, f]));
  }
  async function cites() {
    const els = $$('.cite[data-fact]');
    if (!els.length) return;
    const order = [];
    els.forEach((el) => { if (!order.includes(el.dataset.fact)) order.push(el.dataset.fact); });
    let facts = null;
    try { facts = factsIndex(await fetchJSON('data/facts.json', { quiet: true })); } catch { facts = null; }
    els.forEach((el) => {
      const id = el.dataset.fact, n = order.indexOf(id) + 1, f = facts && facts.get(id);
      const first = !$$(`.cite[data-fact="${CSS.escape(id)}"] a`).length;
      el.innerHTML = `<a href="#src-${esc(id)}"${first ? ` id="cite-${esc(id)}"` : ''} aria-label="Джерело ${n}">[${n}${facts && !f ? '?' : ''}]</a>`;
      el.classList.toggle('cite-missing', !!facts && !f);
      if (f && f.claim) el.title = f.claim;
    });
    const host = doc.getElementById('sources');
    if (!host) { console.warn('Study.cites: no #sources element for the source list'); return; }
    let ol = host.matches('ol') ? host : $('ol.sources', host);
    if (!ol) { ol = h('ol', { class: 'sources' }); host.append(ol); }
    ol.classList.add('sources');
    ol.innerHTML = order.map((id) => {
      const f = facts && facts.get(id);
      const back = `<a class="src-back" href="#cite-${esc(id)}" aria-label="Повернутися до тексту">↩</a>`;
      if (!f) {
        const why = facts ? 'відсутній у реєстрі facts.json' : 'реєстр фактів ще недоступний';
        return `<li id="src-${esc(id)}"><span class="src-missing">Факт <code>${esc(id)}</code>: ${why}.</span>${back}</li>`;
      }
      const src = f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.source || f.url)}</a>` : esc(f.source || '');
      const st = STATUS[f.status] ? `<span class="src-status ${esc(f.status)}">${STATUS[f.status]}</span>` : '';
      const meta = [src, f.section ? esc(f.section) : '', f.checked ? `перевірено ${esc(fmtDate(f.checked))}` : ''].filter(Boolean).join(' · ');
      return `<li id="src-${esc(id)}">${esc(f.claim || id)}${st}${back}<span class="src-meta">${meta}</span>${f.note ? `<span class="src-meta">${esc(f.note)}</span>` : ''}</li>`;
    }).join('');
  }

  /* ================================================================ team challenge (#challenge) */
  // The reader's team and this week's names come from the role generator on team/ (team.rota.v1, this browser only).
  const ROTA = 'team.rota.v1';
  const TEAM_IDS = ['ohm', 'volt', 'amp', 'farad'];
  const ROLES = [['builder', 'Збирач'], ['measurer', 'Вимірювач'], ['reporter', 'Доповідач'], ['skeptic', 'Скептик']];
  // 20×20 line icons, currentColor: breadboard, meter, speech bubble, magnifier.
  const ROLE_ICON = {
    builder: '<rect x="2.5" y="5" width="15" height="10" rx="2"/><path d="M6 8.5h0M10 8.5h0M14 8.5h0M6 11.5h0M10 11.5h0M14 11.5h0"/>',
    measurer: '<path d="M3.5 13.5a6.5 6.5 0 0 1 13 0"/><path d="M10 13.5l3-4.5"/><path d="M3 16.5h14"/>',
    reporter: '<path d="M3 4.5h14v8.5H9l-4 3.5V13H3z"/><path d="M6.5 8h7M6.5 10.5h4.5"/>',
    skeptic: '<circle cx="8.5" cy="8.5" r="5"/><path d="M12.2 12.2l4.8 4.8"/>',
  };
  const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const mondayOf = (d) => { const m = new Date(d); m.setHours(12, 0, 0, 0); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m; };
  // ?today=YYYY-MM-DD, as on team/, for testing the week logic.
  const todayDate = () => {
    const q = new URLSearchParams(location.search).get('today');
    return q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? new Date(q + 'T12:00:00') : new Date();
  };
  const plural = (n, one, few, many) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; };
  // This week's name per role key, the same rotation as team/ (3 people: the Збирач also measures).
  function rotaWeek(rota) {
    const names = String((rota.names || {})[rota.team] || '').split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean).slice(0, 6);
    if (names.length < 3 || !rota.start || !/^\d{4}-\d{2}-\d{2}$/.test(rota.start)) return null;
    const w = Math.round((mondayOf(todayDate()) - mondayOf(new Date(rota.start + 'T12:00:00'))) / (7 * 864e5));
    if (w < 0 || w >= Math.max(1, Math.min(12, +rota.weeks || 4))) return null;
    const slot = names.length === 3 ? { builder: 0, measurer: 0, reporter: 1, skeptic: 2 } : { builder: 0, measurer: 1, reporter: 2, skeptic: 3 };
    return Object.fromEntries(Object.entries(slot).map(([k, i]) => [k, names[(i + w) % names.length]]));
  }
  // <dd> that follows the <dt> with this text.
  const ddOf = (box, label) => {
    const dt = $$('dt', box).find((x) => x.textContent.trim() === label);
    const dd = dt && dt.nextElementSibling;
    return dd && dd.localName === 'dd' ? dd : null;
  };
  const mqCh = matchMedia('(max-width: 640px)');
  function challengeInit() {
    const card = $('#challenge .challenge');
    if (!card || card._ch) return;
    card._ch = true;
    injectCSS();
    let rota = {};
    try { rota = JSON.parse(localStorage.getItem(ROTA) || '{}') || {}; } catch { rota = {}; }
    if (TEAM_IDS.includes(rota.team)) { card.classList.add('is-mine'); card.dataset.team = rota.team; }

    // Roles → 2×2 chips with an icon and, when the rota covers this week, the name.
    const rolesDd = ddOf(card, 'Ролі');
    const ul = rolesDd && $(':scope > ul', rolesDd);
    const who = TEAM_IDS.includes(rota.team) ? rotaWeek(rota) : null;
    if (ul) {
      const lis = $$(':scope > li', ul);
      const parsed = lis.map((li) => {
        const m = li.textContent.match(/^\s*(Збирач|Вимірювач|Доповідач|Скептик)/);
        return m ? ROLES.find(([, n]) => n === m[1]) : null;
      });
      if (lis.length && parsed.every(Boolean)) {
        ul.classList.add('ch-roles');
        lis.forEach((li, i) => {
          const [key, name] = parsed[i];
          // Take the role word out of the description (a leading <b>Збирач</b> or plain «Збирач»), keep the rest as is.
          const first = li.firstChild;
          if (first && first.nodeType === 1 && first.localName === 'b' && first.textContent.trim() === name) first.remove();
          else if (first && first.nodeType === 3) first.nodeValue = first.nodeValue.replace(new RegExp(`^\\s*${name}`), '');
          const lead = li.firstChild;
          if (lead && lead.nodeType === 3) lead.nodeValue = lead.nodeValue.replace(/^\s*:?\s*/, '');
          const desc = h('span', { class: 'ch-desc' });
          while (li.firstChild) desc.append(li.firstChild);
          li.classList.add('ch-role');
          li.dataset.role = key;
          li.innerHTML = `<span class="ch-rhead"><svg class="ch-ic" viewBox="0 0 20 20" aria-hidden="true">${ROLE_ICON[key]}</svg><b>${name}</b>${who ? `<span class="name" title="Цього тижня">${esc(who[key])}</span>` : ''}</span>`;
          li.append(desc);
        });
      }
    }

    // Criteria: on phones a closed <details> «N критеріїв · до 2N балів» (not when they already sit in details.more).
    const critDd = ddOf(card, 'Критерії');
    if (critDd && !critDd.closest('details') && !$('details', critDd)) {
      const rows = $$('table.rubric tr', critDd).length || $$(':scope > ul > li, :scope > ol > li', critDd).length
        || (critDd.textContent.match(/\(\d\)/g) || []).length
        || critDd.textContent.split(/\s·\s|;\s/).filter((x) => x.trim()).length;
      const n = rows > 1 ? rows : 0;
      const det = h('details', { class: 'more ch-crit' });
      det.innerHTML = `<summary>${n ? `${n} ${plural(n, 'критерій', 'критерії', 'критеріїв')} · до ${2 * n} балів` : 'Критерії оцінювання'}</summary>`;
      // The content moves into the details only while the screen is narrow, and back on a wide one.
      const sync = () => {
        if (mqCh.matches && !det.isConnected) { while (critDd.firstChild) det.append(critDd.firstChild); critDd.append(det); }
        else if (!mqCh.matches && det.isConnected) { det.remove(); while (det.childNodes.length > 1) critDd.append(det.childNodes[1]); }
      };
      sync();
      mqCh.addEventListener('change', sync);
    }

    // Deadline state from the lesson date, as on team/: this week / later / past (revision only).
    const dueDd = ddOf(card, 'Термін');
    const l = lessonInfo();
    if (dueDd && l && l.date) {
      const mon = mondayOf(todayDate()), sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      const when = l.date < isoDay(mon) ? 'past' : l.date > isoDay(sun) ? 'next' : 'now';
      const txt = { past: 'минуло · для повторення', now: 'цей тиждень', next: 'наступний' }[when];
      dueDd.prepend(h('span', { class: `chip ch-when${when === 'now' ? ' ok' : when === 'next' ? ' warn' : ''}`, 'data-when': when }, txt), ' ');
    }
  }

  /* ================================================================ hub end: lesson status + where next */
  const hubOk = (l) => l && (l.status === 'ready' || l.status === 'draft');
  const hubHref = (l) => base + (l.hub || `lessons/${l.id}/`);
  const lessonWord = (l, dir) => (/^\d/.test(l.n || '') ? `${dir < 0 ? 'Попередній урок' : 'Наступний урок'} ${l.n}` : `${dir < 0 ? 'Назад' : 'Далі'}: ${l.short || l.n || l.id}`);
  function hubEnd() {
    const talk = doc.getElementById('talk');
    const hub = $('.hub');
    if (!talk || !hub || $('.hub-end', hub)) return;
    injectCSS();
    const id = Study.lesson;
    const C = window.COURSE;
    const all = C && Array.isArray(C.modules) ? C.modules.flatMap((m) => m.lessons || []) : [];
    const order = all.filter(hubOk);
    const at = order.findIndex((l) => l.id === id);
    const prev = at > 0 ? order[at - 1] : null, next = at >= 0 ? order[at + 1] : null;
    const me = lessonInfo();
    let hasDeck = false;
    try { hasDeck = !!(window.StudyCards && StudyCards.decks().some((d) => d.id === id)); } catch { hasDeck = !!(me && me.cards); }
    const sec = h('section', { class: 'hub-end', 'aria-labelledby': 'hub-end-h' });
    sec.innerHTML = `<h2 id="hub-end-h">Кінець уроку${me ? ` ${esc(me.n || me.id)}` : ''}</h2>
      <ul class="hub-end-status"></ul>
      <div class="hub-end-btns">
        ${doc.getElementById('check') ? '<a class="btn primary" href="#check">Самоперевірка</a>' : ''}
        ${hasDeck ? `<a class="btn" href="${esc(base + 'cards/?deck=' + encodeURIComponent(id))}">Картки уроку</a>` : ''}
        ${prev ? `<a class="btn ghost he-prev" href="${esc(hubHref(prev))}" title="${esc(prev.title)}">← ${esc(lessonWord(prev, -1))}</a>` : ''}
        ${next ? `<a class="btn he-next" href="${esc(hubHref(next))}" title="${esc(next.title)}">${esc(lessonWord(next, 1))} →</a>` : ''}
        ${!next && !prev ? `<a class="btn ghost" href="${esc(base)}">← Карта курсу</a>` : ''}
      </div>`;
    talk.after(sec);
    const list = $('.hub-end-status', sec);
    const render = () => {
      const items = [];
      const wq = $$('#warmup .qz-q');
      const answered = (q) => /^(right|wrong)$/.test(q.dataset.state || '');
      if (wq.length) items.push(['Розминка', `${wq.filter(answered).length}/${wq.length}`, wq.every(answered)]);
      const ps = $$('.predict', hub);
      if (ps.length) items.push(['Прогнози', `${ps.filter((p) => p.dataset.done).length}/${ps.length}`, ps.every((p) => p.dataset.done)]);
      if (doc.getElementById('check')) {
        let rec = null;
        try { rec = (window.StudyQuiz ? StudyQuiz.scores() : store.get('study.quiz.v1', {}) || {})[id] || null; } catch { rec = null; }
        items.push(['Самоперевірка', rec && rec.total ? `найкраще ${rec.best}/${rec.total}` : 'ще не пройдено', !!(rec && rec.total && rec.best === rec.total)]);
      }
      if (hasDeck) {
        let txt = '';
        let done = false;
        try {
          const st = StudyCards.stats([id]);
          txt = st.due ? `${st.due} на повторення` : st.learned ? 'на сьогодні все' : 'ще не починали';
          done = !st.due && !!st.learned;
        } catch { txt = ''; }
        if (txt) items.push(['Картки', txt, done]);
      }
      list.innerHTML = items.map(([k, v, ok]) => `<li${ok ? ' class="ok"' : ''}><span class="he-k">${k}</span> <b>${esc(v)}</b></li>`).join('');
      list.hidden = !items.length;
      tocDone();
    };
    render();
    // Answers change the status: predicts, warm-up and self-check clicks, finished quizzes, flashcard grades.
    let t = 0;
    const later = () => { clearTimeout(t); t = setTimeout(render, 60); };
    doc.addEventListener('predicted', later);
    doc.addEventListener('quiz:done', later);
    doc.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('.predict, .quiz, .deck-mini')) later(); });
    addEventListener('storage', later);
    // The quizzes mount after study:ready and load their questions asynchronously.
    const wu = doc.getElementById('warmup');
    if (wu && window.MutationObserver) new MutationObserver(later).observe(wu, { childList: true, subtree: true });
    doc.addEventListener('study:ready', later, { once: true });
  }
  // TOC entries of sections whose predicts or quiz questions have been answered get .done.
  function tocDone() {
    $$('.hub section.hs[id]').forEach((s) => {
      const done = !!$('.predict[data-done], .qz-q[data-state="right"], .qz-q[data-state="wrong"]', s);
      $$(`.hub-toc a[href="#${CSS.escape(s.id)}"], .hub-mbar-sheet a[href="#${CSS.escape(s.id)}"]`).forEach((a) => {
        a.classList.toggle('done', done);
        let mark = $('.toc-done', a);
        if (done && !mark) a.append(h('span', { class: 'toc-done sr-only' }, ' · виконано'));
        else if (!done && mark) mark.remove();
      });
    });
  }

  /* ================================================================ comments (giscus) */
  const giscusTheme = () => (isDark() ? 'dark' : 'light');
  function comments(sel = '#talk') {
    const host = typeof sel === 'string' ? $(sel) : sel;
    if (!host || host._comments) return;
    host._comments = true;
    const box = h('div', { class: 'comments' });
    host.append(box);
    const g = window.COURSE && window.COURSE.giscus;
    if (!g || !g.repoId || !g.categoryId) {
      box.innerHTML = '<p class="fallback">Питання — у Slack <b>#help</b>. Обговорення під сторінкою з’явиться тут, щойно в репозиторії підключать GitHub Discussions.</p>';
      return;
    }
    const s = h('script', {
      src: 'https://giscus.app/client.js', async: true, crossorigin: 'anonymous',
      'data-repo': g.repo, 'data-repo-id': g.repoId, 'data-category': g.category, 'data-category-id': g.categoryId,
      'data-mapping': 'pathname', 'data-strict': '1', 'data-reactions-enabled': '1', 'data-emit-metadata': '0',
      'data-input-position': 'top', 'data-theme': giscusTheme(), 'data-lang': 'uk', 'data-loading': 'lazy',
    });
    box.append(s);
    onTheme(() => {
      const frame = $('iframe.giscus-frame', box);
      if (frame && frame.contentWindow) frame.contentWindow.postMessage({ giscus: { setConfig: { theme: giscusTheme() } } }, 'https://giscus.app');
    });
  }

  /* ================================================================ dual figure tabs */
  function dualInit(scope = doc) {
    $$('figure.dual', scope).forEach((fig) => {
      const views = $$(':scope > .view', fig);
      if (fig._tabs || views.length < 2) return;
      fig._tabs = true;
      const names = { sch: 'Схема', bb: 'Макетка' };
      const bar = h('div', { class: 'dual-tabs', role: 'tablist', 'aria-label': 'Вигляд' });
      const btns = views.map((v, i) => {
        if (!v.id) v.id = `dual-${Math.random().toString(36).slice(2, 8)}-${i}`;
        const b = h('button', { type: 'button', role: 'tab', 'aria-controls': v.id }, esc(v.dataset.label || names[v.dataset.view] || `Вигляд ${i + 1}`));
        b.addEventListener('click', () => select(i));
        bar.append(b);
        return b;
      });
      const select = (i) => {
        views.forEach((v, k) => v.classList.toggle('active', k === i));
        btns.forEach((b, k) => { b.setAttribute('aria-selected', String(k === i)); b.tabIndex = k === i ? 0 : -1; });
      };
      bar.addEventListener('keydown', (e) => {
        const i = btns.indexOf(doc.activeElement);
        if (i < 0 || !/^Arrow(Left|Right)$/.test(e.key)) return;
        const j = (i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length;
        select(j); btns[j].focus();
      });
      fig.prepend(bar);
      fig.classList.add('tabbed');
      select(0);
    });
  }

  /* ================================================================ boot */
  const Study = {
    base, $, $$, store, parseNum, tokens, onTheme, isDark, fitCanvas, sim, anim, switches, predict, tryInit, measure, exit, teacher,
    toc, cites, comments, copy, toast, fetchJSON, lessonInfo, dual: { init: dualInit },
    fmt: { num, si, date: fmtDate },
    reducedMotion: () => mqReduce.matches,
    isReady: false,
    ready(fn) { if (Study.isReady) fn(Study); else doc.addEventListener('study:ready', () => fn(Study), { once: true }); },
    get lesson() { return (doc.body && doc.body.dataset.lesson) || null; },
    get course() { return window.COURSE || null; },
  };
  window.Study = Study;

  // Containers whose engine script is missing (not deployed yet, or blocked) get a clear message.
  function markMissingEngines() {
    const miss = '<p class="missing">Цей блок ще не підключено. Спробуйте оновити сторінку пізніше.</p>';
    if (!window.StudyQuiz) $$('.quiz:empty').forEach((el) => { el.innerHTML = miss; });
    if (!window.StudyCards) $$('.deck-mini:empty').forEach((el) => { el.innerHTML = miss; });
  }

  function boot() {
    const steps = [mountTeacherButton, () => switches(), () => predict.init(), () => tryInit(), () => measure.init(), () => exit.init(), () => dualInit(), toc,
      () => { if (doc.getElementById('talk')) comments('#talk'); }, challengeInit, hubEnd];
    for (const fn of steps) { try { fn(); } catch (e) { console.error('Study init:', e); } }
    cites().catch((e) => console.error('Study.cites:', e));
    Study.isReady = true;
    doc.dispatchEvent(new CustomEvent('study:ready', { detail: Study }));
    // After page widgets have subscribed, re-apply saved predictions so their `predict` handlers run.
    try { predict.restore(); } catch (e) { console.error(e); }
    markMissingEngines();
  }
  // Deferred scripts run while readyState is already 'interactive', so readyState alone cannot tell whether
  // DOMContentLoaded is still ahead. Booting on a timer there could run before quiz.js / schem.js have loaded.
  const dclFired = () => {
    const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    return nav ? nav.domContentLoadedEventStart > 0 : doc.readyState === 'complete';
  };
  if (doc.readyState === 'loading' || !dclFired()) doc.addEventListener('DOMContentLoaded', boot, { once: true });
  else setTimeout(boot);
})();
