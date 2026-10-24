// quiz.js: quiz engine for lesson hubs, the warm-up page and self-checks (design brief §3.3).
//
// Classic deferred script, loaded after study.js. Defines window.StudyQuiz and auto-mounts every `.quiz`
// element (unless it has data-manual) once Study is ready:
//   <div class="quiz" data-src="1-1" data-mode="stepper"></div>
//   <div class="quiz" data-mode="warmup" data-from="auto" data-n="3"></div>
//   <div class="quiz" data-mode="list" data-src="1-4" data-ids="1-4-q01,1-4-q05"></div>
// Modes: stepper (one at a time), list (all at once), warmup (list + «з уроку N» badges), present (projector).
// Data: docs/data/quiz/<lesson>.json (§2.4). Bad items are skipped with a console warning; a missing file is skipped.
// Scores: localStorage 'study.quiz.v1' = { "<lesson>": { best, total, last, at } } (stepper/list, full runs only).
(() => {
  'use strict';
  const doc = document;
  const NBSP = ' ';
  const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Є', 'Ж'];
  const LEVEL = { recall: 'Згадати', apply: 'Застосувати', concept: 'Розуміння' };
  const SCORES = 'study.quiz.v1';
  const self = doc.currentScript;

  /* ================================================================ small helpers */
  const S = () => window.Study || null;
  const base = () => (S() && S().base) || new URL('../', self ? self.src : location.href).href;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Data text may hold <b> <i> <sub> <sup> <br> <code> (no attributes); everything else is shown as text.
  const safe = (s) => esc(s).replace(/&lt;(\/?)(b|i|sub|sup|br|code)\s*\/?&gt;/gi, (m, c, t) => `<${c}${t.toLowerCase()}>`);
  const plain = (s) => String(s ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '');
  const $ = (sel, r = doc) => r.querySelector(sel);
  const $$ = (sel, r = doc) => Array.from(r.querySelectorAll(sel));
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const list = (v) => (Array.isArray(v) ? v : String(v ?? '').split(',')).map((x) => String(x).trim()).filter(Boolean);
  const num = (x, d = 2) => (S() ? S().fmt.num(x, d) : String(+x.toFixed(d)).replace('.', ',').replace('-', '−'));
  const parseN = (x) => (S() ? S().parseNum(x) : parseFloat(String(x).replace(',', '.').replace('−', '-')));

  const store = {
    get(k, fb) {
      if (S()) return S().store.get(k, fb);
      try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; }
    },
    set(k, v) {
      if (S()) return S().store.set(k, v);
      try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* per visit */ }
    },
  };
  const toast = (m, kind) => { if (S()) S().toast(m, kind); };
  const copyText = (t) => (S() ? S().copy(t) : navigator.clipboard.writeText(t).catch(() => {}));
  const fetchJSON = (path) => (S() ? S().fetchJSON(path, { quiet: true })
    : fetch(new URL(path, base())).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }));

  // Deterministic shuffle (FNV-1a seed → mulberry32), so screenshots and answer keys stay stable.
  function seedOf(str) {
    let h = 2166136261 >>> 0;
    for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, seed) {
    const a = arr.slice(), r = rng(seedOf(seed));
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const localISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  /* ================================================================ course manifest */
  function courseLessons() {
    const C = window.COURSE;
    if (!C || !Array.isArray(C.modules)) return null;
    const out = [];
    C.modules.forEach((m) => (m && Array.isArray(m.lessons) ? m.lessons : []).forEach((l) => { if (l && l.id) out.push(l); }));
    return out;
  }
  const lessonRec = (id) => (courseLessons() || []).find((l) => l.id === id) || null;
  // «1.4» for a lesson id; «демо» for the sample file.
  function lessonN(id) {
    const l = lessonRec(id);
    if (l && l.n) return l.n;
    if (!id || id.startsWith('_')) return 'демо';
    return /^\d+-\d+$/.test(id) ? id.replace('-', '.') : id;
  }
  // A lesson's quiz file is fetched only when COURSE says it exists, so nothing 404s: a positive quiz count wins
  // whatever the status or deck flag; with no count at all, a ready hub (not deck:false) is assumed to have one.
  const hasQuiz = (l) => {
    const n = Number(l.quiz);
    if (l.quiz != null && l.quiz !== '' && Number.isFinite(n)) return n > 0;
    return l.deck !== false && l.status === 'ready';
  };

  /* ================================================================ data loading + validation */
  function normQuestion(q, lesson, problems, where) {
    const bad = (msg) => { problems.push(`${where}: ${msg}`); return null; };
    if (!q || typeof q !== 'object') return bad('питання не є об’єктом');
    const id = typeof q.id === 'string' ? q.id.trim() : '';
    if (!id) return bad('немає id');
    if (typeof q.stem !== 'string' || !q.stem.trim()) return bad(`${id}: немає тексту питання (stem)`);
    const kind = q.kind || (Array.isArray(q.options) ? 'mcq' : q.answer ? 'numeric' : '');
    const str = (v) => (typeof v === 'string' && v.trim() ? v : '');
    const out = {
      id, kind, lesson: str(q.lesson) || lesson, stem: q.stem, level: LEVEL[q.level] ? q.level : null,
      warmup: q.warmup === true, mc: Array.isArray(q.mc) ? q.mc.filter((x) => typeof x === 'string') : str(q.mc) ? [q.mc] : [],
      img: str(q.img) || null, alt: str(q.alt), ref: str(q.ref) || null, why: str(q.why),
    };
    if (kind === 'mcq') {
      if (!Array.isArray(q.options) || q.options.length < 2) return bad(`${id}: потрібно щонайменше 2 варіанти`);
      const opts = q.options.map((o) => (typeof o === 'string' ? { t: o } : o));
      if (opts.some((o) => !o || typeof o.t !== 'string' || !o.t.trim())) return bad(`${id}: варіант без тексту (t)`);
      const oks = opts.filter((o) => o.ok === true).length;
      if (oks !== 1) return bad(`${id}: має бути рівно один правильний варіант (ok: true), а знайдено ${oks}`);
      if (opts.length > LETTERS.length) return bad(`${id}: забагато варіантів`);
      out.options = opts.map((o) => ({ t: o.t, ok: o.ok === true, why: str(o.why) }));
    } else if (kind === 'numeric') {
      const a = q.answer && typeof q.answer === 'object' ? q.answer : {};
      const v = typeof a.value === 'number' ? a.value : parseN(a.value);
      if (!Number.isFinite(v)) return bad(`${id}: немає числової відповіді (answer.value)`);
      const tol = Number.isFinite(+a.tol) && +a.tol >= 0 && a.tol !== null ? +a.tol : 0.02;
      out.answer = { value: v, tol, unit: str(a.unit), dec: Number.isInteger(a.dec) ? a.dec : 2 };
    } else {
      return bad(`${id}: невідомий тип «${kind}» (очікується mcq або numeric)`);
    }
    return out;
  }

  const fileCache = new Map();
  // One quiz file → { lesson, title, questions, problems }. Rejects only when the file is missing or unreadable.
  function loadFile(id) {
    if (fileCache.has(id)) return fileCache.get(id);
    const p = fetchJSON(`data/quiz/${encodeURIComponent(id)}.json`).then((data) => {
      const problems = [];
      if (!data || typeof data !== 'object' || !Array.isArray(data.questions)) {
        throw Object.assign(new Error(`quiz/${id}.json: немає масиву questions`), { friendly: true });
      }
      const lesson = typeof data.lesson === 'string' && data.lesson ? data.lesson : id;
      const seen = new Set();
      const questions = data.questions.map((q, i) => normQuestion(q, lesson, problems, `quiz/${id}.json #${i + 1}`))
        .filter((q) => {
          if (!q) return false;
          if (seen.has(q.id)) { problems.push(`quiz/${id}.json: id ${q.id} повторюється`); return false; }
          seen.add(q.id);
          return true;
        });
      if (problems.length) console.warn('StudyQuiz: пропущено питання\n' + problems.join('\n'));
      return { lesson, title: typeof data.title === 'string' ? data.title : '', questions, problems };
    });
    p.catch(() => fileCache.delete(id));
    fileCache.set(id, p);
    return p;
  }

  // Questions of several lessons in the given order; missing files are skipped.
  // The array also carries .problems (skipped items) and .missing (lesson ids that did not load).
  async function load(lessonIds) {
    const ids = list(lessonIds);
    const res = await Promise.all(ids.map((id) => loadFile(id).then((f) => ({ id, f }), (err) => ({ id, err }))));
    const out = [];
    out.problems = [];
    out.missing = [];
    out.titles = {};
    for (const { id, f, err } of res) {
      if (err) { out.missing.push(id); if (err.friendly) out.problems.push(err.message); continue; }
      out.titles[id] = f.title;
      out.problems.push(...f.problems);
      out.push(...f.questions);
    }
    return out;
  }

  // Lesson id from a question id: «1-4-q03» → «1-4».
  const lessonOfQ = (qid) => String(qid).replace(/-q\d+[a-z]?$/i, '');

  async function loadByIds(qids) {
    const ids = list(qids);
    const lessons = [...new Set(ids.map(lessonOfQ))];
    const all = await load(lessons);
    const byId = new Map(all.map((q) => [q.id, q]));
    const out = ids.map((id) => byId.get(id)).filter(Boolean);
    out.problems = all.problems;
    out.missing = ids.filter((id) => !byId.has(id));
    return out;
  }

  /* ================================================================ warm-up picker */
  // Default bucket sizes for n items: «1 last, 1 week, 1 old» for 3; «2 / 1 / 2» for 5.
  function mixFor(n) {
    if (n <= 1) return { last: 1, week: 0, old: 0 };
    if (n === 2) return { last: 1, week: 0, old: 1 };
    const week = Math.max(1, Math.round(n * 0.2));
    const last = Math.max(1, Math.round((n - week) / 2));
    return { last, week, old: n - week - last };
  }
  function parseMix(s) {
    if (!s) return null;
    if (typeof s === 'object') return s;
    const out = {};
    for (const part of String(s).split(',')) {
      const [k, v] = part.split(':').map((x) => x.trim());
      if (['last', 'week', 'old'].includes(k) && Number.isFinite(+v) && +v >= 0) out[k] = Math.min(20, Math.round(+v));
    }
    return Object.keys(out).length ? out : null;
  }

  // Earlier lessons that have quizzes, nearest first. With COURSE: by course order before `current`.
  // Without COURSE: the `src` list, read as chronological (last item = most recent).
  function earlierLessons(current, src) {
    const all = courseLessons();
    if (all) {
      const at = current ? all.findIndex((l) => l.id === current) : -1;
      const before = at >= 0 ? all.slice(0, at) : current ? [] : all;
      return before.filter(hasQuiz).map((l) => l.id).reverse();
    }
    return list(src).filter((id) => id !== current).reverse();
  }

  /**
   * Spiral warm-up: last = the 1–2 lessons before current, week = 3–5 back, old = anything older.
   * Only warmup:true items; a short bucket is filled from the others. Same seed → same picks (default: today + current).
   */
  async function pickWarmup({ current = S() && S().lesson, n, mix, src, seed } = {}) {
    let m = parseMix(mix);
    const want = Number.isFinite(+n) && +n > 0 ? Math.round(+n) : m ? (m.last || 0) + (m.week || 0) + (m.old || 0) : 5;
    m = m || mixFor(want);
    const lessons = earlierLessons(current, src);
    const out = [];
    out.lessons = lessons;
    out.missing = [];
    if (!lessons.length) return out;
    const qs = await load(lessons);
    out.missing = qs.missing;
    const present = lessons.filter((id) => !qs.missing.includes(id));
    const rank = new Map(present.map((id, k) => [id, k])); // 0 = most recent lesson with data
    const bucketOf = (q) => {
      const k = rank.has(q.lesson) ? rank.get(q.lesson) : rank.get(lessonOfQ(q.id));
      return k == null ? 'old' : k < 2 ? 'last' : k < 5 ? 'week' : 'old';
    };
    const s = seed ?? `${localISO()}|${current || ''}`;
    let pool = qs.filter((q) => q.warmup);
    if (!pool.length) pool = qs.slice(); // a lesson set without warm-up flags still gives a warm-up
    const buckets = { last: [], week: [], old: [] };
    shuffle(pool, s).forEach((q) => buckets[bucketOf(q)].push(q));
    const take = { last: [], week: [], old: [] };
    for (const b of ['last', 'week', 'old']) take[b] = buckets[b].splice(0, m[b] || 0);
    let short = want - take.last.length - take.week.length - take.old.length;
    for (const b of ['week', 'old', 'last']) {
      while (short > 0 && buckets[b].length) { take[b].push(buckets[b].shift()); short--; }
    }
    // Interleave so consecutive items come from different lessons where possible.
    const max = Math.max(take.last.length, take.week.length, take.old.length);
    for (let i = 0; i < max; i++) for (const b of ['last', 'week', 'old']) if (take[b][i]) out.push({ ...take[b][i], bucket: b });
    return out;
  }

  /* ================================================================ checking */
  // Options in a stable shuffled order: [{t, ok, why, orig}].
  const viewOptions = (q, doShuffle = true) => {
    const opts = q.options.map((o, i) => ({ ...o, orig: i }));
    return doShuffle ? shuffle(opts, q.id) : opts;
  };
  // Parses the learner's number in the task's unit. «13,6», «13,6 мА» and «0,0136 А» all work for unit мА.
  function readNumeric(q, text) {
    const unit = q.answer.unit;
    let raw = String(text ?? '').trim();
    if (unit && raw.toLowerCase().endsWith(unit.toLowerCase())) raw = raw.slice(0, -unit.length).trim();
    let v = parseN(raw);
    if (!Number.isFinite(v)) return NaN;
    if (unit && /[^\d\s.,+\-−eE]/.test(raw)) {
      const f = parseN('1 ' + unit);
      if (Number.isFinite(f) && f > 0) v /= f;
    }
    return v;
  }
  function checkNumeric(q, text) {
    const v = readNumeric(q, text);
    if (!Number.isFinite(v)) return null;
    const { value, tol } = q.answer;
    return value === 0 ? Math.abs(v) <= tol : Math.abs(v - value) <= Math.abs(value) * tol + 1e-12;
  }
  const answerText = (q) => `${num(q.answer.value, q.answer.dec)}${q.answer.unit ? NBSP + q.answer.unit : ''}`;

  function saveScore(lesson, score, total) {
    const all = store.get(SCORES, {}) || {};
    const prev = all[lesson] && typeof all[lesson] === 'object' ? all[lesson] : {};
    all[lesson] = { best: Math.max(+prev.best || 0, score), total, last: score, at: new Date().toISOString() };
    store.set(SCORES, all);
    return all[lesson];
  }
  const scores = () => store.get(SCORES, {}) || {};

  /* ================================================================ shared markup */
  const refLink = (q) => (q.ref ? `<a class="qz-ref" href="${esc(new URL(q.ref, base()).href)}">Перечитати в уроці →</a>` : '');
  const imgHTML = (q) => (q.img ? `<img class="qz-img" src="${esc(new URL(q.img, base()).href)}" alt="${esc(q.alt)}" loading="lazy">` : '');
  function metaHTML(q, i, total, badge) {
    const parts = [];
    if (total > 1) parts.push(`<span class="qz-count">${i + 1}${NBSP}/${NBSP}${total}</span>`);
    if (q.level) parts.push(`<span class="qz-badge lvl-${q.level}">${LEVEL[q.level]}</span>`);
    if (badge) parts.push(`<span class="qz-badge from">з уроку ${esc(lessonN(q.lesson))}</span>`);
    if (q.mc.length) parts.push(`<span class="qz-badge mc t-only" title="Коди помилкових уявлень">${esc(q.mc.join(' · '))}</span>`);
    return `<div class="qz-meta">${parts.join('')}</div>`;
  }
  function questionHTML(q, i, total, { badge = false, immediate = false } = {}) {
    const head = `${metaHTML(q, i, total, badge)}<div class="qz-stem" id="${esc(q.uid)}-stem" tabindex="-1">${safe(q.stem)}</div>${imgHTML(q)}`;
    if (q.kind === 'mcq') {
      const opts = q.view.map((o, k) => `<button type="button" class="qz-opt" data-k="${k}" aria-pressed="false">
          <span class="k" aria-hidden="true">${LETTERS[k]}</span><span class="t">${safe(o.t)}</span></button>`).join('');
      return `${head}<div class="qz-opts" role="group" aria-labelledby="${esc(q.uid)}-stem">${opts}</div>
        ${immediate ? '' : '<div class="qz-actions"><button type="button" class="btn primary qz-check" disabled>Перевірити</button></div>'}
        <div class="qz-fb" aria-live="polite"></div>`;
    }
    const unit = q.answer.unit;
    return `${head}<div class="qz-numrow">
        <input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" class="qz-input" aria-label="Ваша відповідь${unit ? ', ' + esc(unit) : ''}" placeholder="число">
        ${unit ? `<span class="qz-unit">${esc(unit)}</span>` : ''}
        <button type="button" class="btn primary qz-check">Перевірити</button></div>
      <p class="qz-hint">Кома чи крапка — неважливо.${unit ? ` Можна дописати одиницю «${esc(unit)}».` : ''}</p>
      <div class="qz-fb" aria-live="polite"></div>`;
  }

  // Marks an answered question inside `box` and writes the explanation. a = {choice?, value?, ok}.
  function showResult(box, q, a) {
    box.dataset.state = a.ok ? 'right' : 'wrong';
    const fb = $('.qz-fb', box);
    if (q.kind === 'mcq') {
      $$('.qz-opt', box).forEach((b, k) => {
        const o = q.view[k];
        b.disabled = true;
        b.setAttribute('aria-pressed', String(k === a.choice));
        b.classList.toggle('right', o.ok);
        b.classList.toggle('wrong', k === a.choice && !o.ok);
        b.classList.toggle('dim', !o.ok && k !== a.choice);
        if (!$('.why', b) && o.why) b.insertAdjacentHTML('beforeend', `<span class="why">${safe(o.why)}</span>`);
        if (!$('.mark', b) && (o.ok || k === a.choice)) {
          b.insertAdjacentHTML('beforeend', `<span class="mark">${o.ok ? (k === a.choice ? '✓ ваша відповідь' : '✓ правильна') : '✗ ваша відповідь'}</span>`);
        }
      });
      const chk = $('.qz-check', box);
      if (chk) chk.remove();
      fb.className = `qz-fb ${a.ok ? 'ok' : 'no'}`;
      fb.innerHTML = `<b>${a.ok ? 'Так!' : 'Не зовсім.'}</b> ${a.ok ? 'Пояснення під кожним варіантом.' : 'Правильна відповідь позначена ✓; гляньте, чому інші не підходять.'}${q.why ? ` <span class="txt">${safe(q.why)}</span>` : ''} ${refLink(q)}`;
    } else {
      const inp = $('.qz-input', box);
      inp.value = a.value;
      inp.readOnly = true;
      inp.classList.add(a.ok ? 'ok' : 'no');
      const chk = $('.qz-check', box);
      if (chk) chk.remove();
      fb.className = `qz-fb ${a.ok ? 'ok' : 'no'}`;
      fb.innerHTML = `<b>${a.ok ? 'Так!' : 'Ні.'}</b> Відповідь: <b class="num">${answerText(q)}</b>.${q.why ? ` <span class="txt">${safe(q.why)}</span>` : ''} ${refLink(q)}`;
    }
  }

  function scoreWord(score, total) {
    const r = total ? score / total : 0;
    if (r >= 0.9) return 'Чудово: ви це знаєте. Наступного разу — через кілька днів, щоб закріпити.';
    if (r >= 0.7) return 'Добре. Перегляньте помилкові питання: саме вони найкраще вчать.';
    return 'Помилки на самоперевірці — це і є тренування. Перечитайте розділи за посиланнями і повторіть помилкові.';
  }
  function ringSVG(score, total) {
    const r = 34, c = 2 * Math.PI * r, p = total ? score / total : 0;
    return `<svg class="qz-ring" viewBox="0 0 84 84" role="img" aria-label="Правильно ${score} з ${total}">
      <circle cx="42" cy="42" r="${r}" class="bg"/>
      ${p > 0 ? `<circle cx="42" cy="42" r="${r}" class="fg" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 42 42)"/>` : ''}
      <text x="42" y="47" text-anchor="middle">${score}/${total}</text></svg>`;
  }

  /* ================================================================ stepper + list + warmup */
  let uidN = 0;
  const prep = (qs, ctx) => qs.map((q) => ({ ...q, uid: `qz${++uidN}`, view: q.kind === 'mcq' ? viewOptions(q, ctx.shuffleOptions !== false) : null }));

  function resultLabel(ctx) {
    if (ctx.label) return ctx.label;
    const ids = ctx.src;
    if (ids.length === 1) return ids[0].startsWith('_') ? 'Демо-квіз' : /^\d/.test(lessonN(ids[0])) ? `Урок ${lessonN(ids[0])}` : lessonN(ids[0]);
    return ctx.mode === 'warmup' ? 'Розминка' : 'Самоперевірка';
  }

  function finish(root, ctx, answers, qs, rerun) {
    const total = qs.length, score = qs.filter((q) => answers.get(q.id)?.ok).length;
    const full = !ctx.subset && ctx.src.length === 1 && !ctx.ids && ctx.mode !== 'warmup';
    const rec = full ? saveScore(ctx.src[0], score, total) : null;
    const wrong = qs.filter((q) => !answers.get(q.id)?.ok);
    const end = doc.createElement('div');
    end.className = 'qz-end';
    end.innerHTML = `${ringSVG(score, total)}
      <div class="qz-end-text">
        <p class="qz-end-h">${ctx.mode === 'warmup' ? 'Розминку завершено' : 'Результат'}</p>
        <p>${scoreWord(score, total)}</p>
        ${rec ? `<p class="small">Найкращий результат у цьому браузері: <b>${rec.best}/${rec.total}</b>.</p>` : ''}
        ${wrong.length ? `<ul class="qz-wrong">${wrong.map((q) => `<li>${esc(plain(q.stem)).slice(0, 110)}${plain(q.stem).length > 110 ? '…' : ''} ${refLink(q)}</li>`).join('')}</ul>` : ''}
        <div class="qz-actions">
          ${wrong.length ? `<button type="button" class="btn primary qz-again-wrong">Повторити помилкові (${wrong.length})</button>` : ''}
          <button type="button" class="btn qz-again">Пройти ще раз</button>
          <button type="button" class="btn ghost qz-copy">Скопіювати результат</button>
        </div>
      </div>`;
    $('.qz-again-wrong', end)?.addEventListener('click', () => rerun(wrong, true));
    $('.qz-again', end).addEventListener('click', () => rerun(ctx.all, false));
    $('.qz-copy', end).addEventListener('click', () => copyText(`${resultLabel(ctx)} · ${score}/${total}`));
    root.dispatchEvent(new CustomEvent('quiz:done', { bubbles: true, detail: { lesson: ctx.src.length === 1 ? ctx.src[0] : ctx.src, score, total, mode: ctx.mode } }));
    if (typeof ctx.onDone === 'function') { try { ctx.onDone({ score, total, wrong: wrong.map((q) => q.id) }); } catch (e) { console.error(e); } }
    return end;
  }

  function headHTML(ctx, qs) {
    const t = ctx.title || (ctx.mode === 'warmup' ? `Розминка: ${qs.length} ${plural(qs.length, 'питання', 'питання', 'питань')} з попередніх уроків` : 'Самоперевірка');
    return `<div class="qz-head"><span class="qz-title">${esc(t)}</span>${ctx.mode === 'stepper' ? '<div class="qz-dots" role="group" aria-label="Перехід між питаннями"></div>' : ''}</div>`;
  }
  const plural = (n, one, few, many) => {
    const a = n % 10, b = n % 100;
    return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
  };

  // Wires answering inside one question box. onAnswer(a) is called once.
  function wireQuestion(box, q, immediate, onAnswer) {
    let choice = null;
    const commit = () => {
      if (box.dataset.state && box.dataset.state !== 'open') return;
      let a;
      if (q.kind === 'mcq') {
        if (choice === null) return;
        a = { choice, ok: !!q.view[choice].ok };
      } else {
        const inp = $('.qz-input', box);
        const ok = checkNumeric(q, inp.value);
        if (ok === null) {
          const fb = $('.qz-fb', box);
          fb.className = 'qz-fb';
          fb.textContent = 'Введіть число, наприклад «13,6».';
          inp.focus();
          return;
        }
        a = { value: inp.value.trim(), ok };
      }
      showResult(box, q, a);
      onAnswer(a);
    };
    box.dataset.state = 'open';
    $$('.qz-opt', box).forEach((b) => b.addEventListener('click', () => {
      if (box.dataset.state !== 'open') return;
      choice = +b.dataset.k;
      $$('.qz-opt', box).forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
      const chk = $('.qz-check', box);
      if (chk) chk.disabled = false;
      if (immediate) commit();
    }));
    $('.qz-check', box)?.addEventListener('click', commit);
    $('.qz-input', box)?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
    return {
      select(k) { const b = $$('.qz-opt', box)[k]; if (b && !b.disabled) b.click(); },
      commit,
    };
  }

  function runStepper(root, ctx, qsIn, subset) {
    const qs = prep(qsIn, ctx);
    ctx.subset = subset;
    const answers = new Map();
    let cur = 0, ctl = null;
    root.innerHTML = `<div class="qz" data-mode="stepper">${headHTML(ctx, qs)}<div class="qz-body"></div></div>`;
    const body = $('.qz-body', root), dots = $('.qz-dots', root);
    const rerun = (set, sub) => runStepper(root, ctx, set, sub);

    const drawDots = () => {
      dots.innerHTML = qs.map((q, i) => {
        const a = answers.get(q.id);
        const st = a ? (a.ok ? 'right' : 'wrong') : '';
        const lab = `Питання ${i + 1}${a ? (a.ok ? ': правильно' : ': помилка') : ''}`;
        return `<button type="button" class="qz-dot ${st}" data-i="${i}" aria-label="${lab}"${i === cur ? ' aria-current="step"' : ''}>${a ? (a.ok ? '✓' : '✗') : i + 1}</button>`;
      }).join('');
    };
    const show = (i, focus = true) => {
      cur = i;
      const q = qs[i];
      body.innerHTML = `<article class="qz-q">${questionHTML(q, i, qs.length)}</article>`;
      const box = $('.qz-q', body);
      ctl = wireQuestion(box, q, false, (a) => { answers.set(q.id, a); drawDots(); addNext(box); });
      const prev = answers.get(q.id);
      if (prev) { showResult(box, q, prev); addNext(box); ctl = null; }
      drawDots();
      if (focus) {
        $('.qz-stem', box).focus({ preventScroll: true });
        const top = root.getBoundingClientRect().top;
        if (top < 0) root.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
      }
    };
    const addNext = (box) => {
      if ($('.qz-next', box)) return;
      const last = answers.size === qs.length;
      const nextI = qs.findIndex((q, k) => k > cur && !answers.has(q.id));
      const row = doc.createElement('div');
      row.className = 'qz-actions';
      row.innerHTML = `<button type="button" class="btn primary qz-next">${last ? 'Підсумок' : 'Далі →'}</button>`;
      box.append(row);
      $('.qz-next', row).addEventListener('click', () => {
        if (answers.size === qs.length) {
          body.innerHTML = '';
          body.append(finish(root, ctx, answers, qs, rerun));
          dots.querySelectorAll('[aria-current]').forEach((d) => d.removeAttribute('aria-current'));
          $('.qz-end-h', body)?.setAttribute('tabindex', '-1');
          $('.qz-end-h', body)?.focus({ preventScroll: true });
        } else show(nextI >= 0 ? nextI : qs.findIndex((q) => !answers.has(q.id)));
      });
      $('.qz-next', row).focus({ preventScroll: true });
    };
    dots.addEventListener('click', (e) => { const d = e.target.closest('.qz-dot'); if (d) show(+d.dataset.i); });
    // Keys 1–8 pick an option, Enter checks; only while focus is inside this quiz.
    root.onkeydown = (e) => {
      if (!ctl || e.target.matches('input, textarea') || e.altKey || e.ctrlKey || e.metaKey) return;
      const k = /^Digit([1-8])$/.exec(e.code);
      if (k) { ctl.select(+k[1] - 1); e.preventDefault(); }
    };
    show(0, false);
  }

  function runList(root, ctx, qsIn, subset) {
    const qs = prep(qsIn, ctx);
    ctx.subset = subset;
    const answers = new Map();
    const badge = ctx.mode === 'warmup';
    root.innerHTML = `<div class="qz" data-mode="${ctx.mode}">${headHTML(ctx, qs)}
      <ol class="qz-list">${qs.map((q, i) => `<li class="qz-q" data-i="${i}">${questionHTML(q, i, qs.length, { badge, immediate: true })}</li>`).join('')}</ol>
      <div class="qz-progress" aria-live="polite"></div><div class="qz-endbox"></div></div>`;
    const prog = $('.qz-progress', root), endbox = $('.qz-endbox', root);
    const rerun = (set, sub) => runList(root, ctx, set, sub);
    const update = () => {
      const ok = [...answers.values()].filter((a) => a.ok).length;
      prog.textContent = answers.size < qs.length ? `Відповіли ${answers.size} з ${qs.length} · правильно ${ok}` : '';
      if (answers.size === qs.length && !endbox.firstChild) endbox.append(finish(root, ctx, answers, qs, rerun));
    };
    $$('.qz-list > .qz-q', root).forEach((box) => {
      const q = qs[+box.dataset.i];
      wireQuestion(box, q, true, (a) => { answers.set(q.id, a); update(); });
    });
    update();
  }

  /* ================================================================ present (projector) */
  function runPresent(root, ctx, qsIn) {
    const qs = prep(qsIn, ctx);
    const T = Number.isFinite(+ctx.time) && +ctx.time > 0 ? Math.round(+ctx.time) : 60;
    let cur = 0, revealed = false, vote = 1, left = T, timer = 0, running = false, shownIdx = -1;
    root.classList.add('qz-present-host');
    // The site nav is hidden while the projector runs (CSS below), so the stage carries its own way home and theme.
    const homeA = doc.querySelector('.site-nav .sn-home');
    root.innerHTML = `<div class="qp present" tabindex="-1" aria-roledescription="Розминка на весь екран">
      <div class="qp-bar">
        <a class="qp-home" href="${esc(homeA ? homeA.getAttribute('href') : '../')}"><span aria-hidden="true">←</span> Карта</a>
        <span class="qp-count"></span><span class="qp-from"></span><span class="qp-vote" hidden>Голосування 2</span>
        <span class="qp-spacer"></span>
        <button type="button" class="qp-theme" hidden></button>
        <button type="button" class="qp-timer" aria-label="Таймер"></button>
      </div>
      <div class="qp-stage" aria-live="polite"></div>
      <div class="qp-ctrl">
        <button type="button" class="btn qp-prev" aria-label="Попереднє питання">←</button>
        <button type="button" class="btn primary qp-reveal">Показати відповідь</button>
        <button type="button" class="btn qp-vote2" aria-pressed="false">Голосування 2</button>
        <button type="button" class="btn qp-next" aria-label="Наступне питання">→</button>
        <span class="qp-spacer"></span>
        <span class="qp-sec">
          <button type="button" class="btn ghost sm qp-copy" title="Текст питання з варіантами для чату Zoom">Скопіювати для чату</button>
          <button type="button" class="btn ghost sm qp-full">На весь екран</button>
        </span>
      </div>
      <p class="qp-keys"><kbd>←</kbd> <kbd>→</kbd> питання · <kbd>Enter</kbd> відповідь · <kbd>V</kbd> голосування 2 · <kbd>T</kbd> таймер · <kbd>F</kbd> повний екран</p>
    </div>`;
    const qp = $('.qp', root), stage = $('.qp-stage', root), tBtn = $('.qp-timer', root);
    // Theme: a mirror of site-theme.js's own button (in the hidden nav), so the cycle and storage stay in one place.
    const qTheme = $('.qp-theme', root);
    const siteTheme = () => doc.querySelector('.site-nav .theme-btn, [data-theme-slot] .theme-btn');
    const syncTheme = () => {
      const b = siteTheme();
      qTheme.hidden = !b;
      if (!b) return;
      qTheme.innerHTML = b.innerHTML;
      qTheme.setAttribute('aria-label', b.getAttribute('aria-label') || '');
      qTheme.title = b.title;
    };
    qTheme.addEventListener('click', () => { const b = siteTheme(); if (b) { b.click(); syncTheme(); } });
    addEventListener('themechange', syncTheme);
    // site-theme.js mounts its button on DOMContentLoaded, which may come after this mount.
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => setTimeout(syncTheme), { once: true });
    setTimeout(syncTheme);
    const fmtT = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const drawTimer = () => {
      tBtn.textContent = left > 0 ? fmtT(left) : 'Час!';
      tBtn.classList.toggle('up', left <= 0);
      tBtn.classList.toggle('low', left > 0 && left <= 10);
      tBtn.dataset.state = running ? 'running' : 'paused';
      tBtn.title = running ? 'Пауза (T)' : left > 0 ? 'Запустити (T)' : 'Ще раз (T)';
      tBtn.setAttribute('aria-label', `Таймер ${left > 0 ? fmtT(left) : 'вийшов'}, ${running ? 'йде' : 'на паузі'}`);
    };
    const stop = () => { clearInterval(timer); timer = 0; running = false; drawTimer(); };
    const start = () => {
      if (left <= 0) left = T;
      clearInterval(timer);
      running = true;
      timer = setInterval(() => { left = Math.max(0, left - 1); if (!left) stop(); else drawTimer(); }, 1000);
      drawTimer();
    };
    const resetTimer = (autostart) => { stop(); left = T; if (autostart) start(); else drawTimer(); };

    const draw = () => {
      if (cur >= qs.length) {
        stage.innerHTML = `<div class="qp-done"><p class="qp-done-h">Розминку завершено</p>
          <p>${qs.length} ${plural(qs.length, 'питання', 'питання', 'питань')} · з уроків ${[...new Set(qs.map((q) => lessonN(q.lesson)))].map(esc).join(', ')}</p>
          <button type="button" class="btn primary qp-restart">Почати спочатку</button></div>`;
        $('.qp-restart', stage).addEventListener('click', () => { cur = 0; vote = 1; revealed = false; draw(); resetTimer(true); });
        $('.qp-count', root).textContent = 'Кінець';
        $('.qp-from', root).textContent = '';
        $('.qp-vote', root).hidden = true;
        $('.qp-reveal', root).disabled = true;
        $('.qp-vote2', root).disabled = true;
        $('.qp-copy', root).disabled = true;
        $('.qp-next', root).disabled = true;
        $('.qp-prev', root).disabled = !qs.length;
        stop();
        return;
      }
      const q = qs[cur];
      $('.qp-count', root).textContent = `Питання ${cur + 1} / ${qs.length}`;
      $('.qp-from', root).textContent = q.lesson ? `з уроку ${lessonN(q.lesson)}` : '';
      $('.qp-vote', root).hidden = vote !== 2;
      const vb = $('.qp-vote2', root);
      vb.setAttribute('aria-pressed', String(vote === 2));
      vb.disabled = false;
      const rb = $('.qp-reveal', root);
      rb.disabled = false;
      rb.textContent = revealed ? 'Сховати відповідь' : 'Показати відповідь';
      $('.qp-copy', root).disabled = false;
      $('.qp-prev', root).disabled = cur === 0;
      $('.qp-next', root).disabled = false;
      let body;
      if (q.kind === 'mcq') {
        body = `<ol class="qp-opts">${q.view.map((o, k) => {
          const st = revealed ? (o.ok ? ' right' : ' dim') : '';
          return `<li class="qp-opt${st}"><span class="qp-letter" aria-hidden="true">${LETTERS[k]}</span>
            <span class="qp-t"><span class="sr-only">${LETTERS[k]}. </span>${safe(o.t)}${revealed && o.ok ? '<span class="qp-mark"> ✓ правильна</span>' : ''}
            ${revealed && o.why ? `<span class="qp-why">${safe(o.why)}</span>` : ''}</span></li>`;
        }).join('')}</ol>`;
      } else {
        body = `<div class="qp-numeric">${revealed ? `Відповідь: <b>${answerText(q)}</b>` : `Відповідь — число${q.answer.unit ? ` у ${esc(q.answer.unit)}` : ''}. Напишіть у чат.`}</div>`;
      }
      const why = revealed && q.why ? `<p class="qp-explain">${safe(q.why)}</p>` : '';
      // Animate only when the question changes, not on reveal or re-vote.
      const enter = shownIdx !== cur ? ' enter' : '';
      shownIdx = cur;
      stage.innerHTML = `<div class="qp-q${enter}${revealed ? ' revealed' : ''}"><div class="qp-stem">${safe(q.stem)}</div>${imgHTML(q)}${body}${why}</div>`;
      fitOpts();
    };
    // Unbroken code lines first; if one does not fit its cell, go to one column; on a phone step the code down to
    // 14 px; only then let it wrap, and only after «(» or before a spaced operator, so no line ends in «-» or «>=».
    const NARROW = matchMedia('(max-width: 600px)');
    const fitOpts = () => {
      const ol = $('.qp-opts', stage);
      if (!ol) return;
      const codes = $$('.qp-t > code', ol);
      const over = () => ol.scrollWidth > ol.clientWidth + 1 || $$('.qp-t', ol).some((t) => t.scrollWidth > t.clientWidth + 1);
      ol.classList.remove('one', 'wrap');
      codes.forEach((c) => { c.style.removeProperty('font-size'); if (c.dataset.src != null) { c.textContent = c.dataset.src; delete c.dataset.src; } });
      if (over()) ol.classList.add('one');
      if (over() && codes.length && NARROW.matches) {
        for (let px = Math.floor(parseFloat(getComputedStyle(codes[0]).fontSize)) - 1; px >= 14 && over(); px--) {
          codes.forEach((c) => { c.style.fontSize = px + 'px'; });
        }
      }
      if (!over()) return;
      ol.classList.add('wrap');
      codes.filter((c) => !c.children.length).forEach((c) => {
        const src = c.textContent;
        c.dataset.src = src;
        // Spaces become no-break; the only break points are <wbr> after «(» (unless it holds one plain token, as in
        // «(int)» or «()»), after «, » and «; », and before a spaced operator.
        const parts = src.replace(/ /g, '\u00a0')
          .split(/(?<=\()(?![\w&*]*\))|(?<=[,;]\u00a0)|(?<=\u00a0)(?=(?:[<>=!]=|&&|\|\||<<|>>|[-+*/%<>=?:])\u00a0)/);
        c.textContent = '';
        parts.forEach((t, k) => { if (k) c.append(doc.createElement('wbr')); c.append(t); });
      });
    };
    let fitRaf = 0;
    const onResize = () => { if (!root.isConnected) { removeEventListener('resize', onResize); return; } cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(fitOpts); };
    addEventListener('resize', onResize);
    const go = (d) => {
      const n = Math.min(qs.length, Math.max(0, cur + d));
      if (n === cur) return;
      cur = n; revealed = false; vote = 1;
      draw();
      resetTimer(cur < qs.length);
    };
    const reveal = () => { if (cur >= qs.length) return; revealed = !revealed; if (revealed) stop(); draw(); };
    const vote2 = () => {
      if (cur >= qs.length) return;
      vote = vote === 2 ? 1 : 2;
      revealed = false;
      draw();
      resetTimer(vote === 2);
    };
    const pollText = () => {
      const q = qs[cur];
      if (!q) return '';
      const opts = q.kind === 'mcq' ? q.view.map((o, k) => `${LETTERS[k]}) ${plain(o.t)}`).join('\n') : `Відповідь — число${q.answer.unit ? ', ' + q.answer.unit : ''}`;
      return `Питання ${cur + 1}${vote === 2 ? ' (голосування 2)' : ''}: ${plain(q.stem)}\n${opts}\nВідповідь у чат: ${q.kind === 'mcq' ? 'одна буква' : 'число'}, Enter на «3-2-1».`;
    };
    const full = () => {
      try {
        if (doc.fullscreenElement) doc.exitFullscreen();
        else if (root.requestFullscreen) root.requestFullscreen().catch(() => toast('Повний екран недоступний у цьому браузері', 'bad'));
      } catch { /* not supported */ }
    };
    $('.qp-prev', root).addEventListener('click', () => go(-1));
    $('.qp-next', root).addEventListener('click', () => go(1));
    $('.qp-reveal', root).addEventListener('click', reveal);
    $('.qp-vote2', root).addEventListener('click', vote2);
    $('.qp-copy', root).addEventListener('click', () => copyText(pollText()));
    $('.qp-full', root).addEventListener('click', full);
    tBtn.addEventListener('click', () => (running ? stop() : start()));
    doc.addEventListener('fullscreenchange', () => { $('.qp-full', root).textContent = doc.fullscreenElement ? 'Вийти з повного екрана' : 'На весь екран'; });

    // Page-level keys: the projector page has one present quiz, and the teacher should not need to click into it.
    const onKey = (e) => {
      if (!root.isConnected) { doc.removeEventListener('keydown', onKey); return; }
      if (e.target.closest('input, textarea, select, [contenteditable]') || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target.closest('button') && (e.key === 'Enter' || e.key === ' ')) return;
      const map = { ArrowRight: () => go(1), ArrowLeft: () => go(-1), PageDown: () => go(1), PageUp: () => go(-1), Enter: reveal,
        KeyV: vote2, KeyT: () => (running ? stop() : start()), KeyF: full };
      const fn = map[e.key] || map[e.code];
      if (fn) { e.preventDefault(); fn(); }
    };
    doc.addEventListener('keydown', onKey);
    draw();
    resetTimer(!!ctx.autostart);
    return {
      next: () => go(1), prev: () => go(-1), reveal, vote2, get index() { return cur; },
      destroy() { stop(); doc.removeEventListener('keydown', onKey); removeEventListener('resize', onResize); },
    };
  }

  /* ================================================================ mount */
  function message(root, html) {
    root.innerHTML = `<div class="qz-msg">${html}</div>`;
  }

  /**
   * StudyQuiz.mount(el, { src, ids, mode, n, shuffle, onDone, mix, current, title, time, autostart, questions })
   * → Promise<{ mode, questions, ctl }>. `questions` skips loading (already loaded items).
   */
  async function mount(el, opts = {}) {
    if (typeof el === 'string') el = $(el);
    if (!el) throw new Error('StudyQuiz.mount: element not found');
    if (el._quizCtl && el._quizCtl.destroy) el._quizCtl.destroy();
    const ctx = {
      mode: ['stepper', 'list', 'present', 'warmup'].includes(opts.mode) ? opts.mode : 'stepper',
      src: list(opts.src), ids: opts.ids ? list(opts.ids) : null, n: +opts.n || 0, onDone: opts.onDone,
      title: opts.title || '', time: opts.time, autostart: opts.autostart, label: opts.label, shuffleOptions: opts.shuffleOptions,
    };
    el.classList.add('quiz-mounted');
    el.setAttribute('aria-busy', 'true');
    if (!el.firstChild) message(el, '<p class="muted">Завантаження питань…</p>');
    let qs, picked = false;
    try {
      if (opts.questions) {
        qs = opts.questions;
      } else if (ctx.mode === 'warmup' && (opts.from === 'auto' || !ctx.src.length) && !ctx.ids) {
        qs = await pickWarmup({ current: opts.current ?? (S() && S().lesson), n: ctx.n || 3, mix: opts.mix, src: ctx.src, seed: opts.seed });
        picked = true;
        ctx.src = [...new Set(qs.map((q) => q.lesson))];
        if (!qs.length) {
          message(el, `<p><b>Розминки поки немає.</b> Вона збирає питання з попередніх уроків, а для цього уроку їх ще немає (або квізи ще не опубліковані).</p>`);
          el.removeAttribute('aria-busy');
          return { mode: ctx.mode, questions: [] };
        }
      } else if (ctx.ids && !ctx.src.length) {
        qs = await loadByIds(ctx.ids);
        ctx.src = [...new Set(qs.map((q) => q.lesson))];
      } else {
        if (!ctx.src.length) throw Object.assign(new Error('немає data-src'), { friendly: true });
        qs = await load(ctx.src);
        if (qs.missing.length === ctx.src.length) throw Object.assign(new Error(`не вдалося завантажити quiz/${ctx.src.join(', ')}.json`), { friendly: true });
        if (ctx.ids) { const set = new Set(ctx.ids); qs = qs.filter((q) => set.has(q.id)); }
      }
    } catch (err) {
      console.error('StudyQuiz:', err);
      const file = location.protocol === 'file:';
      message(el, `<p><b>Не вдалося завантажити питання.</b> ${file ? 'Відкрийте сайт через http:// (не file://).' : 'Оновіть сторінку або спробуйте пізніше.'}</p>${err.friendly ? `<p class="small">${esc(err.message)}</p>` : ''}`);
      el.removeAttribute('aria-busy');
      return { mode: ctx.mode, questions: [], error: err };
    }
    if (!qs.length) {
      message(el, '<p><b>Тут поки немає питань.</b> Можливо, файл квізу порожній або всі питання мають помилки (деталі в консолі).</p>');
      el.removeAttribute('aria-busy');
      return { mode: ctx.mode, questions: [] };
    }
    if (ctx.mode === 'warmup' && !picked && !ctx.ids && !opts.questions) {
      const w = qs.filter((q) => q.warmup);
      if (w.length) qs = w;
    }
    if (opts.shuffle === true || (opts.shuffle !== false && ctx.mode === 'warmup' && !picked && !opts.questions)) {
      qs = shuffle(qs, opts.seed ?? `${localISO()}|${ctx.src.join(',')}`);
    }
    if (ctx.n && !picked) qs = qs.slice(0, ctx.n);
    ctx.all = qs;
    el.removeAttribute('aria-busy');
    let ctl = null;
    if (ctx.mode === 'present') ctl = runPresent(el, ctx, qs);
    else if (ctx.mode === 'stepper') runStepper(el, ctx, qs, false);
    else runList(el, ctx, qs, false);
    el._quizCtl = ctl;
    return { mode: ctx.mode, questions: qs, ctl };
  }

  function autoMount(scope = doc) {
    $$('.quiz', scope).forEach((el) => {
      if (el._quizAuto || el.hasAttribute('data-manual')) return;
      el._quizAuto = true;
      const d = el.dataset;
      mount(el, {
        src: d.src, ids: d.ids, mode: d.mode, n: d.n, from: d.from, mix: d.mix, title: d.title, time: d.time,
        shuffle: d.shuffle === 'true' ? true : d.shuffle === 'false' ? false : undefined, current: d.current,
      }).catch((e) => console.error('StudyQuiz:', e));
    });
  }

  /* ================================================================ styles */
  // Kept with the engine so any page that loads quiz.js gets them; uses only study.css tokens.
  const CSS = `
