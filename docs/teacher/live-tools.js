// live-tools.js: the «На дзвінку» section of the teacher page (#live).
//
//   Таймер активності  presets from the 120-min call template (window.TeacherCall, set by the page script from the
//                      same blocks as the timeline) and from the activity cards; big digits, start/pause, ±1 min,
//                      a silent end (three red pulses, «Час!», then overtime). Survives a reload (teacher.timer.v1).
//   Хто відповідає?    the teacher pastes the names once; a fair «bag» draw: no repeats until everyone in the round
//                      has answered, «Немає на дзвінку» skips someone for this round; names may carry a team
//                      (Ом / Вольт / Ампер / Фарад) and then show the team disc, and «Вибрати команду» draws teams.
//                      Names live only in this browser (teacher.picker.v1), never in the page or a request.
//   Режим проєктора    links for the chosen lesson: warm-up (?mode=projector / team), the lesson's «Знайди
//                      несправність» (#mistakes, which has its own «На проєктор» button) and the datasheet trainer.
// «На весь екран» uses the Fullscreen API when allowed, otherwise a fixed overlay; both are left with Esc.
// Storage goes through Study.store (try/catch, memory fallback), so blocked storage only loses the reload.
document.addEventListener('study:ready', () => {
  'use strict';
  const { $, $$, store } = Study;
  const doc = document;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rand = (n) => {
    try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; } catch { return Math.floor(Math.random() * n); }
  };
  const persistent = (() => { try { localStorage.setItem('teacher.probe', '1'); localStorage.removeItem('teacher.probe'); return true; } catch { return false; } })();

  /* ================================================================ projector view */
  const fsOK = !!(doc.fullscreenEnabled && Element.prototype.requestFullscreen);
  function proj(card, on) {
    card.classList.toggle('proj', on);
    const b = $('[data-proj]', card);
    b.setAttribute('aria-pressed', String(on));
    b.textContent = on ? 'Вийти (Esc)' : 'На весь екран';
    doc.documentElement.style.overflow = on ? 'hidden' : '';
    if (on) {
      if (fsOK && !doc.fullscreenElement) card.requestFullscreen().catch(() => { /* overlay stays */ });
      card.tabIndex = -1;
      card.focus({ preventScroll: true });
    } else {
      if (doc.fullscreenElement === card) doc.exitFullscreen().catch(() => {});
      card.removeAttribute('tabindex');
      b.focus({ preventScroll: true });
    }
  }
  $$('.lt-card').forEach((card) => {
    $('[data-proj]', card).addEventListener('click', () => proj(card, !card.classList.contains('proj')));
    card.addEventListener('keydown', (e) => {
      if (!card.classList.contains('proj')) return;
      if (e.key === 'Escape') { e.preventDefault(); proj(card, false); return; }
      if (e.target.closest('button, input, textarea, select, a')) return;
      const k = e.key.toLowerCase();
      if (card.id === 'timer' && (e.key === ' ' || k === 'r' || k === 'к')) { e.preventDefault(); if (e.key === ' ') go(); else reset(); }
      if (card.id === 'picker' && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); pick(); }
    });
  });
  doc.addEventListener('fullscreenchange', () => {
    if (!doc.fullscreenElement) $$('.lt-card.proj').forEach((c) => proj(c, false));
  });

  /* ================================================================ timer */
  const TK = 'teacher.timer.v1';
  const call = window.TeacherCall || null;
  const B = call ? call.blocks : [];
  const titleOf = (b) => (call ? call.title(b) : b[3]);
  const ACTS = [
    ['Водоспад у чаті', 1, 'ret'], ['Публічна пара: 2 × 60 с', 2, 'pi'], ['Показ команди', 3, 'oth'], ['Квиток на вихід', 3, 'exit'],
    ['Спринт на дошці', 5, 'board'], ['Міні-урок студента', 5, 'pi'], ['Перерва', 7, 'brk'], ['Галерея', 10, 'board'],
  ];
  const face = $('#tm-face'), digits = $('#tm-digits'), stateEl = $('#tm-state'), bar = $('#tm-bar'), goBtn = $('#tm-go');
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (ms, up = false) => { const s = up ? Math.floor(ms / 1000) : Math.ceil(ms / 1000); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
  const minWord = (m) => (Number.isInteger(m) ? m : String(m).replace('.', ',')) + ' хв';

  let T = store.get(TK, null);
  const valid = (t) => t && typeof t === 'object' && t.total > 0 && typeof t.label === 'string';
  if (!valid(T)) T = null;
  let timerId = 0;

  const remaining = () => (T.endAt ? T.endAt - Date.now() : T.left);
  const save = () => store.set(TK, T);

  function render() {
    const r = remaining();
    $('#tm-label').textContent = T.label;
    face.classList.toggle('done', r <= 0);
    face.classList.toggle('low', r > 0 && !!T.endAt && r <= Math.min(60000, T.total * 0.2));
    if (r > 0) {
      digits.textContent = fmt(r);
      digits.setAttribute('aria-label', `Залишилось ${fmt(r)}`);
      stateEl.textContent = T.endAt ? 'іде' : r >= T.total ? 'готово до старту' : 'пауза';
      bar.style.setProperty('--p', (r / T.total * 100).toFixed(2) + '%');
    } else {
      digits.textContent = 'Час!';
      digits.setAttribute('aria-label', 'Час вийшов');
      stateEl.textContent = (T.endAt ? 'понад час +' : 'зупинено, понад час +') + fmt(-r, true);
      bar.style.setProperty('--p', '0%');
    }
    goBtn.textContent = T.endAt ? '❚❚ Пауза' : r > 0 && r < T.total ? '▶ Продовжити' : r <= 0 ? '▶ Знову' : '▶ Старт';
    const n = T.idx != null && B[T.idx + 1];
    const next = $('#tm-next');
    next.hidden = !n;
    if (n) next.innerHTML = `<button type="button" class="btn sm ghost" id="tm-nx">Далі за сценарієм: ${esc(titleOf(n))} · ${n[1] - n[0]} хв</button>`;
    $$('#tm-blocks button, #tm-acts button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.key === T.key)));
  }
  function loop() {
    clearInterval(timerId);
    if (!T.endAt) return;
    timerId = setInterval(() => {
      if (!T.ended && remaining() <= 0) end();
      render();
    }, 250);
  }
  function end() {
    T.ended = true; save();
    face.classList.remove('flash'); void face.offsetWidth; face.classList.add('flash');
    setTimeout(() => face.classList.remove('flash'), 3000);
    $('#tm-say').textContent = `Час вийшов: ${T.label}`;
  }
  function go() {
    const r = remaining();
    if (T.endAt) { T.left = r; T.endAt = null; }
    else {
      if (r <= 0) { T.left = T.total; T.ended = false; }
      T.endAt = Date.now() + T.left;
      $('#tm-say').textContent = '';
    }
    save(); render(); loop();
  }
  function reset() {
    T.endAt = null; T.left = T.total; T.ended = false;
    face.classList.remove('flash');
    save(); render(); loop();
  }
  function bump(ms) {
    const r = remaining();
    if (r <= 0 && ms > 0) { // after the end, +1 хв gives one more minute and keeps going
      T.total = ms; T.left = ms; T.ended = false; T.endAt = Date.now() + ms;
    } else if (T.endAt) {
      T.endAt += ms; T.total = Math.max(T.total + ms, 1000);
    } else {
      T.left = Math.max(0, T.left + ms); T.total = Math.max(T.total + ms, T.left, 1000);
    }
    if (remaining() <= 0 && !T.ended) end();
    save(); render(); loop();
  }
  function preset(key, label, min, idx = null) {
    clearInterval(timerId);
    T = { key, label: `${label} · ${minWord(min)}`, total: Math.round(min * 60000), left: Math.round(min * 60000), idx, endAt: null, ended: false };
    face.classList.remove('flash');
    $('#tm-say').textContent = '';
    save(); render();
  }
  function drawPresets() {
    $('#tm-blocks').innerHTML = B.map((b, i) => `<li><button type="button" class="k-${b[2]}" data-key="b${i}" data-i="${i}" aria-pressed="false"><b>${b[0]}–${b[1]}</b>${esc(titleOf(b))} · ${b[1] - b[0]} хв</button></li>`).join('');
    $('#tm-blocks').closest('.tm-presets').querySelector('h4').hidden = !B.length;
    $('#tm-acts').innerHTML = ACTS.map((a, i) => `<li><button type="button" class="k-${a[2]}" data-key="a${i}" data-a="${i}" aria-pressed="false">${esc(a[0])} · <b>${a[1]} хв</b></button></li>`).join('');
  }
  const blockPreset = (i) => { const b = B[i]; preset('b' + i, titleOf(b), b[1] - b[0], i); };
  drawPresets();
  $('#tm-blocks').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) blockPreset(+b.dataset.i); });
  $('#tm-acts').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { const a = ACTS[+b.dataset.a]; preset('a' + b.dataset.a, a[0], a[1]); } });
  $('#tm-next').addEventListener('click', (e) => { if (e.target.closest('#tm-nx') && T.idx != null) { blockPreset(T.idx + 1); goBtn.focus(); } });
  $('#tm-set').addEventListener('click', () => {
    const v = parseFloat(String($('#tm-min').value).replace(',', '.'));
    if (!(v > 0 && v <= 180)) { Study.toast('Вкажіть від 0,5 до 180 хвилин', 'bad'); return; }
    preset('own', 'Свій час', Math.round(v * 2) / 2);
  });
  $('#tm-min').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#tm-set').click(); });
  goBtn.addEventListener('click', go);
  $('#tm-reset').addEventListener('click', reset);
  $('#tm-plus').addEventListener('click', () => bump(60000));
  $('#tm-minus').addEventListener('click', () => bump(-60000));
  // The day switch renames «Блок дня»: redraw the preset names after the page script has switched.
  $$('#day button').forEach((b) => b.addEventListener('click', () => setTimeout(() => { drawPresets(); if (T.idx != null && B[T.idx]) T.label = `${titleOf(B[T.idx])} · ${B[T.idx][1] - B[T.idx][0]} хв`; render(); })));

  if (!T) { if (B[1]) blockPreset(1); else preset('a0', ACTS[0][0], ACTS[0][1]); }
  else { if (T.endAt && remaining() <= 0) T.ended = true; render(); loop(); }

  /* ================================================================ picker */
  const PK = 'teacher.picker.v1';
  const TEAMS = { ohm: 'Ом', volt: 'Вольт', amp: 'Ампер', farad: 'Фарад' };
  const teamOf = (s) => {
    const w = String(s || '').trim().toLowerCase().replace(/^команда\s+/, '').replace(/[.:]+$/, '');
    if (/^(ом|ohm|ω)$/.test(w)) return 'ohm';
    if (/^(вольт|volt)$/.test(w)) return 'volt';
    if (/^(ампер|amp|ampere)$/.test(w)) return 'amp';
    if (/^(фарад|farad)$/.test(w)) return 'farad';
    return null;
  };
  // Lines: «Ім'я», «Ім'я — Ом», «Ім'я (Вольт)», «Ім'я, Ампер», «Ом:» (team for the following lines), «Фарад: А, Б».
  function parse(text) {
    const out = [], seen = new Set();
    let cur = null;
    for (const raw of String(text || '').split(/\r?\n/)) {
      let line = raw.trim();
      if (!line) continue;
      const head = line.match(/^([^:]+):\s*(.*)$/);
      if (head && teamOf(head[1])) { cur = teamOf(head[1]); line = head[2]; if (!line) continue; }
      else if (teamOf(line)) { cur = teamOf(line); continue; }
      let team = cur, names;
      const dash = line.match(/^(.+?)\s+[—–-]\s+(\S+)$/) || line.match(/^(.+?)\s*\(([^()]+)\)$/);
      if (dash && teamOf(dash[2])) { names = [dash[1]]; team = teamOf(dash[2]); }
      else {
        names = line.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
        if (names.length > 1 && teamOf(names[names.length - 1])) team = teamOf(names.pop());
      }
      for (let n of names) {
        n = n.replace(/\s+/g, ' ').slice(0, 60);
        if (n && !seen.has(n.toLowerCase()) && out.length < 80) { seen.add(n.toLowerCase()); out.push({ n, t: team }); }
      }
    }
    return out;
  }

  const P0 = { text: '', left: [], done: [], away: [], last: null, cur: null, tleft: [] };
  let S = store.get(PK, null);
  if (!S || typeof S !== 'object' || typeof S.text !== 'string') S = { ...P0 };
  for (const k of ['left', 'done', 'away', 'tleft']) if (!Array.isArray(S[k])) S[k] = [];
  let roster = parse(S.text);
  const teamOfName = (n) => (roster.find((r) => r.n === n) || {}).t || null;
  const teamsIn = () => [...new Set(roster.map((r) => r.t).filter(Boolean))];

  // Keep the round consistent with an edited list: drop removed names, add new ones to this round.
  function sync() {
    const names = roster.map((r) => r.n), has = new Set(names);
    S.done = S.done.filter((n) => has.has(n));
    S.away = S.away.filter((n) => has.has(n));
    const used = new Set([...S.done, ...S.away]);
    S.left = S.left.filter((n) => has.has(n) && !used.has(n));
    const inLeft = new Set(S.left);
    names.forEach((n) => { if (!used.has(n) && !inLeft.has(n)) S.left.push(n); });
    const tl = teamsIn();
    S.tleft = S.tleft.filter((t) => tl.includes(t));
    if (S.cur && S.cur.k === 'n' && !has.has(S.cur.v)) S.cur = null;
    if (S.cur && S.cur.k === 't' && !tl.includes(S.cur.v)) S.cur = null;
  }
  const savePk = () => store.set(PK, S);
  const namesWord = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'ім’я' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'імені' : 'імен');

  function renderPk(pop = false) {
    const nameEl = $('#pk-name'), teamEl = $('#pk-team'), pf = $('#pk-face');
    const c = S.cur;
    if (!roster.length) {
      nameEl.className = 'pk-name empty';
      nameEl.textContent = 'Додайте список групи нижче і натисніть «Вибрати».';
      teamEl.hidden = true;
    } else if (!c) {
      nameEl.className = 'pk-name empty';
      nameEl.textContent = 'Натисніть «Вибрати».';
      teamEl.hidden = true;
    } else {
      const t = c.k === 't' ? c.v : teamOfName(c.v);
      nameEl.className = 'pk-name';
      nameEl.textContent = c.k === 't' ? `Команда ${TEAMS[c.v]}` : c.v;
      teamEl.hidden = !t || c.k === 't';
      if (t) { teamEl.dataset.team = t; teamEl.textContent = TEAMS[t]; }
      if (c.k === 't') { teamEl.hidden = false; teamEl.dataset.team = t; teamEl.textContent = 'команда'; }
    }
    pf.classList.remove('pop');
    if (pop) { void pf.offsetWidth; pf.classList.add('pop'); }
    const eligible = roster.length - S.away.length;
    $('#pk-left').textContent = !roster.length ? 'Список порожній.'
      : `У колі лишилось ${S.left.length} з ${eligible}` + (S.away.length ? ` · немає на дзвінку: ${S.away.length}` : '');
    $('#pk-done').innerHTML = S.done.map((n) => {
      const t = teamOfName(n);
      return `<li${t ? ` class="team-disc" data-team="${t}"` : ''}>${esc(n)}</li>`;
    }).join('') + S.away.map((n) => `<li class="absent" title="немає на дзвінку">${esc(n)}</li>`).join('');
    $('#pk-away').disabled = !(c && c.k === 'n');
    $('#pk-team-go').hidden = teamsIn().length < 2;
    $('#pk-go').textContent = S.cur ? 'Наступний' : 'Вибрати';
  }
  function newRound(auto) {
    S.away = []; S.done = [];
    S.left = roster.map((r) => r.n);
    if (auto) Study.toast('Усі відповіли: починаємо нове коло');
  }
  function pick() {
    if (!roster.length) { $('#pk-edit').open = true; $('#pk-names').focus(); Study.toast('Спершу додайте імена в «Список групи»'); return; }
    if (!S.left.length) newRound(true);
    if (!S.left.length) { renderPk(); return; } // everyone is away
    // The first pick of a new round never repeats the last name of the previous one.
    const pool = S.done.length === 0 && S.left.length > 1 ? S.left.filter((n) => n !== S.last) : S.left;
    const n = pool[rand(pool.length)];
    S.left.splice(S.left.indexOf(n), 1);
    S.done.push(n);
    S.last = n; S.cur = { k: 'n', v: n };
    savePk(); renderPk(true);
  }
  function away() {
    if (!S.cur || S.cur.k !== 'n') return;
    const n = S.cur.v;
    S.done = S.done.filter((x) => x !== n);
    if (!S.away.includes(n)) S.away.push(n);
    S.cur = null;
    if (S.left.length) pick(); else { savePk(); renderPk(); }
  }
  function pickTeam() {
    const tl = teamsIn();
    if (tl.length < 2) return;
    if (!S.tleft.length) S.tleft = tl.filter((t) => tl.length < 2 || !(S.cur && S.cur.k === 't' && S.cur.v === t));
    const t = S.tleft.splice(rand(S.tleft.length), 1)[0];
    S.cur = { k: 't', v: t };
    savePk(); renderPk(true);
  }

  const ta = $('#pk-names');
  ta.value = S.text;
  $('#pk-edit').open = !roster.length;
  sync(); renderPk();
  $('#pk-go').addEventListener('click', pick);
  $('#pk-away').addEventListener('click', away);
  $('#pk-team-go').addEventListener('click', pickTeam);
  $('#pk-save').addEventListener('click', () => {
    S.text = ta.value;
    roster = parse(S.text);
    sync(); savePk(); renderPk();
    const tn = teamsIn().length;
    Study.toast(roster.length ? `Збережено: ${roster.length} ${namesWord(roster.length)}${tn ? `, команд: ${tn}` : ''}` : 'Список порожній');
  });
  $('#pk-round').addEventListener('click', () => { newRound(false); S.cur = null; S.tleft = []; savePk(); renderPk(); Study.toast('Нове коло'); });
  let wipeArm = 0;
  $('#pk-wipe').addEventListener('click', (e) => {
    const b = e.currentTarget;
    if (!wipeArm) {
      b.textContent = 'Так, стерти все';
      wipeArm = setTimeout(() => { wipeArm = 0; b.textContent = 'Стерти список'; }, 4000);
      return;
    }
    clearTimeout(wipeArm); wipeArm = 0; b.textContent = 'Стерти список';
    S = { ...P0, left: [], done: [], away: [], tleft: [] };
    store.del(PK);
    ta.value = ''; roster = [];
    renderPk(); Study.toast('Список стерто з цього браузера');
  });
  if (!persistent) {
    $('#pk-priv').innerHTML = '<p><b>Імена нікуди не надсилаються і не публікуються.</b> Сховище цього браузера зараз заблоковане (приватне вікно або налаштування), тому список діє, лише поки відкрита ця вкладка.</p>';
  }

  /* ================================================================ projector launcher */
  const C = window.COURSE;
  const lessons = C && Array.isArray(C.modules) ? C.modules.flatMap((m) => m.lessons || []).filter((l) => l && l.id && l.status !== 'planned') : [];
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
  const sel = $('#pj-lesson');
  // Default: today's lesson, else the next one with a date (the warm-up page's rule), else the latest published one.
  const def = (lessons.find((l) => l.date && l.date >= today) || lessons[lessons.length - 1] || {}).id;
  const dm = (iso) => (iso ? ` · ${iso.slice(8, 10)}.${iso.slice(5, 7)}` : '');
  sel.innerHTML = lessons.map((l) => `<option value="${esc(l.id)}"${l.id === def ? ' selected' : ''}>${esc(`${l.n} ${l.short}`)}${dm(l.date)}${l.date === today ? ' (сьогодні)' : ''}</option>`).join('');
  const hasHunt = (l) => !l.hub && l.deck !== false;
  function tiles() {
    const l = lessons.find((x) => x.id === sel.value);
    const box = $('#pj-tiles');
    if (!l) { box.innerHTML = '<li class="muted">Карта курсу не завантажилась: оновіть сторінку.</li>'; return; }
    const q = encodeURIComponent(l.id);
    const hub = '../' + (l.hub ? l.hub.replace(/#.*$/, '') : `lessons/${l.id}/`);
    const t = (cls, href, title, sub) => href
      ? `<li><a class="pj-tile ${cls}" href="${esc(href)}" target="_blank" rel="noopener"><b>${title}</b><span>${sub}</span></a></li>`
      : `<li><span class="pj-tile ${cls}" aria-disabled="true"><b>${title}</b><span>${sub}</span></span></li>`;
    box.innerHTML = [
      t('k-ret', `../warmup/?current=${q}&mode=projector`, `Розминка до уроку ${esc(l.n)}`, '5 питань з попередніх уроків: великий шрифт, таймер, голосування'),
      t('k-pi', `../warmup/?current=${q}&mode=team`, 'Командна розминка', 'Ті самі питання з рахунком команд (суботній квіз)'),
      hasHunt(l)
        ? t('k-build', `${hub}#mistakes`, `«Знайди несправність» · урок ${esc(l.n)}`, 'Розділ уроку з несправностями; у ньому кнопка «На проєктор»')
        : t('k-build', '', '«Знайди несправність»', `В уроці ${esc(l.n)} цього розділу немає: виберіть інший урок`),
      t('k-board', '../datasheets/', 'Тренажер даташитів', 'Справжні таблиці BC547B, 1N4007, ESP32-S3: хто знайде значення першим'),
    ].join('');
  }
  sel.addEventListener('change', tiles);
  tiles();
});
