// review.js: «Повторення», the weekly interleaved review (docs/review/).
//
// Builds a 10-question stepper quiz from every lesson already held (COURSE: status 'ready', date ≤ today, has a quiz)
// and renders it with StudyQuiz.mount({ questions }), so it looks and behaves exactly like a lesson self-check.
// Picking: weighted sampling without replacement (seeded by the ISO week, so the mix is the same all week):
//   weight = age (oldest lesson ×2 … newest ×1) × lesson score (study.quiz.v1: 1 + share wrong in the last run)
//          × question history (unseen ×1,3; 1 + 2·wrong share, +2 if the last answer was wrong; right this week ×0,4).
// At most 2 questions per lesson (more only when few lessons exist), never two from one lesson in a row.
// «Ще 10» draws a new mix from the same week, avoiding questions already shown this week.
// Storage (Study.store, so it survives blocked storage for the visit): 'study.review.v1' =
//   { v: 1, hist: { "<qid>": { n, bad, last: 1|0, at } }, mix: { week, extra, ids, shown }, runs: [{ at, week, score, total, by }] }
// Only the first answer to each question of a mix is recorded; «Пройти ще раз» / «Повторити помилкові» are practice.
// Test hook: ?today=YYYY-MM-DD pretends it is that day (which lessons are held, which week).
(() => {
  'use strict';
  const KEY = 'study.review.v1';
  const N = 10;
  const MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  const doc = document;
  const $ = (s, r = doc) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n, one, few, many) => {
    const a = n % 10, b = n % 100;
    return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
  };
  const localISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dayMs = 864e5;
  const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / dayMs);

  const qp = new URLSearchParams(location.search);
  const TODAY = /^\d{4}-\d{2}-\d{2}$/.test(qp.get('today') || '') ? qp.get('today') : localISO();

  /* ---------------------------------------------------------------- ISO week */
  function isoWeek(iso) {
    const d = new Date(iso + 'T12:00:00');
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dow = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - dow); // Thursday of this week decides the year
    const y = t.getUTCFullYear();
    const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / dayMs + 1) / 7);
    const mon = new Date(d); mon.setDate(d.getDate() - (dow - 1));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { y, w, key: `${y}-W${String(w).padStart(2, '0')}`, mon, sun };
  }
  const rangeText = ({ mon, sun }) => (mon.getMonth() === sun.getMonth()
    ? `${mon.getDate()}–${sun.getDate()} ${MONTHS[sun.getMonth()]}`
    : `${mon.getDate()} ${MONTHS[mon.getMonth()]} – ${sun.getDate()} ${MONTHS[sun.getMonth()]}`);

  /* ---------------------------------------------------------------- seeded random (FNV-1a → mulberry32) */
  function seedOf(str) {
    let h = 2166136261 >>> 0;
    for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seedOf(seed);
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------------------------------------------------------- course */
  const hasQuiz = (l) => {
    const n = Number(l.quiz);
    if (l.quiz != null && l.quiz !== '' && Number.isFinite(n)) return n > 0;
    return l.deck !== false;
  };
  function heldLessons() {
    const C = window.COURSE;
    if (!C || !Array.isArray(C.modules)) return [];
    const out = [];
    for (const m of C.modules) for (const l of m.lessons || []) {
      if (l && l.id && l.status === 'ready' && l.date && l.date <= TODAY && hasQuiz(l)) out.push(l);
    }
    return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  /* ---------------------------------------------------------------- state */
  let S, state, blocked = false;
  function readState() {
    const raw = S.store.get(KEY, null);
    const st = raw && typeof raw === 'object' ? raw : {};
    return {
      v: 1,
      hist: st.hist && typeof st.hist === 'object' ? st.hist : {},
      mix: st.mix && typeof st.mix === 'object' && Array.isArray(st.mix.ids) ? st.mix : null,
      runs: Array.isArray(st.runs) ? st.runs.slice(-30) : [],
    };
  }
  function save() {
    const ok = S.store.set(KEY, state);
    if (!ok && !blocked) { blocked = true; $('#rv-blocked').hidden = false; }
  }

  /* ---------------------------------------------------------------- picking */
  function weigher(lessons, hist, scores) {
    const rank = new Map(lessons.map((l, i) => [l.id, i]));
    const n = lessons.length;
    return (q) => {
      const k = rank.has(q.lesson) ? rank.get(q.lesson) : n - 1;
      let w = n > 1 ? 2 - k / (n - 1) : 1; // oldest 2 … newest 1
      const s = scores[q.lesson];
      if (s && +s.total > 0 && Number.isFinite(+s.last)) w *= 1 + Math.max(0, 1 - s.last / s.total);
      const h = hist[q.id];
      if (!h || !h.n) w *= 1.3;
      else {
        w *= 1 + 2 * Math.min(1, (h.bad || 0) / h.n) + (h.last === 0 ? 2 : 0);
        if (h.last === 1 && h.at && daysBetween(h.at, TODAY) < 7) w *= 0.4;
      }
      return Math.max(w, 0.01);
    };
  }

  // Interleave: at each step take the lesson (≠ previous) with the most items left; ties broken by the seeded rng.
  function interleave(items, r) {
    const groups = new Map();
    for (const q of items) { if (!groups.has(q.lesson)) groups.set(q.lesson, []); groups.get(q.lesson).push(q); }
    const tie = new Map([...groups.keys()].map((k) => [k, r()]));
    const out = [];
    let prev = null;
    while (out.length < items.length) {
      const cands = [...groups.entries()].filter(([k, g]) => g.length && k !== prev);
      const pool = cands.length ? cands : [...groups.entries()].filter(([, g]) => g.length); // only one lesson left
      pool.sort((a, b) => b[1].length - a[1].length || tie.get(a[0]) - tie.get(b[0]));
      const [k, g] = pool[0];
      out.push(g.shift());
      prev = k;
    }
    return out;
  }

  function pick(pool, lessons, seed, exclude = new Set()) {
    const r = rng(seed);
    const w = weigher(lessons, state.hist, (window.StudyQuiz && StudyQuiz.scores()) || {});
    const nLessons = new Set(pool.map((q) => q.lesson)).size || 1;
    const cap = Math.max(2, Math.ceil(N / nLessons));
    // Efraimidis–Spirakis: key = u^(1/w), larger first; fresh (not shown this week) questions go first.
    const keyed = pool.map((q) => ({ q, key: Math.pow(r() || 1e-9, 1 / w(q)), fresh: !exclude.has(q.id) }))
      .sort((a, b) => (b.fresh - a.fresh) || (b.key - a.key));
    const per = new Map(), take = [];
    for (const { q } of keyed) {
      if (take.length >= N) break;
      const c = per.get(q.lesson) || 0;
      if (c >= cap) continue;
      per.set(q.lesson, c + 1);
      take.push(q);
    }
    return interleave(take, r);
  }

  /* ---------------------------------------------------------------- rendering helpers */
  const base = () => S.base;
  const hubHref = (l) => new URL(l.hub || `lessons/${l.id}/`, base()).href;
  const cardsHref = (id) => new URL(`cards/?deck=${encodeURIComponent(id)}`, base()).href;
  const lessonById = (id) => (S.lessonInfo ? S.lessonInfo(id) : null);
  const nOf = (id) => { const l = lessonById(id); return (l && l.n) || id.replace('-', '.'); };

  function histByLesson(lessons) {
    const byQ = new Map(allQs.map((q) => [q.id, q.lesson]));
    const agg = new Map(lessons.map((l) => [l.id, { ok: 0, n: 0, q: 0 }]));
    for (const [qid, h] of Object.entries(state.hist)) {
      const lid = byQ.get(qid);
      if (!lid || !agg.has(lid) || !h || !h.n) continue;
      const a = agg.get(lid);
      a.n += h.n; a.ok += h.n - (h.bad || 0); a.q += 1;
    }
    return agg;
  }

  function drawMap() {
    const box = $('#rv-map');
    const agg = histByLesson(held);
    const any = [...agg.values()].some((a) => a.n);
    if (!any) {
      box.innerHTML = '<p class="muted">Ще немає відповідей. Пройдіть мішанку вище, і тут з’явиться картина по уроках.</p>';
    } else {
      const rows = held.map((l) => {
        const a = agg.get(l.id);
        const pct = a.n ? Math.round((a.ok / a.n) * 100) : null;
        const st = pct == null ? 'none' : pct < 70 ? 'weak' : 'good';
        const label = st === 'none' ? 'ще не траплявся' : st === 'weak' ? 'слабке місце' : 'добре';
        return `<tr class="st-${st}">
          <th scope="row"><a href="${esc(hubHref(l))}"><span class="rv-n">${esc(l.n)}</span> ${esc(l.short || l.title)}</a></th>
          <td class="rv-bar-cell">${pct == null ? '<span class="muted">—</span>' : `<span class="rv-meter" aria-hidden="true"><span style="width:${pct}%"></span></span><span class="rv-pct">${pct}&nbsp;%</span>`}</td>
          <td class="rv-cnt">${a.n ? `${a.ok}/${a.n}` : '0'}</td>
          <td class="rv-st"><span class="rv-tag ${st}">${label}</span>${st === 'weak' ? ` <a href="${esc(cardsHref(l.id))}">картки</a>` : ''}</td>
        </tr>`;
      }).join('');
      box.innerHTML = `<div class="rv-scroll"><table class="rv-table">
        <caption class="sr-only">Правильні відповіді в повторенні по уроках</caption>
        <thead><tr><th scope="col">Урок</th><th scope="col">Правильно</th><th scope="col">Відповідей</th><th scope="col">Стан</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`;
    }
    const runs = state.runs.slice(-6).reverse();
    $('#rv-runs').innerHTML = runs.length ? `<p class="rv-runs-h">Останні мішанки</p><ul class="rv-runs-list">${runs.map((r) => {
      const d = new Date(r.at);
      const when = Number.isFinite(d.getTime()) ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : '';
      return `<li><span class="w">${esc(when)}</span> <b>${r.score}/${r.total}</b></li>`;
    }).join('')}</ul>` : '';
  }

  function drawResult(run) {
    const box = $('#rv-result');
    const by = new Map();
    run.ids.forEach((qid) => {
      const q = qById.get(qid);
      const a = run.answers.get(qid);
      if (!q || !a) return;
      if (!by.has(q.lesson)) by.set(q.lesson, { ok: 0, n: 0 });
      const x = by.get(q.lesson); x.n++; if (a.ok) x.ok++;
    });
    const order = held.map((l) => l.id).filter((id) => by.has(id));
    const weak = order.filter((id) => by.get(id).ok < by.get(id).n);
    const rows = order.map((id) => {
      const x = by.get(id), l = lessonById(id) || { id, n: nOf(id), title: id };
      const bad = x.ok < x.n;
      return `<li class="${bad ? 'weak' : 'ok'}">
        <span class="rv-dots" aria-hidden="true">${'●'.repeat(x.ok)}${'○'.repeat(x.n - x.ok)}</span>
        <span class="rv-l"><b>${esc(l.n)}</b> ${esc(l.short || l.title)}</span>
        <span class="rv-s">${x.ok}/${x.n}</span>
        ${bad ? `<span class="rv-go"><a href="${esc(cardsHref(id))}">Картки ${esc(l.n)}</a> · <a href="${esc(hubHref(l))}">Урок</a></span>` : ''}
      </li>`;
    }).join('');
    const weakLinks = weak.map((id) => `<a href="${esc(cardsHref(id))}">${esc(nOf(id))}</a>`);
    const weakText = weak.length === 1
      ? `<p class="rv-weak">Слабке місце: <b>${weakLinks[0]}</b> — повторіть картки цього уроку.</p>`
      : weak.length
        ? `<p class="rv-weak">Слабкі місця: <b>${weakLinks.join(', ')}</b> — повторіть картки цих уроків. Почніть з першого: старі теми забуваються швидше.</p>`
        : '<p class="rv-weak none">Цього разу без слабких місць. Наступна мішанка — у понеділок, або «Ще 10» вже зараз.</p>';
    box.innerHTML = `<h3>Підсумок по уроках</h3>${weakText}<ul class="rv-by">${rows}</ul>`;
    box.hidden = false;
  }

  /* ---------------------------------------------------------------- quiz run + answer recording */
  let held = [], allQs = [], qById = new Map(), run = null, observer = null;

  function record(qid, ok) {
    const h = state.hist[qid] && typeof state.hist[qid] === 'object' ? state.hist[qid] : { n: 0, bad: 0 };
    h.n = (h.n || 0) + 1;
    if (!ok) h.bad = (h.bad || 0) + 1;
    h.last = ok ? 1 : 0;
    h.at = TODAY;
    state.hist[qid] = h;
    save();
  }

  function watch(el) {
    if (observer) observer.disconnect();
    observer = new MutationObserver((muts) => {
      if (!run || !run.recording) return;
      for (const m of muts) {
        const box = m.target;
        if (!box.classList || !box.classList.contains('qz-q')) continue;
        const st = box.dataset.state;
        if (st !== 'right' && st !== 'wrong') continue;
        const cur = el.querySelector('.qz-dot[aria-current="step"]');
        const i = cur ? +cur.dataset.i : -1;
        const qid = run.ids[i];
        if (!qid || run.answers.has(qid)) continue;
        run.answers.set(qid, { ok: st === 'right' });
        record(qid, st === 'right');
      }
    });
    observer.observe(el, { subtree: true, attributes: true, attributeFilter: ['data-state'] });
    // The engine's own reruns are practice: stop recording until the next mix.
    el.addEventListener('click', (e) => {
      if (e.target.closest('.qz-again, .qz-again-wrong') && run) run.recording = false;
    }, true);
  }

  function onDone() {
    if (!run || !run.recording || run.done) return;
    run.done = true;
    const score = [...run.answers.values()].filter((a) => a.ok).length;
    const by = {};
    run.ids.forEach((qid) => {
      const q = qById.get(qid), a = run.answers.get(qid);
      if (!q || !a) return;
      by[q.lesson] = by[q.lesson] || [0, 0];
      by[q.lesson][1]++; if (a.ok) by[q.lesson][0]++;
    });
    state.runs.push({ at: new Date().toISOString(), week: week.key, score, total: run.ids.length, by });
    state.runs = state.runs.slice(-30);
    save();
    drawResult(run);
    drawMap();
  }

  async function start(ids, focus) {
    const qs = ids.map((id) => qById.get(id)).filter(Boolean);
    run = { ids: qs.map((q) => q.id), answers: new Map(), recording: true, done: false };
    $('#rv-result').hidden = true;
    $('#rv-result').innerHTML = '';
    const el = $('#rv-quiz');
    await StudyQuiz.mount(el, {
      questions: qs, mode: 'stepper', label: 'Повторення',
      title: `Мішанка тижня ${week.w}${state.mix.extra ? ` · №${state.mix.extra + 1}` : ''}`,
      onDone,
    });
    drawInfo();
    if (focus) {
      el.scrollIntoView({ behavior: S.reducedMotion() ? 'auto' : 'smooth', block: 'start' });
      const stem = el.querySelector('.qz-stem');
      if (stem) stem.focus({ preventScroll: true });
    }
  }

  function drawInfo() {
    const lessons = [...new Set(run.ids.map((id) => qById.get(id).lesson))];
    const first = held[0], last = held[held.length - 1];
    const span = held.length > 1 ? `${first.n}–${last.n}` : first.n;
    $('#rv-info').innerHTML = `Тиждень ${week.w} <span class="muted">(${esc(rangeText(week))})</span> · `
      + `${run.ids.length} ${plural(run.ids.length, 'питання', 'питання', 'питань')} з ${lessons.length} ${plural(lessons.length, 'уроку', 'уроків', 'уроків')} `
      + `<span class="muted">(усього пройдено ${held.length} ${plural(held.length, 'урок', 'уроки', 'уроків')}: ${esc(span)})</span>`;
  }

  let week;
  async function boot(Study) {
    S = Study;
    const info = $('#rv-info'), quizEl = $('#rv-quiz');
    try { localStorage.setItem('study.review.probe', '1'); localStorage.removeItem('study.review.probe'); }
    catch { blocked = true; $('#rv-blocked').hidden = false; }
    if (!window.StudyQuiz) {
      quizEl.innerHTML = '<div class="qz-msg"><p><b>Не вдалося запустити квіз.</b> Оновіть сторінку.</p></div>';
      info.textContent = '';
      return;
    }
    state = readState();
    week = isoWeek(TODAY);
    held = heldLessons();
    if (!held.length) {
      quizEl.innerHTML = '<div class="qz-msg"><p><b>Повторювати поки нічого.</b> Мішанка з’явиться після першого заняття з самоперевіркою.</p></div>';
      info.textContent = '';
      drawMap();
      return;
    }
    const qs = await StudyQuiz.load(held.map((l) => l.id));
    held = held.filter((l) => !qs.missing.includes(l.id));
    allQs = qs.slice();
    qById = new Map(allQs.map((q) => [q.id, q]));
    if (!allQs.length) {
      quizEl.innerHTML = `<div class="qz-msg"><p><b>Не вдалося завантажити питання.</b> ${location.protocol === 'file:' ? 'Відкрийте сайт через http:// (не file://).' : 'Оновіть сторінку або спробуйте пізніше.'}</p></div>`;
      info.textContent = '';
      return;
    }
    watch(quizEl);
    const mix = state.mix;
    const valid = mix && mix.week === week.key && mix.ids.length && mix.ids.every((id) => qById.has(id));
    if (!valid) {
      const ids = pick(allQs, held, `${week.key}|0`).map((q) => q.id);
      state.mix = { week: week.key, extra: 0, ids, shown: ids.slice() };
      save();
    }
    drawMap();
    await start(state.mix.ids, false);
    const more = $('#rv-more');
    more.disabled = false;
    more.addEventListener('click', async () => {
      const extra = (state.mix.extra || 0) + 1;
      const shown = new Set(state.mix.shown || state.mix.ids);
      const ids = pick(allQs, held, `${week.key}|${extra}`, shown).map((q) => q.id);
      ids.forEach((id) => shown.add(id));
      state.mix = { week: week.key, extra, ids, shown: [...shown] };
      save();
      await start(ids, true);
      S.toast(`Нова мішанка: ${ids.length} ${plural(ids.length, 'питання', 'питання', 'питань')}`);
    });
    // Reset: two-step inline confirm.
    const reset = $('#rv-reset'), msg = $('#rv-reset-msg');
    let armed = 0;
    reset.addEventListener('click', () => {
      if (!armed) {
        reset.textContent = 'Так, скинути';
        reset.classList.add('confirm');
        msg.textContent = 'Уся історія відповідей у «Повторенні» на цьому пристрої зникне.';
        armed = setTimeout(() => { armed = 0; reset.textContent = 'Скинути історію повторення'; reset.classList.remove('confirm'); msg.textContent = ''; }, 5000);
        return;
      }
      clearTimeout(armed); armed = 0;
      state.hist = {}; state.runs = [];
      save();
      reset.textContent = 'Скинути історію повторення';
      reset.classList.remove('confirm');
      msg.textContent = 'Історію скинуто.';
      drawMap();
    });
  }

  const go = () => window.Study.ready((St) => boot(St).catch((e) => {
    console.error('review:', e);
    $('#rv-quiz').innerHTML = '<div class="qz-msg"><p><b>Щось пішло не так.</b> Оновіть сторінку.</p></div>';
  }));
  if (window.Study) go();
  else doc.addEventListener('DOMContentLoaded', () => { if (window.Study) go(); }, { once: true });

  // For headless checks.
  window.StudyReview = { isoWeek, pick: (...a) => pick(...a), get state() { return state; }, get run() { return run; }, get held() { return held; }, get pool() { return allQs; } };
})();