.quiz.quiz-mounted { padding: 18px 18px 16px; box-shadow: var(--shadow); }
.qz-msg p { margin: 0 0 6px; } .qz-msg p:last-child { margin: 0; }
.qz-head { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; justify-content: space-between; margin: 0 0 14px; }
.qz-title { font: 600 13px/1.3 var(--f-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }
.qz-dots { display: flex; flex-wrap: wrap; gap: 6px; }
.qz-dot { width: 32px; height: 32px; padding: 0; border-radius: 50%; display: grid; place-items: center; cursor: pointer;
  border: 1.5px solid var(--line); background: var(--panel); color: var(--muted); font: 600 13px var(--f-mono); transition: border-color .15s, background-color .15s; }
.qz-dot:hover { border-color: var(--accent); }
.qz-dot[aria-current="step"] { border-color: var(--accent); color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent); }
.qz-dot.right { border-color: var(--ok); color: var(--ok); background: color-mix(in srgb, var(--ok) 10%, var(--panel)); }
.qz-dot.wrong { border-color: var(--bad); color: var(--bad); background: color-mix(in srgb, var(--bad) 9%, var(--panel)); }
.qz-q { margin: 0; animation: qz-in .25s ease-out; }
@keyframes qz-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
.qz-meta { display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: center; margin: 0 0 10px; font: 600 13px/1.3 var(--f-mono); color: var(--muted); }
.qz-count { margin-right: 4px; font-variant-numeric: tabular-nums; }
.qz-badge { display: inline-block; padding: 2px 9px; border-radius: 999px; border: 1px solid var(--line); background: var(--panel-2); letter-spacing: .03em; }
.qz-badge.lvl-concept { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, var(--line)); }
.qz-badge.lvl-apply { color: var(--hi-ink); border-color: color-mix(in srgb, var(--hi) 45%, var(--line)); }
.qz-badge.from { color: var(--ink); background: color-mix(in srgb, var(--accent) 9%, var(--panel)); border-color: color-mix(in srgb, var(--accent) 35%, var(--line)); }
.qz-badge.mc { color: var(--teach); border-style: dashed; border-color: var(--teach); background: var(--panel); }
.qz-stem { font: 500 18px/1.55 var(--f-body); margin: 0 0 14px; outline: none; text-wrap: pretty; }
.qz-stem:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: 4px; }
.qz-img { display: block; max-width: 100%; max-height: 280px; height: auto; margin: 0 0 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--panel-2); }
.qz-opts { display: grid; gap: 8px; }
.qz-opt { display: grid; grid-template-columns: 32px minmax(0, 1fr); column-gap: 12px; row-gap: 2px; align-items: center; width: 100%; text-align: left;
  min-height: 52px; padding: 10px 14px 10px 10px; border-radius: 10px; cursor: pointer;
  border: 1px solid var(--line); background: var(--panel-2); color: var(--ink); font: 500 16px/1.45 var(--f-body);
  transition: border-color .15s, background-color .15s, opacity .2s; }
