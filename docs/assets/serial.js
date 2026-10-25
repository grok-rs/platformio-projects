// serial.js: a tiny Web Serial link to the course's «Мій стенд» firmware (esp32-s3-site-bridge).
//
// Classic script, no dependencies; load it with `defer` after study.js. Defines window.BoardSerial:
//
//   BoardSerial.supported()           true when navigator.serial exists (Chrome / Edge on a computer, http(s) or localhost)
//   BoardSerial.UNSUPPORTED           the Ukrainian sentence to show otherwise
//   const link = BoardSerial.link()   one shared link per page (every caller gets the same object)
//   link.connect()                    asks for the port (picker; call it from a click) — resolves true / false
//   link.reconnect()                  opens a port this site was already allowed to use, no picker — true / false
//   link.disconnect()
//   link.on(type, fn) → off()         events: 'state' (state string), 'line' (raw text), 'msg' (any JSON object),
//                                     'hello' | 'adc' | 'btn' (the object, by its "t" field), 'error' (Ukrainian text)
//   link.state                        'idle' | 'connecting' | 'open' | 'demo'
//   link.hello                        the last hello object, or null
//   link.inject(text)                 feed text through the same parser (demo mode and tests): «{"t":"adc",…}\n…»
//   link.demo(on)                     a built-in fake board (light drifting, a button press every few seconds)
//   BoardSerial.control(el, opts)     a compact «Під'єднати мою плату» control for lesson labs (see below)
//
// The firmware writes one JSON object per line at 115200 baud over the board's native USB port (VID 0x303A):
//   {"t":"hello","fw":"site-bridge","ver":"1.0.0","lang":"cpp",…}   {"t":"adc","ms":…,"raw":…,"mv":…}
//   {"t":"btn","kind":"press|release|glitch","n":…,"us":…,"edges":…,"bounce_us":…,"missed":false,"at":[0,…]}
// Lines that are not JSON (a boot message, a panic) still arrive as 'line' events, so a raw log can show them.
(() => {
  'use strict';
  const ESPRESSIF_VID = 0x303a;
  const BAUD = 115200;
  const MAX_LINE = 4096; // a line longer than this without "\n" is noise (wrong baud, wrong port): dropped
  const UNSUPPORTED = 'Під’єднання плати працює в Chrome/Edge на комп’ютері. На телефоні й у Firefox/Safari його немає — там лишається модель.';
  const supported = () => typeof navigator !== 'undefined' && 'serial' in navigator && !!navigator.serial;

  function makeLink() {
    const fns = new Map();
    let port = null, reader = null, keep = false, buf = '', decoder = null, demoTimer = 0, demoT = 0;
    const link = {
      state: 'idle', hello: null, lastAdc: null,
      on(type, fn) {
        if (!fns.has(type)) fns.set(type, new Set());
        fns.get(type).add(fn);
        return () => fns.get(type).delete(fn);
      },
      connect, reconnect, disconnect, inject, demo,
      get connected() { return link.state === 'open' || link.state === 'demo'; },
    };
    const emit = (type, v) => (fns.get(type) || []).forEach((fn) => { try { fn(v); } catch (e) { console.error(e); } });
    const setState = (s) => { if (s === link.state) return; link.state = s; emit('state', s); };

    function handleLine(raw) {
      const text = raw.replace(/\r$/, '');
      if (!text.trim()) return;
      emit('line', text);
      if (text[0] !== '{') return;
      let m;
      try { m = JSON.parse(text); } catch { return; }
      if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
      if (m.t === 'hello') link.hello = m;
      if (m.t === 'adc') link.lastAdc = m;
      emit('msg', m);
      emit(m.t, m);
    }
    function inject(text) {
      buf += text;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) { handleLine(buf.slice(0, i)); buf = buf.slice(i + 1); }
      if (buf.length > MAX_LINE) buf = '';
    }

    async function open(p) {
      stopDemo();
      setState('connecting');
      try {
        await p.open({ baudRate: BAUD, bufferSize: 16384 });
      } catch (e) {
        setState('idle');
        emit('error', /already open|InvalidState/i.test(String(e && (e.name + e.message)))
          ? 'Порт уже відкрито в іншій вкладці або в моніторі PlatformIO. Закрийте монітор і спробуйте ще раз.'
          : 'Не вдалося відкрити порт. Перевірте кабель (роз’єм USB, не COM) і чи прошито esp32-s3-site-bridge.');
        return false;
      }
      // DTR/RTS low, like `monitor_dtr = 0 / monitor_rts = 0` in platformio.ini: the board keeps running (on some
      // systems it restarts once on open — harmless, it then sends a fresh hello).
      try { await p.setSignals({ dataTerminalReady: false }); await p.setSignals({ requestToSend: false }); } catch { /* not all drivers */ }
      port = p; keep = true; buf = ''; decoder = new TextDecoder();
      setState('open');
      readLoop(p);
      return true;
    }
    async function readLoop(p) {
      while (keep && p.readable) {
        reader = p.readable.getReader();
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) inject(decoder.decode(value, { stream: true }));
          }
        } catch (e) {
          // A framing/break error (the board restarted) is not fatal: take a new reader. A lost device ends the loop.
          if (e && e.name === 'NetworkError') keep = false;
        } finally {
          try { reader.releaseLock(); } catch { /* already released */ }
          reader = null;
        }
      }
      if (port === p) {
        try { await p.close(); } catch { /* closed by the device */ }
        if (keep) emit('error', 'Плата від’єдналася.');
        keep = false; port = null;
        if (link.state === 'open') setState('idle');
      }
    }

    async function connect() {
      if (!supported()) { emit('error', UNSUPPORTED); return false; }
      if (link.state === 'open') return true;
      let p;
      try {
        p = await navigator.serial.requestPort({ filters: [{ usbVendorId: ESPRESSIF_VID }] });
      } catch (e) {
        if (e && e.name === 'NotFoundError') emit('error', 'Порт не вибрано. Якщо у списку порожньо — під’єднайте кабель до роз’єму USB (не COM) і прошийте esp32-s3-site-bridge.');
        else emit('error', 'Браузер не дозволив під’єднатися до порту.');
        return false;
      }
      return open(p);
    }
    async function reconnect() {
      if (!supported() || link.state === 'open') return link.state === 'open';
      let ports = [];
      try { ports = await navigator.serial.getPorts(); } catch { return false; }
      const p = ports.find((x) => { try { return x.getInfo().usbVendorId === ESPRESSIF_VID; } catch { return false; } }) || ports[0];
      return p ? open(p) : false;
    }
    async function disconnect() {
      stopDemo();
      keep = false;
      const p = port; port = null;
      if (reader) { try { await reader.cancel(); } catch { /* gone */ } }
      if (p) { try { await p.close(); } catch { /* the read loop closes it */ } }
      setState('idle');
    }

    // ---- demo board: the same lines the firmware sends, generated here (no hardware, any browser)
    function stopDemo() { if (demoTimer) { clearInterval(demoTimer); demoTimer = 0; if (link.state === 'demo') setState('idle'); } }
    function demoBounce(press) {
      const at = [0];
      const n = press ? (Math.random() < 0.3 ? 2 : 0) : (Math.random() < 0.6 ? 2 + 2 * Math.floor(Math.random() * 3) : 0);
      for (let k = 0; k < n; k++) at.push(at[at.length - 1] + Math.round(4 + Math.random() * (k < 2 ? 400 : 120)));
      return at;
    }
    let demoPress = 0, demoRel = 0, demoDown = false, demoNext = 3;
    function demo(on = true) {
      if (!on) { stopDemo(); return; }
      if (link.state === 'open') return;
      stopDemo();
      demoT = 0;
      setState('demo');
      inject(JSON.stringify({ t: 'hello', fw: 'site-bridge', ver: '1.0.0', lang: 'demo', board: 'демо без плати', ldr_pin: 4, btn_pin: 21,
        adc_ms: 100, bits: 12, uref_mv: 3100, quiet_ms: 50, max_edges: 64, pressed: false, up_ms: 0 }) + '\n');
      demoTimer = setInterval(() => {
        demoT += 0.1;
        // room light drifting slowly, a «palm» dip around every 20 s, ADC noise of a few units
        const dip = Math.max(0, Math.cos((demoT % 20) / 20 * 2 * Math.PI) * 6 - 5);
        const v = Math.max(0.03, 2.35 + 0.25 * Math.sin(demoT / 6) - dip * 2.1);
        const mv = Math.round(v * 1000 + (Math.random() - 0.5) * 6);
        const raw = Math.max(0, Math.min(4095, Math.round(mv / 3100 * 4095 * (mv > 2600 ? 1 + (mv - 2600) / 9000 : 1) + (Math.random() - 0.5) * 18)));
        inject(JSON.stringify({ t: 'adc', ms: Math.round(demoT * 1000), raw, mv }) + '\n');
        if (demoT >= demoNext) {
          demoDown = !demoDown;
          const at = demoBounce(demoDown);
          inject(JSON.stringify({ t: 'btn', kind: demoDown ? 'press' : 'release', n: demoDown ? ++demoPress : ++demoRel,
            us: Math.round(demoT * 1e6), edges: at.length, bounce_us: at[at.length - 1], missed: false, at }) + '\n');
          demoNext = demoT + (demoDown ? 0.3 + Math.random() * 0.4 : 2.5 + Math.random() * 3);
        }
      }, 100);
    }
    if (supported()) {
      try { navigator.serial.addEventListener('disconnect', (e) => { if (port && e.target === port) disconnect().then(() => emit('error', 'Плата від’єдналася.')); }); } catch { /* old API */ }
    }
    return link;
  }

  let shared = null;
  const link = () => (shared ||= makeLink());

  // Compact control for a lesson lab: a switch-like button, a status chip and a one-line note.
  //   BoardSerial.control(el, { what: 'показання АЦП', onChange(live) {} })
  // `onChange(true)` when the board (or the demo) starts feeding the lab, `false` when the lab is back on the model.
  const CSS = `.bs-ctl{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px}
.bs-btn{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:8px 14px;border:1px solid var(--line-strong);border-radius:999px;background:var(--panel);color:var(--ink);font:600 14px var(--f-body);cursor:pointer}
.bs-btn:hover{border-color:var(--accent)}
.bs-btn[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
.bs-dot{width:10px;height:10px;border-radius:50%;border:2px solid currentColor;flex:none}
.bs-btn[aria-pressed="true"] .bs-dot{background:currentColor}
.bs-chip{padding:1px 9px;border:1px solid var(--hi);border-radius:999px;color:var(--hi-ink,var(--hi));font:600 13px/1.4 var(--f-mono);white-space:nowrap}
.bs-chip[data-s="live"]{border-color:var(--ok);color:var(--ok)}
.bs-chip[data-s="live"]::before{content:"● "}
.bs-note{flex:1 1 220px;min-width:0;font-size:14px;color:var(--muted)}`;
  function style() {
    if (document.getElementById('bs-style')) return;
    const s = document.createElement('style'); s.id = 'bs-style'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  function control(el, { what = 'дані', onChange = () => {}, demo: allowDemo = false } = {}) {
    const l = link();
    style();
    el.classList.add('bs-ctl');
    el.innerHTML = `<button type="button" class="bs-btn" aria-pressed="false"><span class="bs-dot" aria-hidden="true"></span><span class="bs-t">Під’єднати мою плату</span></button>
      <span class="bs-chip" data-s="model">модель</span>
      <span class="bs-note" aria-live="polite"></span>`;
    const btn = el.querySelector('.bs-btn'), chip = el.querySelector('.bs-chip'), note = el.querySelector('.bs-note');
    const live = () => l.connected;
    const paint = () => {
      const on = live();
      btn.setAttribute('aria-pressed', String(on));
      btn.querySelector('.bs-t').textContent = on ? 'Від’єднати плату' : 'Під’єднати мою плату';
      chip.dataset.s = on ? 'live' : 'model';
      chip.textContent = l.state === 'demo' ? 'демо' : on ? 'ваша плата' : l.state === 'connecting' ? 'під’єднуюсь…' : 'модель';
      if (on) note.textContent = l.state === 'demo' ? `Демо: ${what} з уявної плати.` : `${what[0].toUpperCase() + what.slice(1)} — з вашої плати.`;
    };
    let was = false;
    const offs = [l.on('state', () => { paint(); const now = live(); if (now !== was) { was = now; onChange(now); } }),
      l.on('error', (msg) => { note.textContent = msg; }),
      l.on('hello', (h) => { if (l.state === 'open') note.textContent = `${what[0].toUpperCase() + what.slice(1)} — з вашої плати (${h.board || 'ESP32-S3'}, ${h.fw || '?'} ${h.ver || ''}).`; })];
    btn.addEventListener('click', async () => {
      if (live()) { await l.disconnect(); note.textContent = 'Лабораторія знову на моделі.'; return; }
      if (!supported()) {
        if (allowDemo) { l.demo(true); return; }
        note.textContent = UNSUPPORTED; return;
      }
      if (!(await l.reconnect())) await l.connect();
    });
    if (!supported()) note.textContent = UNSUPPORTED;
    paint();
    if (live()) { was = true; onChange(true); }
    return { link: l, destroy() { offs.forEach((f) => f()); } };
  }

  window.BoardSerial = { supported, UNSUPPORTED, link, control, VID: ESPRESSIF_VID, BAUD };
})();
