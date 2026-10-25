/* cases/cases.js — «Справи групи»: the case editor, the share link and the solver.
   Classic script, `defer` after study.js, kit.js and cases/scenes.js. Runs on `study:ready`.

   LINK FORMAT (no server: the whole case lives in the URL hash)
     …/cases/#case=1.<base64url(UTF-8 JSON)>          «1» = format version; an unknown version is refused politely.
     JSON (compact keys): { t: template, f: fault id | 'mv', m: [element, −1 | 1] (only with 'mv'), ti: title, s: symptom,
                            o: [3 options], a: index of the right one, k: [3 element keys | ''] (option ↔ clickable part),
                            e: explanation, by: author }
   Everything decoded is checked against window.CaseScenes (template, fault, move, element keys) and limited (LIM); text is
   only ever inserted as text (textContent, or esc() before Study.hunt, which uses innerHTML). */
(function () {
  'use strict';
  const VERSION = 1, PREFIX = 'case=';
  const LIM = { ti: 70, s: 320, o: 120, e: 520, by: 40, hash: 6000 };
  const DRAFT = 'cases.draft.v1';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const escBr = (s) => esc(s).replace(/\n/g, '<br>');
  // control characters and bidi overrides out, newlines normalised, trimmed and cut to max
  const clean = (s, max, lines = false) => (typeof s === 'string' ? s : '')
    .replace(/\r\n?/g, '\n')
    .replace(lines ? /[\u0000-\u0009\u000B-\u001F\u007F‪-‮⁦-⁩]/g : /[\u0000-\u001F\u007F‪-‮⁦-⁩]/g, lines ? '' : ' ')
    .replace(/\n{3,}/g, '\n\n').trim().slice(0, max);

  /* ------------------------------------------------------------------ codec */
  function b64urlEncode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(s) {
    if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error('chars');
    let b = s.replace(/-/g, '+').replace(/_/g, '/');
    while (b.length % 4) b += '=';
    const bin = atob(b), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
  const fail = (msg) => { const e = new Error(msg); e.friendly = msg; throw e; };

  // raw object → a checked case (throws with .friendly on anything wrong)
  function validate(raw) {
    const S = window.CaseScenes;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('У посиланні немає даних справи.');
    const t = raw.t;
    if (typeof t !== 'string' || !Object.prototype.hasOwnProperty.call(S.T, t)) fail('Невідомий стенд у посиланні.');
    const tpl = S.T[t];
    let f = raw.f, m = null;
    if (f === 'mv') {
      const mm = raw.m;
      if (!Array.isArray(mm) || mm.length !== 2 || typeof mm[0] !== 'string' || !Object.prototype.hasOwnProperty.call(tpl.moves, mm[0]) ||
        !tpl.moves[mm[0]].includes(mm[1])) fail('Невідомий зсув деталі в посиланні.');
      m = [mm[0], mm[1]];
    } else if (typeof f !== 'string' || !Object.prototype.hasOwnProperty.call(tpl.faults, f)) fail('Невідома несправність у посиланні.');
    const o = Array.isArray(raw.o) ? raw.o.slice(0, 3).map((x) => clean(x, LIM.o)) : [];
    if (o.length !== 3 || o.some((x) => !x)) fail('У справі мають бути три непорожні варіанти відповіді.');
    const a = raw.a;
    if (!Number.isInteger(a) || a < 0 || a > 2) fail('Не позначено правильну відповідь.');
    const s = clean(raw.s, LIM.s, true);
    if (!s) fail('У справі немає симптому.');
    const keys = S.elKeys(t, f), seen = new Set();
    const k = [0, 1, 2].map((i) => {
      const v = Array.isArray(raw.k) ? raw.k[i] : '';
      if (typeof v !== 'string' || !keys.includes(v) || seen.has(v)) return '';
      seen.add(v); return v;
    });
    return { t, f, m, ti: clean(raw.ti, LIM.ti), s, o, a, k, e: clean(raw.e, LIM.e, true), by: clean(raw.by, LIM.by) };
  }
  function compact(c) {
    const out = { t: c.t, f: c.f };
    if (c.f === 'mv') out.m = c.m;
    if (c.ti) out.ti = c.ti;
    out.s = c.s; out.o = c.o; out.a = c.a;
    if (c.k.some(Boolean)) out.k = c.k;
    // the suggested explanation is not repeated in the link: an empty «e» means «the catalogue's text»
    const inf = window.CaseScenes.info(c.t, c.f, c.m);
    if (c.e && !(inf && clean(c.e, LIM.e, true) === inf.explain)) out.e = c.e;
    if (c.by) out.by = c.by;
    return out;
  }
  const encode = (c) => `${VERSION}.${b64urlEncode(JSON.stringify(compact(c)))}`;
  function decode(str) {
    if (typeof str !== 'string' || !str) fail('Посилання порожнє.');
    if (str.length > LIM.hash) fail('Посилання задовге: його, мабуть, склеїли з іншим текстом.');
    const dot = str.indexOf('.');
    const ver = dot > 0 ? str.slice(0, dot) : '';
    if (!/^\d{1,3}$/.test(ver)) fail('Посилання обрізане або пошкоджене.');
    if (+ver !== VERSION) fail(+ver > VERSION ? 'Цю справу зроблено новішою версією сторінки. Оновіть сторінку (Ctrl+F5) і відкрийте посилання ще раз.' : 'Невідома версія справи.');
    let json;
    try { json = b64urlDecode(str.slice(dot + 1)); } catch { fail('Посилання обрізане або пошкоджене: скопіюйте його повністю.'); }
    let raw;
    try { raw = JSON.parse(json); } catch { fail('Посилання обрізане або пошкоджене: скопіюйте його повністю.'); }
    return validate(raw);
  }
  const hashOf = () => { const h = location.hash.slice(1); return h.startsWith(PREFIX) ? h.slice(PREFIX.length).trim() : null; };
  const pageUrl = () => location.href.split('#')[0];
  const linkOf = (c) => `${pageUrl()}#${PREFIX}${encode(c)}`;
  const idOf = (str) => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

  /* ------------------------------------------------------------------ case → Study.hunt */
  function titleOf(c) {
    if (c.ti) return c.ti;
    const S = window.CaseScenes;
    return S.T[c.t].name;
  }
  function huntCase(c) {
    const S = window.CaseScenes, inf = S.info(c.t, c.f, c.m);
    return {
      title: titleOf(c),
      symptom: escBr(c.s),
      options: c.o.map(esc),
      answer: c.a,
      explain: escBr(c.e || (inf && inf.explain) || ''),
      build(stage) {
        const r = S.draw(stage, c.t, c.f, c.m);
        c.k.forEach((key, i) => {
          const n = key && r.el[key];
          if (!n) return;
          n.setAttribute('data-hunt', String(i));
          n.setAttribute('aria-label', S.T[c.t].els[key]);
        });
      },
    };
  }
  // a fresh .hunt element (Study.hunt runs once per element) inside host
  function mountHunt(host, c, key) {
    host.replaceChildren();
    const el = document.createElement('div');
    el.className = 'hunt cs-hunt';
    host.appendChild(el);
    Study.hunt(el, { key, cases: [huntCase(c)] });
    return el;
  }

  /* ------------------------------------------------------------------ discussion post */
  function postOf(c, url) {
    const S = window.CaseScenes, T = S.T[c.t];
    const L = [`**Справа групи: ${titleOf(c)}**`, '', `Стенд: ${T.name} (урок ${T.lesson}).`, `Симптом: ${c.s.replace(/\n+/g, ' ')}`, '', 'Що зламано?'];
    c.o.forEach((o, i) => L.push(`${i + 1}. ${o}`));
    L.push('', `Розкрийте справу на сайті: ${url}`, '',
      'Свою версію пишіть у коментарі під спойлером <details>, щоб не зіпсувати іншим. Хто розкрив — поставте реакцію під дописом.');
    if (c.by) L.push('', `Автор: ${c.by}`);
    return L.join('\n');
  }

  /* ================================================================== page */
  document.addEventListener('study:ready', () => {
    const S = window.CaseScenes;
    if (!S || !window.Kit) return;
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

    /* ---------------- solver (#case=…) */
    const solve = $('#solve');
    function showSolve() {
      const str = hashOf();
      if (str === null) { solve.hidden = true; solve.replaceChildren(); return; }
      solve.hidden = false;
      solve.replaceChildren();
      let c;
      try { c = decode(str); } catch (e) {
        const box = document.createElement('div');
        box.className = 'note warn cs-err';
        box.setAttribute('role', 'alert');
        box.setAttribute('data-label', 'Справу не відкрито');
        const p1 = document.createElement('p'); p1.textContent = e.friendly || 'Посилання пошкоджене.';
        const p2 = document.createElement('p');
        p2.append('Попросіть автора скопіювати посилання ще раз кнопкою «Скопіювати посилання», відкрийте один із ');
        const a1 = document.createElement('a'); a1.href = '#examples'; a1.textContent = 'прикладів'; p2.append(a1, ' або ');
        const a2 = document.createElement('a'); a2.href = '#new'; a2.textContent = 'створіть свою справу'; p2.append(a2, '.');
        box.append(p1, p2);
        solve.append(box);
        return;
      }
      const head = document.createElement('div');
      head.className = 'cs-solve-head';
      const ey = document.createElement('p'); ey.className = 'tag'; ey.textContent = 'Справа з посилання';
      const by = document.createElement('p'); by.className = 'cs-by';
      by.textContent = `${S.T[c.t].name} · урок ${S.T[c.t].lesson}` + (c.by ? ` · автор: ${c.by}` : '');
      head.append(ey, by);
      const host = document.createElement('div');
      const row = document.createElement('div'); row.className = 'btn-row';
      const cp = document.createElement('button'); cp.type = 'button'; cp.className = 'btn sm'; cp.textContent = 'Скопіювати посилання';
      cp.addEventListener('click', () => Study.copy(linkOf(c)));
      const ed = document.createElement('button'); ed.type = 'button'; ed.className = 'btn sm ghost'; ed.textContent = 'Змінити в редакторі';
      ed.addEventListener('click', () => { load(c); history.pushState(null, '', '#new'); solve.hidden = true; $('#new').scrollIntoView({ behavior: 'smooth' }); });
      const nw = document.createElement('a'); nw.className = 'btn sm ghost'; nw.href = '#new'; nw.textContent = 'Створити свою справу';
      row.append(cp, ed, nw);
      solve.append(head, host, row);
      mountHunt(host, c, 'c' + idOf(str));
    }
    addEventListener('hashchange', () => { showSolve(); if (hashOf() !== null) solve.scrollIntoView({ block: 'start' }); });

    /* ---------------- examples */
    $$('#examples a[data-case]').forEach((a) => {
      try {
        const c = decode(a.getAttribute('href').split('#' + PREFIX)[1] || '');
        const meta = a.closest('li') && a.closest('li').querySelector('.cs-ex-meta');
        if (meta) meta.textContent = `${S.T[c.t].name} · урок ${S.T[c.t].lesson}`;
      } catch (e) { console.error('cases: bad example link', e); }
    });

    /* ---------------- editor */
    const ed = {
      tpl: $('#ed-tpls'), fault: $('#ed-fault'), stage: $('#ed-stage'), cmp: $('#ed-cmp'), note: $('#ed-fault-note'),
      ti: $('#ed-ti'), s: $('#ed-s'), e: $('#ed-e'), by: $('#ed-by'), opts: $$('#ed-opts .cs-opt'),
      link: $('#ed-link'), post: $('#ed-post'), len: $('#ed-len'), msg: $('#ed-msg'), prev: $('#ed-preview'), open: $('#ed-open'),
    };
    // template cards
    ed.tpl.innerHTML = S.ORDER.map((t, i) => `<label class="cs-tpl"><input type="radio" name="ed-tpl" value="${t}"${i ? '' : ' checked'}>
      <span><b>${esc(S.T[t].name)}</b><small>урок ${esc(S.T[t].lesson)} · ${esc(S.T[t].about)}</small></span></label>`).join('');
    const tplNow = () => ($('input[name="ed-tpl"]:checked', ed.tpl) || {}).value || 'led';
    function fillFaults(t, sel) {
      const T = S.T[t];
      const fs = Object.entries(T.faults).map(([id, f]) => `<option value="${id}">${esc(f.label)}</option>`).join('');
      const mv = Object.entries(T.moves).flatMap(([k, ds]) => ds.map((d) => `<option value="mv:${k}:${d}">${esc(S.moveInfo(t, k, d).label)}</option>`)).join('');
      ed.fault.innerHTML = `<optgroup label="Несправність">${fs}</optgroup><optgroup label="Зсунути на один стовпчик">${mv}</optgroup>`;
      if (sel && $$('option', ed.fault).some((o) => o.value === sel)) ed.fault.value = sel;
    }
    const faultNow = () => {
      const v = ed.fault.value || '';
      if (v.startsWith('mv:')) { const [, k, d] = v.split(':'); return { f: 'mv', m: [k, +d] }; }
      return { f: v, m: null };
    };
    function fillLinks(t, f) {
      const keys = S.elKeys(t, f);
      ed.opts.forEach((row) => {
        const sel = $('select', row), cur = sel.value;
        sel.innerHTML = '<option value="">— без деталі —</option>' + keys.map((k) => `<option value="${k}">${esc(S.T[t].els[k])}</option>`).join('');
        if (keys.includes(cur)) sel.value = cur;
      });
    }
    // suggested texts replace a field only while the author has not changed the previous suggestion
    const sugg = new WeakMap();
    const suggest = (field, text) => {
      const prev = sugg.get(field);
      if (!field.value.trim() || field.value === prev) field.value = text;
      sugg.set(field, text);
    };
    function applySuggestions(force = false) {
      const t = tplNow(), { f, m } = faultNow(), inf = S.info(t, f, m);
      if (!inf) return;
      if (force) [ed.s, ed.e, ...ed.opts.map((r) => $('input[type="text"]', r))].forEach((x) => { x.value = ''; });
      suggest(ed.s, inf.sym);
      suggest(ed.e, inf.explain);
      // the right answer sits in a different slot for different faults, so it is not always «1»
      const keys = Object.keys(S.T[t].faults).concat(Object.keys(S.T[t].moves));
      const at = (keys.indexOf(f === 'mv' ? m[0] : f) + (m ? (m[1] > 0 ? 1 : 0) : 0)) % 3;
      const texts = [inf.wrong[0], inf.wrong[1]], links = [...inf.decoys];
      texts.splice(at, 0, inf.right); links.splice(at, 0, inf.el);
      const rightWasSuggested = ed.opts.every((r) => { const i = $('input[type="text"]', r); return !i.value.trim() || i.value === sugg.get(i); });
      ed.opts.forEach((row, i) => {
        suggest($('input[type="text"]', row), texts[i]);
        const sel = $('select', row), allowed = S.elKeys(t, f);
        if (rightWasSuggested || force) sel.value = allowed.includes(links[i]) ? links[i] : '';
      });
      if (rightWasSuggested || force) $$('input[type="radio"]', $('#ed-opts'))[at].checked = true;
    }
    function readCase() {
      const t = tplNow(), { f, m } = faultNow();
      const radios = $$('input[name="ed-right"]');
      return {
        t, f, m, ti: ed.ti.value, s: ed.s.value, e: ed.e.value, by: ed.by.value,
        o: ed.opts.map((r) => $('input[type="text"]', r).value),
        a: Math.max(0, radios.findIndex((r) => r.checked)),
        k: ed.opts.map((r) => $('select', r).value),
      };
    }
    function load(c) {
      const r = $(`input[name="ed-tpl"][value="${c.t}"]`, ed.tpl); if (r) r.checked = true;
      fillFaults(c.t, c.f === 'mv' ? `mv:${c.m[0]}:${c.m[1]}` : c.f);
      fillLinks(c.t, c.f);
      ed.ti.value = c.ti || ''; ed.s.value = c.s || ''; ed.e.value = c.e || ''; ed.by.value = c.by || '';
      ed.opts.forEach((row, i) => { $('input[type="text"]', row).value = c.o[i] || ''; $('select', row).value = c.k[i] || ''; });
      const rad = $$('input[name="ed-right"]'); if (rad[c.a]) rad[c.a].checked = true;
      [ed.s, ed.e, ...ed.opts.map((r2) => $('input[type="text"]', r2))].forEach((x) => sugg.set(x, null));
      redraw(); update();
    }
    // scene preview (the faulty bench, or the correct one with the switch on)
    function redraw() {
      const t = tplNow(), { f, m } = faultNow(), ok = ed.cmp.getAttribute('aria-checked') === 'true';
      ed.stage.replaceChildren();
      S.draw(ed.stage, t, ok ? 'mv' : f, ok ? null : m);
      const inf = S.info(t, f, m);
      ed.note.textContent = ok ? 'Так стенд виглядає без несправності. Учні побачать зламаний варіант.' : (inf ? `На малюнку: ${inf.label}.` : '');
    }
    let checked = null;
    function update() {
      const raw = readCase();
      [['#ed-s-n', ed.s, LIM.s], ['#ed-e-n', ed.e, LIM.e]].forEach(([id, x, max]) => { $(id).textContent = `${x.value.length} / ${max}`; });
      try { Study.store.set(DRAFT, compact({ ...raw, k: raw.k, o: raw.o })); } catch { /* per visit */ }
      try {
        checked = validate(JSON.parse(JSON.stringify(compact({ ...raw, s: raw.s, o: raw.o }))));
        const dup = new Set(checked.o.map((x) => x.toLowerCase())).size < 3;
        if (dup) throw Object.assign(new Error(), { friendly: 'Варіанти відповіді мають відрізнятися.' });
        const url = linkOf(checked);
        ed.link.value = url; ed.post.value = postOf(checked, url); ed.open.href = url;
        ed.len.textContent = `${url.length} символів`;
        ed.msg.textContent = ''; ed.msg.className = 'cs-msg';
        $$('[data-needs-case]').forEach((b) => { b.removeAttribute('aria-disabled'); });
      } catch (e) {
        checked = null;
        ed.link.value = ''; ed.post.value = ''; ed.open.removeAttribute('href'); ed.len.textContent = '';
        ed.msg.textContent = e.friendly ? `Ще не готово: ${e.friendly.replace('У справі', 'у справі').replace(/^./, (x) => x.toLowerCase())}` : 'Ще не готово.';
        ed.msg.className = 'cs-msg warn';
        $$('[data-needs-case]').forEach((b) => b.setAttribute('aria-disabled', 'true'));
      }
    }
    let tmr = 0;
    const later = () => { clearTimeout(tmr); tmr = setTimeout(update, 120); };

    ed.tpl.addEventListener('change', () => { fillFaults(tplNow()); fillLinks(tplNow(), faultNow().f); applySuggestions(true); redraw(); update(); });
    ed.fault.addEventListener('change', () => { fillLinks(tplNow(), faultNow().f); applySuggestions(); redraw(); update(); });
    ed.cmp.addEventListener('switch', redraw);
    $('#new').addEventListener('input', later);
    $('#new').addEventListener('change', later);
    const guard = (fn) => () => {
      update();
      if (!checked) { Study.toast(ed.msg.textContent || 'Заповніть справу', 'bad'); (ed.s.value.trim() ? $('#ed-opts input[type="text"]') : ed.s).focus(); return; }
      fn(checked);
    };
    $('#ed-copy').addEventListener('click', guard((c) => Study.copy(linkOf(c))));
    $('#ed-copy-post').addEventListener('click', guard((c) => Study.copy(postOf(c, linkOf(c)))));
    $('#ed-try').addEventListener('click', guard((c) => {
      ed.prev.hidden = false;
      // round trip through the link, so the preview is exactly what the group will open
      mountHunt($('.cs-prev-host', ed.prev), decode(encode(c)), 'preview');
      ed.prev.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    $('#ed-reset').addEventListener('click', () => {
      ed.ti.value = ''; // the author's name stays
      applySuggestions(true); update();
      Study.toast('Тексти повернуто до підказок');
    });
    ed.open.addEventListener('click', (e) => { if (!checked) { e.preventDefault(); guard(() => {})(); } });

    // start: draft or the first template
    let draft = null;
    try { const d = Study.store.get(DRAFT, null); if (d) draft = validate(d); } catch { draft = null; }
    if (draft) load(draft);
    else { fillFaults(tplNow()); fillLinks(tplNow(), faultNow().f); applySuggestions(true); redraw(); update(); }
    showSolve();
    if (hashOf() !== null) requestAnimationFrame(() => solve.scrollIntoView({ block: 'start' }));
  });

  window.Cases = { encode, decode, validate, LIM, VERSION };
})();