.qz-opt:hover:not(:disabled) { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 5%, var(--panel-2)); }
.qz-opt:disabled { cursor: default; }
.qz-opt .k { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 8px; align-self: start;
  border: 1.5px solid var(--line); background: var(--panel); color: var(--muted); font: 700 15px var(--f-mono); transition: inherit; }
.qz-opt .t { min-width: 0; }
.qz-opt[aria-pressed="true"] { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.qz-opt[aria-pressed="true"] .k { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.qz-opt .why, .qz-opt .mark { grid-column: 2; }
.qz-opt .why { font-size: 14.5px; line-height: 1.45; color: var(--muted); }
.qz-opt .mark { font: 600 13px var(--f-mono); letter-spacing: .03em; }
.qz-opt.right { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 10%, var(--panel)); box-shadow: none; }
.qz-opt.right .k { background: var(--ok); border-color: var(--ok); color: var(--panel); }
.qz-opt.right .mark { color: var(--ok); }
.qz-opt.wrong { border-color: var(--bad); background: color-mix(in srgb, var(--bad) 8%, var(--panel)); box-shadow: none; }
.qz-opt.wrong .k { background: var(--bad); border-color: var(--bad); color: var(--panel); }
.qz-opt.wrong .mark { color: var(--bad); }
.qz-opt.dim { opacity: .78; }
.qz-numrow { display: flex; flex-wrap: wrap; gap: 8px 10px; align-items: center; }
.qz-input { width: 9em; font: 600 18px var(--f-mono) !important; font-variant-numeric: tabular-nums; }
.qz-input.ok { border-color: var(--ok); box-shadow: inset 0 0 0 1px var(--ok); }
.qz-input.no { border-color: var(--bad); box-shadow: inset 0 0 0 1px var(--bad); }
.qz-unit { font: 600 16px var(--f-mono); color: var(--muted); }
.qz-hint { margin: 6px 0 0; font-size: 14px; color: var(--muted); }
.qz-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin: 14px 0 0; }
.qz-fb { margin-top: 12px; font-size: 15.5px; line-height: 1.5; }
.qz-fb:empty { display: none; }
.qz-fb.ok, .qz-fb.no { padding: 10px 14px; border-radius: 8px; background: var(--panel-2); border: 1px solid var(--line); border-left: 4px solid var(--ok); }
.qz-fb.no { border-left-color: var(--bad); }
.qz-fb.ok > b:first-child { color: var(--ok); } .qz-fb.no > b:first-child { color: var(--bad); }
.qz-fb .txt { color: var(--ink); }
.qz-ref { white-space: nowrap; font-weight: 600; }
.qz-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; }
.qz-list > .qz-q { padding: 18px 0; border-top: 1px dashed var(--line); }
.qz-list > .qz-q:first-child { padding-top: 0; border-top: 0; }
.qz-progress { font: 600 13px var(--f-mono); color: var(--muted); margin-top: 10px; }
.qz-progress:empty { display: none; }
.qz-end { display: flex; flex-wrap: wrap; gap: 14px 22px; align-items: flex-start; padding: 16px; margin-top: 8px; border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 6%, var(--panel)); border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--line)); animation: qz-in .3s ease-out; }
.qz-end-text { flex: 1 1 260px; min-width: 0; }
.qz-end-h { font: 700 1.6rem/1.1 var(--f-display); margin: 4px 0 8px; outline: none; }
.qz-end p { margin: 0 0 8px; }
.qz-wrong { margin: 6px 0 4px; padding-left: 20px; font-size: 15px; }
.qz-wrong li { margin-bottom: 4px; }
.qz-ring { width: 96px; height: 96px; flex: none; }
.qz-ring circle { fill: none; stroke-width: 8; }
.qz-ring .bg { stroke: var(--line); }
.qz-ring .fg { stroke: var(--accent); stroke-linecap: round; transition: stroke-dasharray .6s ease-out; }
.qz-ring text { font: 700 20px var(--f-mono); fill: var(--ink); }

/* present: projector mode (type ≥ 28 px) */
.qz-present-host { margin: 0; }
.qp { display: flex; flex-direction: column; gap: 18px; outline: none; min-height: min(78vh, 820px); padding: clamp(16px, 2.6vw, 36px);
  background: var(--panel); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); }
:fullscreen .qp, .qz-present-host:fullscreen .qp { min-height: 100vh; border-radius: 0; border: 0; }
.qz-present-host:fullscreen { background: var(--paper); overflow: auto; }
.qp-bar, .qp-ctrl { display: flex; flex-wrap: wrap; gap: 10px 12px; align-items: center; }
.qp-spacer { flex: 1 1 0; }
.qp-count, .qp-from, .qp-vote { font: 600 clamp(15px, 1.25vw, 20px)/1.2 var(--f-mono); letter-spacing: .04em; color: var(--muted); }
.qp-from { color: var(--ink); padding: 4px 12px; border-radius: 999px; background: color-mix(in srgb, var(--accent) 10%, var(--panel)); border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--line)); }
.qp-vote { color: var(--panel); background: var(--hi-ink); padding: 4px 12px; border-radius: 999px; }
.qp-timer { min-width: 4.6ch; min-height: 48px; padding: 6px 16px; border-radius: 999px; cursor: pointer; font: 700 clamp(20px, 2vw, 30px)/1 var(--f-mono);
  font-variant-numeric: tabular-nums; color: var(--ink); background: var(--panel-2); border: 1.5px solid var(--line); }
.qp-timer[data-state="running"] { border-color: var(--accent); color: var(--accent); }
.qp-timer.low { border-color: var(--hi); color: var(--hi-ink); }
.qp-timer.up { border-color: var(--bad); color: var(--bad); }
.qp-stage { flex: 1 1 auto; display: flex; flex-direction: column; justify-content: center; min-width: 0; }
.qp-q.enter { animation: qz-in .3s ease-out; }
.qp-stem { font: 600 clamp(28px, 3.1vw, 50px)/1.25 var(--f-body); margin: 0 0 clamp(18px, 2.4vw, 34px); text-wrap: balance; }
.qp-opts { list-style: none; margin: 0; padding: 0; display: grid; gap: clamp(10px, 1.2vw, 16px); }
@media (min-width: 1100px) { .qp-opts { grid-template-columns: 1fr 1fr; } }
.qp-opt { display: flex; gap: clamp(12px, 1.4vw, 22px); align-items: flex-start; margin: 0; padding: clamp(10px, 1.2vw, 18px) clamp(12px, 1.4vw, 22px);
  border-radius: 14px; border: 1.5px solid var(--line); background: var(--panel-2); font: 500 clamp(28px, 2.4vw, 40px)/1.3 var(--f-body);
  transition: opacity .25s, border-color .25s, background-color .25s; }
.qp-letter { flex: none; display: grid; place-items: center; width: 1.6em; height: 1.6em; border-radius: 10px; margin-top: -.12em;
  font: 700 1em/1 var(--f-display); background: var(--panel); border: 2px solid var(--accent); color: var(--accent); }
.qp-t { min-width: 0; }
.qp-mark { font: 700 .62em var(--f-mono); color: var(--ok); white-space: nowrap; }
.qp-why { display: block; margin-top: 6px; font: 400 clamp(20px, 1.6vw, 22px)/1.4 var(--f-body); color: var(--muted); }
.qp-opt.right { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 12%, var(--panel)); }
.qp-opt.right .qp-letter { background: var(--ok); border-color: var(--ok); color: var(--panel); }
/* after the reveal a wrong option stays fully readable: a muted dashed border and a ✗ badge on the disc say "not this one" */
.qp-opt.dim { opacity: 1; border-style: dashed; border-color: var(--line-2); }
.qp-opt.dim .qp-letter { position: relative; border-color: var(--muted); color: var(--muted); }
.qp-opt.dim .qp-letter::after { content: "✗"; position: absolute; right: -.32em; bottom: -.32em; width: 1.05em; height: 1.05em; display: grid; place-items: center;
  border-radius: 50%; background: var(--bad); color: var(--panel); font: 700 .5em/1 var(--f-body); }
.qp-opt.dim .qp-why { color: var(--ink); }
/* code in options is one tinted run (never split into per-line fragments); breaks only at spaces.
   :root-prefixed so it outranks the study.css projector skin. */
:root .qp-t > code { display: inline-block; max-width: 100%; vertical-align: top; white-space: pre-wrap; overflow-wrap: anywhere;
  -webkit-box-decoration-break: clone; box-decoration-break: clone; color: var(--ink); font-size: clamp(18px, 1.8vw, 26px); line-height: 1.45; padding: .05em .3em; }
/* keep each expression on one line; fitOpts() drops to one column, then (phones) to a smaller code size, then to
   wrapping at the <wbr> points it inserts */
:root .qp-opts:not(.wrap) .qp-t > code { white-space: pre; }
/* one column of four is taller: tighten it so the controls still fit above the fold */
:root .qp-opts:is(.one, .wrap) { grid-template-columns: minmax(0, 1fr); gap: clamp(8px, .8vw, 12px); }
:root .qp-opts:is(.one, .wrap) .qp-opt { padding-block: clamp(6px, .7vw, 10px); }
@media (max-width: 600px) {
  :root .qp-stem { font-size: clamp(22px, 6vw, 28px); }
  :root .qp-t > code { font-size: clamp(15px, 4.4vw, 18px); }
}
/* projector mode owns the screen: no site nav (the stage's own bar keeps «← Карта» and the theme), a one-line
   page header, so «Показати відповідь» fits above the fold at 1280×720 */
body:has(.qp.present) > .site-nav { display: none; }
.qp-home, .qp-theme { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 14px; border-radius: 999px;
  font: 600 14px/1 var(--f-mono); color: var(--ink); background: var(--panel-2); border: 1.5px solid var(--line-strong, var(--line));
  text-decoration: none; cursor: pointer; }
.qp-theme[hidden] { display: none; }
@media (max-width: 420px) { .qp-bar .qp-spacer { display: none; } .qp-bar .qp-theme { margin-left: auto; } }
.qp-home:hover, .qp-theme:hover { border-color: var(--accent); }
.qp-sec { display: inline-flex; flex-wrap: wrap; gap: 10px 12px; }
body:has(.qp) .wu-head { margin-bottom: 6px; align-items: center; }
body:has(.qp) .wu-head .eyebrow { display: none; }
body:has(.qp) .wu-head h1 { font-size: clamp(1.5rem, 1.2rem + 1vw, 2rem); }
body:has(.qp) .wu { padding-top: 10px; }
body:has(.qp) .wu-info { margin-bottom: 8px; }
.qp-numeric { font: 500 clamp(28px, 2.4vw, 40px)/1.3 var(--f-body); color: var(--muted); }
.qp-numeric b { color: var(--ok); font-family: var(--f-mono); }
.qp-explain { margin: clamp(14px, 1.8vw, 26px) 0 0; padding: 12px 18px; border-left: 5px solid var(--ok); border-radius: 0 10px 10px 0;
  background: var(--panel-2); font: 400 clamp(20px, 1.7vw, 28px)/1.45 var(--f-body); }
.qp-ctrl .btn { min-height: 48px; font-size: 16px; }
.qp-ctrl .qp-prev, .qp-ctrl .qp-next { min-width: 56px; font-size: 22px; }
.qp-keys { margin: 0; font-size: 13px; color: var(--muted); }
@media (max-width: 700px) { .qp-keys { display: none; } }
/* phones: ← [Показати відповідь] → in one row, «Голосування 2» under it, copy as a compact secondary row */
@media (max-width: 420px) {
  .qp-ctrl { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 10px; }
  .qp-ctrl .qp-prev { grid-area: 1 / 1; } .qp-ctrl .qp-reveal { grid-area: 1 / 2; } .qp-ctrl .qp-next { grid-area: 1 / 3; }
  .qp-ctrl .qp-vote2 { grid-area: 2 / 1 / 3 / -1; }
  .qp-ctrl .qp-spacer { display: none; }
  .qp-ctrl .qp-sec { grid-area: 3 / 1 / 4 / -1; justify-content: center; }
  .qp-ctrl .qp-reveal { padding-inline: 10px; }
}
@media (pointer: coarse) and (max-width: 700px) { .qp-full { display: none; } }
/* misconception codes are for the teacher (study.css .t-only does the same; this keeps it without study.css) */
html:not(.teacher) .qz-badge.mc { display: none; }
.qp-done { text-align: center; font-size: clamp(20px, 1.8vw, 28px); }
.qp-done-h { font: 700 clamp(36px, 4vw, 64px)/1.1 var(--f-display); margin: 0 0 12px; }
@media print { .qz-actions, .qz-dots, .qp-ctrl, .qp-timer, .qp-keys { display: none !important; } }
`;
  function injectCSS() {
    if (doc.getElementById('study-quiz-css')) return;
    const st = doc.createElement('style');
    st.id = 'study-quiz-css';
    st.textContent = CSS;
    (doc.head || doc.documentElement).append(st);
  }
  injectCSS();

  window.StudyQuiz = { mount, load, loadByIds, pickWarmup, scores, check: checkNumeric, autoMount, lessonN, version: 1 };

  // Mount after Study's boot so Study.lesson, COURSE and teacher mode are all in place.
  const go = () => autoMount();
  if (window.Study && Study.ready) Study.ready(go);
  else if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', go, { once: true });
  else setTimeout(go);
})();
