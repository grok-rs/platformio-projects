// flashcards.js: spaced-repetition cards for the study site (design brief §3.4).
//
// Classic deferred script, loaded after study.js. Defines window.StudyCards and auto-mounts every
// `.deck-mini[data-deck]` (inline session on a lesson hub). The full trainer is StudyCards.trainer(el) (docs/cards/).
// Data: docs/data/cards/<deck>.json (§2.4). A missing deck file is skipped; a bad card is skipped with a console warning.
// Progress: localStorage 'study.cards.v1' = { s: {cardId: {r, i, e, d, l}}, days: {date: {n, ms, new}}, ui: {...} }.
// Scheduler: SM-2-lite, exactly the table in §3.4; deterministic, no randomness.
(() => {
  'use strict';
  const doc = document;
  const KEY = 'study.cards.v1';
  const NBSP = ' ';
  const GOAL_CARDS = 20, GOAL_MS = 10 * 60 * 1000;
  const MAX_I = 120;
  const TYPES = { basic: 'Питання', reverse: 'Питання', cloze: 'Пропуск', calc: 'Розрахунок', debug: 'Симптом → причина', why: 'Чому?',
    image: 'Картинка', symbol: 'Символ', term: 'Термін' };
  const GRADES = [[1, 'Знову'], [2, 'Важко'], [3, 'Добре'], [4, 'Легко']];
  const GLOBAL_DECKS = [
    { id: 'notation', title: 'Нотація номіналів: 4k7, 104, E12' },
    { id: 'symbols', title: 'Схемні символи' },
    { id: 'atlas', title: 'Атлас компонентів' },
  ];
  const ANKI_ROOT = 'ESP32-S3 курс';
  const self = doc.currentScript;

  /* ================================================================ helpers */
  const S = () => window.Study || null;
  const base = () => (S() && S().base) || new URL('../', self ? self.src : location.href).href;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Card text may hold <b> <i> <sub> <sup> <br> <code> (no attributes); everything else is shown as text.
  const safe = (s) => esc(s).replace(/&lt;(\/?)(b|i|sub|sup|br|code)\s*\/?&gt;/gi, (m, c, t) => `<${c}${t.toLowerCase()}>`);
  const $ = (sel, r = doc) => r.querySelector(sel);
  const $$ = (sel, r = doc) => Array.from(r.querySelectorAll(sel));
  const list = (v) => (Array.isArray(v) ? v : String(v ?? '').split(',')).map((x) => String(x).trim()).filter(Boolean);
  const toast = (m, kind) => { if (S()) S().toast(m, kind); };
  const plural = (n, one, few, many) => {
    const a = n % 10, b = n % 100;
    return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
  };
  const cardsWord = (n) => `${n}${NBSP}${plural(n, 'картка', 'картки', 'карток')}`;
  const fetchJSON = (path) => (S() ? S().fetchJSON(path, { quiet: true })
    : fetch(new URL(path, base())).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }));

  // In-memory copy when storage is blocked; Study.store already does this, the fallback mirrors it.
  const mem = new Map();
  const rawStore = {
    get(k, fb) {
      if (S()) return S().store.get(k, fb);
      try { const v = localStorage.getItem(k); if (v) return JSON.parse(v); } catch { /* blocked */ }
      return mem.has(k) ? mem.get(k) : fb;
    },
    set(k, v) {
      if (S()) return S().store.set(k, v);
      mem.set(k, v);
      try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* per visit */ }
    },
    del(k) {
      if (S()) return S().store.del(k);
      mem.delete(k);
      try { localStorage.removeItem(k); } catch { /* per visit */ }
    },
  };

  /* ================================================================ dates (local calendar days) */
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const localISODate = () => iso(new Date());
  const isISO = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  function addDays(day, n) {
    const [y, m, d] = day.split('-').map(Number);
    return iso(new Date(y, m - 1, d + n));
  }
  function daysBetween(a, b) {
    const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number);
    return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
  }
  const fmtDay = (day) => (isISO(day) ? `${day.slice(8, 10)}.${day.slice(5, 7)}` : day);

  /* ================================================================ progress state */
  const validCard = (c) => c && typeof c === 'object' && [c.r, c.i, c.e, c.l].every((x) => Number.isFinite(x)) && isISO(c.d);
  function readState() {
    const raw = rawStore.get(KEY, null);
    const st = { s: {}, days: {}, ui: {} };
    if (!raw || typeof raw !== 'object') return st;
    if (raw.s && typeof raw.s === 'object') for (const [id, c] of Object.entries(raw.s)) if (validCard(c)) st.s[id] = c;
    if (raw.days && typeof raw.days === 'object') {
      for (const [d, v] of Object.entries(raw.days)) if (isISO(d) && v && typeof v === 'object') st.days[d] = { n: +v.n || 0, ms: +v.ms || 0, new: +v.new || 0 };
    }
    if (raw.ui && typeof raw.ui === 'object') st.ui = raw.ui;
    return st;
  }
  const writeState = (st) => rawStore.set(KEY, st);
  const dayRec = (st, day) => (st.days[day] ||= { n: 0, ms: 0, new: 0 });

  /* ================================================================ scheduler: SM-2-lite (§3.4 table) */
  const fresh = (today) => ({ r: 0, i: 0, e: 2.5, d: today, l: 0 });
  const round2 = (x) => Math.round(x * 100) / 100;
  // Pure: the card's next state after grade g (1 Знову, 2 Важко, 3 Добре, 4 Легко).
  function schedule(prev, g, today) {
    const c = { ...(prev || fresh(today)) };
    if (g === 1) {
      c.r = 0; c.i = 0; c.l += 1; c.e = Math.max(1.3, round2(c.e - 0.2));
    } else if (g === 2) {
      c.i = Math.max(1, Math.round(c.i * 1.2)); c.e = Math.max(1.3, round2(c.e - 0.15));
    } else if (g === 3) {
      c.i = c.r === 0 ? 1 : c.r === 1 ? 3 : Math.round(c.i * c.e); c.r += 1;
    } else if (g === 4) {
      c.i = c.r === 0 ? 3 : Math.round(c.i * c.e * 1.3); c.e = round2(c.e + 0.15); c.r += 1;
    } else {
      throw new RangeError('grade must be 1–4');
    }
    c.i = Math.min(MAX_I, c.i);
    c.d = addDays(today, c.i);
    return c;
  }
  function intervalLabel(i) {
    if (i <= 0) return 'зараз';
    if (i === 1) return 'завтра';
    if (i < 45) return `через ${i}${NBSP}дн.`;
    return `через ~${Math.round(i / 30)}${NBSP}міс.`;
  }
  // { 1: 'зараз', 2: 'завтра (коротший крок)', 3: 'завтра', 4: 'через 3 дн.' } for the grade buttons.
  // When «Важко» and «Добре» land on the same day (a new card: both «завтра»), «Важко» still keeps the step short
  // (no repetition counted, lower ease), so it says so instead of looking identical.
  function preview(cardId, today = localISODate()) {
    const st = readState(), out = {};
    const next = {};
    for (const [g] of GRADES) { next[g] = schedule(st.s[cardId], g, today); out[g] = intervalLabel(next[g].i); }
    // Same first step (a new card: both «завтра»): show the step after it, if that one is answered «Добре».
    if (out[2] === out[3]) for (const g of [2, 3]) out[g] += `, потім ${schedule(next[g], 3, next[g].d).i}${NBSP}дн.`;
    return out;
  }
  // Records a review. opts.ms = time spent on the card (for the daily goal). Returns the new card state.
  function grade(cardId, g, { today = localISODate(), ms = 0 } = {}) {
    g = +g;
    if (![1, 2, 3, 4].includes(g)) throw new RangeError('StudyCards.grade: g must be 1–4');
    const st = readState();
    const wasNew = !st.s[cardId];
    const next = schedule(st.s[cardId], g, today);
    st.s[cardId] = next;
    const day = dayRec(st, today);
    day.n += 1;
    day.ms += Math.max(0, Math.min(60000, +ms || 0));
    if (wasNew) day.new += 1;
    writeState(st);
    return next;
  }

  /* ================================================================ decks: discovery, loading, validation */
  const deckOf = (cardId) => String(cardId).split('#')[0].replace(/-\d+$/, '');
  // «Урок 1.3», but «МП1» (a mini-project is not a numbered lesson).
  const lessonName = (l) => (/^\d/.test(String(l.n || l.id)) ? `Урок ${l.n || l.id}` : String(l.n || l.id));
  function courseLessons() {
    const C = window.COURSE;
    if (!C || !Array.isArray(C.modules)) return null;
    const out = [];
    C.modules.forEach((m) => (m && Array.isArray(m.lessons) ? m.lessons : []).forEach((l) => { if (l && l.id) out.push({ ...l, module: m }); }));
    return out;
  }
  // Deck candidates: lessons in COURSE that have cards (and are not planned), then the global decks.
  // Files that turn out to be missing are dropped by load().
  function decks() {
    const out = [];
    const lessons = courseLessons();
    if (lessons) {
      for (const l of lessons) {
        const has = l.deck !== false && (typeof l.cards === 'number' ? l.cards > 0 : l.status === 'ready');
        if (!has || l.status === 'planned') continue;
        out.push({ id: l.id, lesson: l.id, n: l.n || l.id, title: `${lessonName(l)} · ${l.title || ''}`.replace(/ · $/, ''), group: l.module && l.module.title, count: l.cards });
      }
    }
    // Global decks are declared in COURSE.decks once their files are published (so nothing 404s);
    // without a manifest at all, try the known ones.
    const extra = window.COURSE ? (Array.isArray(window.COURSE.decks) ? window.COURSE.decks : []) : GLOBAL_DECKS;
    for (const g of extra) if (g && g.id && !out.some((d) => d.id === g.id)) out.push({ id: g.id, title: g.title || g.id, group: 'Довідка' });
    return out;
  }
  function deckTitle(id, data) {
    const l = (courseLessons() || []).find((x) => x.id === id);
    if (l) return `${lessonName(l)} · ${l.title || ''}`.replace(/ · $/, '');
    if (data && typeof data.title === 'string' && data.title) return data.title;
    const g = GLOBAL_DECKS.find((x) => x.id === id);
    return g ? g.title : id;
  }
  // Short name for the deck chip on a card and the Anki sub-deck: «Урок 1.1», «Нотація номіналів».
  function deckShort(id) {
    const d = deckCache.get(id);
    const l = (courseLessons() || []).find((x) => x.id === id);
    if (l) return lessonName(l);
    if (d && d.lesson && /^\d+-\d+$/.test(d.lesson)) return `Урок ${d.lesson.replace('-', '.')}`;
    if (id.startsWith('_')) return 'Демо';
    return ((d && d.title) || id).split(' · ')[0].split(':')[0];
  }

  const CLOZE_RE = /\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g;
  const str = (v) => (typeof v === 'string' && v.trim() ? v : '');

  // One raw card → normalized note plus its expanded study cards (reverse → #r, cloze → #c1, #c2 …).
  function expand(raw, deck, problems, where) {
    const bad = (m) => { problems.push(`${where}: ${m}`); return []; };
    if (!raw || typeof raw !== 'object') return bad('картка не є об’єктом');
    const id = str(raw.id).trim();
    if (!id) return bad('немає id');
    let type = raw.type;
    if (!TYPES[type]) {
      if (str(raw.front) && str(raw.back)) { problems.push(`${where} ${id}: невідомий тип «${type}», показано як basic`); type = 'basic'; } else return bad(`${id}: невідомий тип «${type}»`);
    }
    const note = {
      id, deck, type, front: str(raw.front), back: str(raw.back), text: str(raw.text), extra: str(raw.extra),
      img: str(raw.img), alt: str(raw.alt), sym: str(raw.sym), en: str(raw.en),
      tags: Array.isArray(raw.tags) ? raw.tags.filter((t) => typeof t === 'string' && t.trim()) : [],
      ref: str(raw.ref), mc: str(raw.mc), fact: str(raw.fact), author: str(raw.author),
    };
    const card = (sub, extra = {}) => ({ ...note, id: sub ? `${id}#${sub}` : id, note: id, sub: sub || null, ...extra });
    if (type === 'cloze') {
      if (!note.text) return bad(`${id}: cloze без поля text`);
      const ns = [...new Set([...note.text.matchAll(CLOZE_RE)].map((m) => +m[1]))].sort((a, b) => a - b);
      if (!ns.length) return bad(`${id}: у text немає {{c1::…}}`);
      return ns.map((n) => card(`c${n}`, { n }));
    }
    if (type === 'symbol') {
      if (!note.sym) return bad(`${id}: symbol без поля sym`);
      if (!note.back) return bad(`${id}: symbol без поля back`);
      return [card(null)];
    }
    if (type === 'image') {
      if (!note.img) return bad(`${id}: image без поля img`);
      if (!note.alt) problems.push(`${where} ${id}: image без alt (опис картинки обов’язковий)`);
    }
    if (!note.front || !note.back) return bad(`${id}: потрібні поля front і back`);
    if (type === 'reverse') return [card(null), card('r')];
    return [card(null)];
  }

  const deckCache = new Map(); // id → { id, title, lesson, cards, notes, problems }
  const filePromises = new Map();
  function loadDeck(id) {
    if (filePromises.has(id)) return filePromises.get(id);
    const p = fetchJSON(`data/cards/${encodeURIComponent(id)}.json`).then((data) => {
      if (!data || typeof data !== 'object' || !Array.isArray(data.cards)) {
        throw Object.assign(new Error(`cards/${id}.json: немає масиву cards`), { friendly: true });
      }
      const problems = [], cards = [], seen = new Set();
      data.cards.forEach((raw, k) => {
        for (const c of expand(raw, id, problems, `cards/${id}.json #${k + 1}`)) {
          if (seen.has(c.id)) { problems.push(`cards/${id}.json: id ${c.id} повторюється`); continue; }
          seen.add(c.id);
          cards.push(c);
        }
      });
      if (problems.length) console.warn('StudyCards: пропущено або виправлено картки\n' + problems.join('\n'));
      const d = { id, title: deckTitle(id, data), lesson: str(data.lesson) || null, verified: str(data.verified), cards, problems };
      deckCache.set(id, d);
      return d;
    });
    p.catch(() => filePromises.delete(id));
    filePromises.set(id, p);
    return p;
  }
  // Study cards of several decks. The array also carries .missing (deck ids that did not load) and .problems.
  async function load(deckIds) {
    const ids = list(deckIds);
    const res = await Promise.all(ids.map((id) => loadDeck(id).then((d) => ({ id, d }), (err) => ({ id, err }))));
    const out = [];
    out.missing = [];
    out.problems = [];
    for (const { id, d, err } of res) {
      if (err) { out.missing.push(id); if (err.friendly) out.problems.push(err.message); continue; }
      out.push(...d.cards);
      out.problems.push(...d.problems);
    }
    return out;
  }
  const loadedCards = (deckIds) => list(deckIds).flatMap((id) => (deckCache.get(id) || { cards: [] }).cards);

  /* ================================================================ queue + stats */
  // Round-robin over groups, so reviews from different decks alternate (interleaving).
  function interleave(groups) {
    const out = [], gs = groups.filter((g) => g.length).map((g) => g.slice());
    while (gs.some((g) => g.length)) for (const g of gs) if (g.length) out.push(g.shift());
    return out;
  }
  /**
   * Today's study queue for loaded decks: due reviews first (interleaved across decks), then new cards up to
   * newLimit minus the new cards already started today. Siblings (cloze gaps, reverse) of one note come later.
   */
  function queue({ decks: ids = [...deckCache.keys()], newLimit = 15, today = localISODate() } = {}) {
    const st = readState();
    const deckIds = list(ids);
    const due = deckIds.map((id) => loadedCards([id]).filter((c) => st.s[c.id] && st.s[c.id].d <= today)
      .sort((a, b) => (st.s[a.id].d < st.s[b.id].d ? -1 : st.s[a.id].d > st.s[b.id].d ? 1 : 0)));
    const budget = Math.max(0, newLimit - ((st.days[today] || {}).new || 0));
    const fresh1 = [], fresh2 = [];
    for (const id of deckIds) {
      const seenNotes = new Set();
      const a = [], b = [];
      for (const c of loadedCards([id])) {
        if (st.s[c.id]) { seenNotes.add(c.note); continue; }
        (seenNotes.has(c.note) ? b : a).push(c);
        seenNotes.add(c.note);
      }
      fresh1.push(a); fresh2.push(b);
    }
    const news = [...interleave(fresh1), ...interleave(fresh2)].slice(0, budget);
    return [...interleave(due), ...news];
  }

  function streak(st, today) {
    let d = (st.days[today] || {}).n ? today : addDays(today, -1), n = 0;
    while ((st.days[d] || {}).n > 0) { n++; d = addDays(d, -1); }
    return n;
  }
  /**
   * { due, newAvail, learned, streakDays, total, today: {n, ms, new}, goal (0…1), goalCards, nextDue: {day, count} | null }.
   * goalCards = min(20, today's reviews + what is still in today's queue), so a short day can be completed;
   * an emptied queue counts as the goal reached.
   * Without deck ids: due/learned over everything stored (works before any deck is loaded, e.g. on the course map).
   */
  function stats(deckIds, today = localISODate()) {
    const st = readState();
    const ids = deckIds ? list(deckIds) : null;
    const inDecks = (cardId) => !ids || ids.includes(deckOf(cardId));
    let due = 0, learned = 0, next = null;
    for (const [id, c] of Object.entries(st.s)) {
      if (!inDecks(id)) continue;
      if (c.d <= today) due++;
      else if (!next || c.d < next.day) next = { day: c.d, count: 1 };
      else if (c.d === next.day) next.count++;
      if (c.r > 0) learned++;
    }
    const cards = ids ? loadedCards(ids) : [...deckCache.values()].flatMap((d) => d.cards);
    const unseen = cards.filter((c) => !st.s[c.id]).length;
    const day = st.days[today] || { n: 0, ms: 0, new: 0 };
    const newAvail = Math.min(unseen, Math.max(0, 15 - day.new));
    const known = cards.length > 0; // decks loaded: today's queue is known
    const goalCards = known ? Math.max(1, Math.min(GOAL_CARDS, day.n + due + newAvail)) : GOAL_CARDS;
    const emptied = known && due === 0 && newAvail === 0;
    return {
      due, learned, newAvail, unseen, total: cards.length, streakDays: streak(st, today), today: day, goalCards,
      goal: emptied ? 1 : Math.min(1, Math.max(day.n / goalCards, day.ms / GOAL_MS)), nextDue: next,
    };
  }

  /* ================================================================ card faces */
  function clozeHTML(text, n, side) {
    return safe(text).replace(CLOZE_RE, (m, k, ans, hint) => {
      if (+k !== n) return ans;
      return side === 'q' ? `<span class="fc-gap">[${hint ? hint : '…'}]</span>` : `<mark class="fc-ans">${ans}</mark>`;
    });
  }
  const symHTML = (sym, label) => `<svg class="fc-sym" viewBox="-20 -45 100 90" role="img" aria-label="${esc(label || 'Схемний символ')}">
    <use href="${esc(new URL('assets/symbols.svg', base()).href)}#${esc(sym)}"/></svg>`;
  const imgHTML = (c) => `<img class="fc-img" src="${esc(new URL(c.img, base()).href)}" alt="${esc(c.alt)}" loading="lazy">`;

  // { q, a } HTML for a study card; flip = show the back first (only for term and symbol cards).
  function faces(c, flip = false) {
    const t = c.type;
    if (t === 'cloze') return { q: `<p>${clozeHTML(c.text, c.n, 'q')}</p>`, a: `<p>${clozeHTML(c.text, c.n, 'a')}</p>${c.extra ? `<p class="fc-extra">${safe(c.extra)}</p>` : ''}` };
    if (t === 'term') {
      const term = `<p class="fc-term">${safe(c.front)}</p>${c.en ? `<p class="fc-en"><span>англ.</span> ${safe(c.en)}</p>` : ''}`;
      return flip ? { q: `<p>${safe(c.back)}</p><p class="fc-ask">Який це термін?</p>`, a: term }
        : { q: `<p class="fc-term">${safe(c.front)}</p>`, a: `<p>${safe(c.back)}</p>${c.en ? `<p class="fc-en"><span>англ.</span> ${safe(c.en)}</p>` : ''}` };
    }
    if (t === 'symbol') {
      return flip ? { q: `<p>${safe(c.back)}</p><p class="fc-ask">Як виглядає цей символ?</p>`, a: symHTML(c.sym, c.alt) }
        : { q: `${symHTML(c.sym, c.alt)}<p>${safe(c.front || 'Що це за символ? Назвіть виводи.')}</p>`, a: `<p>${safe(c.back)}</p>` };
    }
    if (t === 'image') return { q: `${imgHTML(c)}<p>${safe(c.front)}</p>`, a: `<p>${safe(c.back)}</p>` };
    if (t === 'reverse' && c.sub === 'r') return { q: `<p>${safe(c.back)}</p>`, a: `<p>${safe(c.front)}</p>` };
    return { q: `<p>${safe(c.front)}</p>`, a: `<p>${safe(c.back)}</p>` };
  }
  function cardHTML(c, { flip = false, state = null, cram = false } = {}) {
    const f = faces(c, flip && (c.type === 'term' || c.type === 'symbol'));
    const typeName = c.type === 'reverse' && c.sub === 'r' ? 'Навпаки' : TYPES[c.type];
    const status = cram ? 'тренування' : !state ? 'нова' : state.r === 0 && state.l > 0 ? 'повторно вчу' : 'повторення';
    const ref = c.ref ? `<a class="fc-ref" href="${esc(new URL(c.ref, base()).href)}">Розділ уроку →</a>` : '';
    const by = c.author ? `<span class="fc-by">картка від ${esc(c.author)}</span>` : '';
    const mc = c.mc ? `<span class="fc-mc t-only">${esc(c.mc)}</span>` : '';
    return `<div class="fc-meta"><span class="fc-deck">${esc(deckShort(c.deck))}</span><span class="fc-type t-${esc(c.type)}">${esc(typeName)}</span>${mc}<span class="fc-status">${status}</span></div>
      <div class="fc-q">${f.q}</div>
      <div class="fc-a" hidden><div class="fc-rule" aria-hidden="true"></div>${f.a}${ref || by ? `<p class="fc-foot">${ref}${by}</p>` : ''}</div>`;
  }

  /* ================================================================ session (shared by mini widget and trainer) */
  let activeSession = null;
  // Programmatic focus shows its ring only after keyboard use (a tap on «Почати» should not draw a ring).
  let viaPointer = false;
  doc.addEventListener('pointerdown', () => { viaPointer = true; }, true);
  doc.addEventListener('keydown', () => { viaPointer = false; }, true);
  const focusQuiet = (el) => { if (el) el.focus({ preventScroll: true, focusVisible: !viaPointer }); };
  doc.addEventListener('keydown', (e) => {
    const s = activeSession;
    if (!s || !s.host.isConnected || s.ended) return;
    if (e.target.closest('input, textarea, select, [contenteditable]') || e.altKey || e.ctrlKey || e.metaKey) return;
    if (!s.global && !s.engaged && !s.host.contains(doc.activeElement)) return;
    if (e.target.closest('button, a, summary') && (e.key === 'Enter' || e.key === ' ')) return; // let the control act
    if (e.key === ' ' || e.key === 'Enter') { if (!s.shown) { e.preventDefault(); s.flip(); } return; }
    const d = /^Digit([1-4])$/.exec(e.code) || /^Numpad([1-4])$/.exec(e.code);
    if (d && s.shown) { e.preventDefault(); s.answer(+d[1]); return; }
    if (e.key === 'Escape') s.end(true);
  });
  doc.addEventListener('pointerdown', (e) => { if (activeSession) activeSession.engaged = activeSession.host.contains(e.target); }, true);

  /**
   * Runs one session in `host`. cards = queue order. opts: { cram, flip, global (page-wide keys), onEnd(summary), title }.
   * Grade 1 in a normal session puts the card back after 3 more cards; cram mode changes no state and makes one pass.
   */
  function session(host, cards, opts = {}) {
    const q = cards.slice();
    const s = { host, global: !!opts.global, engaged: !!opts.global, shown: false, ended: false };
    const tally = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const started = Date.now();
    let idx = 0, shownAt = Date.now(), reviewed = 0;
    const seen = new Set();
    host.innerHTML = `<div class="fc-session${opts.cram ? ' cram' : ''}">
      <div class="fc-top">
        <div class="fc-bar" role="progressbar" aria-label="Пройдено карток" aria-valuemin="0"><span></span></div>
        <span class="fc-left"></span>
        <button type="button" class="btn ghost sm fc-quit">Завершити</button>
      </div>
      <article class="fc-card" tabindex="-1" aria-live="polite"></article>
      <div class="fc-actions"></div>
    </div>`;
    const cardEl = $('.fc-card', host), acts = $('.fc-actions', host), bar = $('.fc-bar', host);
    const draw = () => {
      const c = q[idx];
      const st = readState().s[c.id];
      s.shown = false;
      cardEl.className = `fc-card type-${c.type}`;
      cardEl.innerHTML = cardHTML(c, { flip: opts.flip, state: st, cram: opts.cram });
      bar.setAttribute('aria-valuemax', String(q.length));
      bar.setAttribute('aria-valuenow', String(idx));
      $('span', bar).style.width = `${(idx / q.length) * 100}%`;
      $('.fc-left', host).textContent = `${idx + 1}${NBSP}/${NBSP}${q.length}`;
      acts.innerHTML = '<button type="button" class="btn primary fc-flip">Показати відповідь <kbd>Пробіл</kbd></button>';
      $('.fc-flip', acts).addEventListener('click', s.flip);
      shownAt = Date.now();
    };
    s.flip = () => {
      if (s.shown || s.ended) return;
      s.shown = true;
      $('.fc-a', cardEl).hidden = false;
      cardEl.classList.add('flipped');
      const c = q[idx];
      const labels = opts.cram ? null : preview(c.id);
      acts.innerHTML = `<div class="fc-grades" role="group" aria-label="Наскільки легко згадали?">${GRADES.map(([g, name]) => `
        <button type="button" class="fc-g g${g}" data-g="${g}"><b>${name}</b><span>${opts.cram ? (g === 1 ? 'не знаю' : 'знаю') : labels[g]}</span><kbd>${g}</kbd></button>`).join('')}</div>`;
      $$('.fc-g', acts).forEach((b) => b.addEventListener('click', () => s.answer(+b.dataset.g)));
      focusQuiet(cardEl);
    };
    s.answer = (g) => {
      if (!s.shown || s.ended) return;
      const c = q[idx];
      tally[g]++;
      reviewed++;
      seen.add(c.id);
      if (!opts.cram) {
        grade(c.id, g, { ms: Date.now() - shownAt });
        if (g === 1) q.splice(Math.min(q.length, idx + 4), 0, c);
        if (typeof opts.onGrade === 'function') opts.onGrade();
      }
      idx++;
      if (idx >= q.length) s.end(false);
      else { draw(); focusQuiet($('.fc-flip', acts)); }
    };
    s.end = (quit) => {
      if (s.ended) return;
      s.ended = true;
      if (activeSession === s) activeSession = null;
      const summary = { reviewed, cards: seen.size, tally, ms: Date.now() - started, quit: !!quit, cram: !!opts.cram };
      if (typeof opts.onEnd === 'function') opts.onEnd(summary);
    };
    $('.fc-quit', host).addEventListener('click', () => s.end(true));
    // Tapping the card shows the answer (the touch-screen counterpart of Space).
    cardEl.addEventListener('click', (e) => { if (!e.target.closest('a, button, input')) s.flip(); });
    host.addEventListener('focusin', () => { activeSession = s; });
    activeSession = s;
    draw();
    return s;
  }

  function summaryHTML(sum, deckIds) {
    const st = stats(deckIds);
    const mins = Math.max(1, Math.round(sum.ms / 60000));
    // Distinct cards first; a card answered «Знову» comes back in the same session, and those are repeats.
    const distinct = sum.cards ?? sum.reviewed, rep = sum.reviewed - distinct;
    const line = sum.reviewed ? `${sum.quit ? 'Зупинилися' : 'Готово'}: ${cardsWord(distinct)}${rep > 0 ? ` · ${rep}${NBSP}${plural(rep, 'повтор', 'повтори', 'повторів')}` : ''} за ${mins}${NBSP}хв.` : 'Сесію завершено.';
    const tally = sum.reviewed ? `<p class="fc-tally">${GRADES.map(([g, n]) => `<span class="g${g}">${n}: <b>${sum.tally[g]}</b></span>`).join('')}</p>` : '';
    const more = sum.cram ? 'Це було тренування: розклад повторень не змінився.' : nextLine(st);
    return `<p class="fc-done-h">${line}</p>${tally}<p>${more}</p>`;
  }
  function nextLine(st) {
    if (st.due > 0) return `Ще до повторення: ${cardsWord(st.due)}.`;
    if (!st.nextDue) return 'Наступне повторення з’явиться, коли ви вивчите перші картки.';
    const d = daysBetween(localISODate(), st.nextDue.day);
    return `Наступне повторення: ${d === 1 ? 'завтра' : `${fmtDay(st.nextDue.day)} (через ${d}${NBSP}дн.)`} — ${cardsWord(st.nextDue.count)}.`;
  }

  /* ================================================================ goal ring */
  function ringHTML(st) {
    const r = 30, c = 2 * Math.PI * r, p = st.goal;
    const mins = Math.floor(st.today.ms / 60000);
    const done = p >= 1;
    return `<svg class="fc-ring${done ? ' done' : ''}" viewBox="0 0 76 76" role="img" aria-label="Мета дня: ${st.today.n} з ${st.goalCards} карток або ${mins} з 10 хвилин${done ? ', виконано' : ''}">
      <circle cx="38" cy="38" r="${r}" class="bg"/>
      ${p > 0 ? `<circle cx="38" cy="38" r="${r}" class="fg" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 38 38)"/>` : ''}
      <text x="38" y="${done ? 45 : 42}" text-anchor="middle" class="big">${done ? '✓' : `${st.today.n}`}</text>
      ${done ? '' : `<text x="38" y="56" text-anchor="middle" class="sm">з ${st.goalCards}</text>`}</svg>`;
  }
  function goalHTML(st) {
    const sub = st.goal >= 1
      ? `На сьогодні все ✓${st.streakDays ? ` · серія ${st.streakDays}${NBSP}дн.` : ''}`
      : `${cardsWord(st.goalCards)} або 10${NBSP}хв`;
    return `${ringHTML(st)}<span class="fc-goal-l">Мета дня<br><small>${sub}</small></span>`;
  }
  // Keyboard hint for keyboards, tap hint for touch screens (the injected CSS shows one of them).
  const HINTS = '<span class="kbd-hint"><kbd>Пробіл</kbd> — відповідь, <kbd>1</kbd>–<kbd>4</kbd> — оцінка.</span><span class="touch-hint">Торкніться картки — відповідь.</span>';

  /* ================================================================ downloads + Anki export */
  function download(name, text, type = 'text/plain;charset=utf-8') {
    const blob = text instanceof Blob ? text : new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = doc.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener';
    doc.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  // A TSV field: tabs and line breaks become spaces / <br>; quotes force CSV-style quoting.
  const tsv = (s) => {
    const v = String(s ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');
    return /"/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const flatName = (deck, img) => `${deck}__${String(img).split('/').pop()}`;
  const ankiTags = (c) => [...c.tags.map((t) => t.replace(/\s+/g, '_')), `esp32s3::${c.deck}`].join(' ');
  const ankiDeck = (id) => `${ANKI_ROOT}::${deckShort(id)}`;

  /**
   * Anki TSV texts (§2.4): { basic, cloze, images: [{url, name}], counts: {basic, cloze}, skipped: [ids] }.
   * Async because the decks are loaded first. One deck → #deck header; several → a deck column.
   */
  async function exportAnki(deckIds) {
    const ids = list(deckIds);
    await load(ids);
    const present = ids.filter((id) => deckCache.has(id));
    const multi = present.length > 1;
    const head = (type) => ['#separator:Tab', '#html:true', `#notetype:${type}`, multi ? '#deck column:5' : `#deck:${ankiDeck(present[0] || 'deck')}`,
      '#guid column:1', '#tags column:4'].join('\n');
    const basic = [], cloze = [], images = [], skipped = [];
    const row = (cells, deck) => (multi ? [...cells, ankiDeck(deck)] : cells).map(tsv).join('\t');
    for (const id of present) {
      const seenNotes = new Set();
      for (const c of deckCache.get(id).cards) {
        if (c.type === 'cloze') {
          if (seenNotes.has(c.note)) continue;
          seenNotes.add(c.note);
          cloze.push(row([c.note, c.text, c.extra, ankiTags(c)], id));
          continue;
        }
        let front = c.front, back = c.back;
        if (c.type === 'reverse' && c.sub === 'r') [front, back] = [c.back, c.front];
        if (c.type === 'term' && c.en) back = `${back}<br><i>англ.: ${c.en}</i>`;
        if (c.type === 'image') {
          const name = flatName(id, c.img);
          images.push({ url: new URL(c.img, base()).href, name });
          front = `<img src="${name}" alt="${esc(c.alt)}"><br>${front}`;
        }
        if (c.type === 'symbol') {
          skipped.push(c.id);
          front = `Схемний символ <code>${esc(c.sym)}</code>${c.front ? '<br>' + c.front : ''}`;
        }
        basic.push(row([c.id, front, back, ankiTags(c)], id));
      }
    }
    return {
      basic: basic.length ? `${head('Basic')}\n${basic.join('\n')}\n` : '',
      cloze: cloze.length ? `${head('Cloze')}\n${cloze.join('\n')}\n` : '',
      images, skipped, counts: { basic: basic.length, cloze: cloze.length },
    };
  }
  const fileStem = (ids) => `esp32-s3-cards-${list(ids).length > 3 ? 'all' : list(ids).join('_')}`;
  // Downloads the Basic and Cloze files (only the non-empty ones). Returns the export object.
  async function downloadAnki(deckIds) {
    const ex = await exportAnki(deckIds);
    const stem = fileStem(deckIds);
    if (!ex.basic && !ex.cloze) { toast('У вибраних колодах немає карток для експорту', 'bad'); return ex; }
    if (ex.basic) download(`${stem}-basic.txt`, ex.basic);
    if (ex.cloze) setTimeout(() => download(`${stem}-cloze.txt`, ex.cloze), 400);
    toast(`Anki: ${ex.counts.basic} Basic + ${ex.counts.cloze} Cloze`);
    return ex;
  }
  async function downloadImages(deckIds) {
    const ex = await exportAnki(deckIds);
    if (!ex.images.length) { toast('У вибраних колодах немає карток із зображеннями'); return 0; }
    let n = 0;
    for (const im of ex.images) {
      try {
        const r = await fetch(im.url);
        if (!r.ok) throw new Error(r.status);
        download(im.name, await r.blob());
        n++;
        await new Promise((res) => setTimeout(res, 350)); // browsers block bursts of downloads
      } catch { toast(`Не вдалося завантажити ${im.name}`, 'bad'); }
    }
    return n;
  }

  /* ================================================================ progress backup */
  function exportProgress() {
    return JSON.stringify({ app: 'esp32-s3-study', kind: 'progress', v: 1, exported: new Date().toISOString(),
      cards: readState(), quiz: rawStore.get('study.quiz.v1', {}) || {} }, null, 1);
  }
  // Merges a backup into this browser: per card the more practised record wins. Returns { cards, quiz }.
  function importProgress(json) {
    let data;
    try { data = typeof json === 'string' ? JSON.parse(json) : json; } catch { throw new Error('Це не JSON-файл прогресу.'); }
    const cardsIn = data && (data.cards || (data.s ? data : null));
    if (!cardsIn || typeof cardsIn !== 'object' || !cardsIn.s || typeof cardsIn.s !== 'object') {
      throw new Error('У файлі немає даних карток (очікувався файл, збережений кнопкою «Зберегти прогрес»).');
    }
    const st = readState();
    let n = 0;
    for (const [id, c] of Object.entries(cardsIn.s)) {
      if (!validCard(c)) continue;
      const cur = st.s[id];
      const score = (x) => x.r + x.l;
      if (!cur || score(c) > score(cur) || (score(c) === score(cur) && c.d > cur.d)) { st.s[id] = { r: c.r, i: c.i, e: c.e, d: c.d, l: c.l }; n++; }
    }
    if (cardsIn.days && typeof cardsIn.days === 'object') {
      for (const [d, v] of Object.entries(cardsIn.days)) {
        if (!isISO(d) || !v) continue;
        const cur = dayRec(st, d);
        cur.n = Math.max(cur.n, +v.n || 0); cur.ms = Math.max(cur.ms, +v.ms || 0); cur.new = Math.max(cur.new, +v.new || 0);
      }
    }
    writeState(st);
    let q = 0;
    if (data.quiz && typeof data.quiz === 'object') {
      const all = rawStore.get('study.quiz.v1', {}) || {};
      for (const [k, v] of Object.entries(data.quiz)) {
        if (!v || typeof v !== 'object' || !Number.isFinite(+v.best)) continue;
        if (!all[k] || +v.best > +all[k].best) { all[k] = v; q++; }
      }
      rawStore.set('study.quiz.v1', all);
    }
    return { cards: n, quiz: q };
  }
  function resetProgress() { rawStore.del(KEY); }

  /* ================================================================ mini deck widget (lesson hubs) */
  function mini(el) {
    if (typeof el === 'string') el = $(el);
    if (!el || el._fcMini) return;
    el._fcMini = true;
    el.classList.add('fc-mini');
    const deck = el.dataset.deck;
    const n = Math.max(1, Math.min(50, +el.dataset.n || 8));
    if (!deck) { el.innerHTML = '<p class="fc-msg">Колоду не вказано (data-deck).</p>'; return; }
    const trainerURL = new URL(`cards/?deck=${encodeURIComponent(deck)}`, base()).href;
    const repo = window.COURSE && window.COURSE.repo;
    const links = `<p class="fc-links"><a href="${esc(trainerURL)}">Усі картки в тренажері →</a>
      <button type="button" class="linkish fc-anki">Експорт в Anki</button>
      ${repo ? `<a href="${esc(repo.replace(/\/$/, ''))}/discussions" target="_blank" rel="noopener">Запропонувати свою картку ↗</a>` : ''}</p>`;
    const start = () => {
      const st = stats([deck]);
      const q = queue({ decks: [deck] }).slice(0, n);
      const d = deckCache.get(deck);
      el.innerHTML = `<div class="fc-mini-head"><span class="tag">Картки уроку</span><span class="fc-mini-stats">${cardsWord(d.cards.length)} · ${q.length ? `${q.length} на сьогодні` : 'на сьогодні все'}</span></div>
        <div class="fc-mini-body"></div>${links}`;
      const body = $('.fc-mini-body', el);
      $('.fc-anki', el).addEventListener('click', () => downloadAnki([deck]));
      if (!q.length) {
        body.innerHTML = `<div class="fc-empty"><p class="fc-done-h">На сьогодні все.</p><p>${nextLine(st)}</p>
          <button type="button" class="btn fc-cram">Тренування уроку (${cardsWord(d.cards.length)})</button></div>`;
        $('.fc-cram', body).addEventListener('click', () => run(d.cards, true));
        return;
      }
      body.innerHTML = `<div class="fc-start"><p><b>${cardsWord(q.length)}</b> на ≈${NBSP}${Math.max(1, Math.round(q.length * 0.4))}${NBSP}хв: спершу згадайте відповідь, потім відкрийте її й чесно оцініть.</p>
        <div class="btn-row"><button type="button" class="btn primary fc-go">Почати</button>
        <button type="button" class="btn ghost fc-cram">Тренування уроку</button></div></div>`;
      $('.fc-go', body).addEventListener('click', () => run(q, false));
      $('.fc-cram', body).addEventListener('click', () => run(d.cards, true));
    };
    const run = (cards, cram) => {
      const body = $('.fc-mini-body', el);
      session(body, cards, {
        cram, onEnd: (sum) => {
          body.innerHTML = `<div class="fc-empty">${summaryHTML(sum, [deck])}<div class="btn-row">
            <button type="button" class="btn fc-again">${cram ? 'Ще раз' : 'Далі'}</button><a class="btn ghost" href="${esc(trainerURL)}">Тренажер →</a></div></div>`;
          $('.fc-again', body).addEventListener('click', () => (cram ? run(cards, true) : start()));
        },
      });
      focusQuiet($('.fc-flip', body));
    };
    el.innerHTML = '<p class="fc-msg">Завантаження карток…</p>';
    loadDeck(deck).then(start, (err) => {
      const file = location.protocol === 'file:';
      el.innerHTML = `<p class="fc-msg"><b>Картки цього уроку ще не опубліковані.</b> ${file ? 'Або відкрийте сайт через http:// (не file://).' : ''}</p>${err && err.friendly ? `<p class="small">${esc(err.message)}</p>` : ''}`;
    });
  }

  /* ================================================================ full trainer (docs/cards/) */
  // «Самоперевірка уроку N →» + «Карта курсу»: the lesson of the only selected lesson deck, otherwise the latest
  // lesson with a hub whose date has come. inRow = links for an existing .btn-row.
  function whereNext(ids, inRow = false) {
    const ls = courseLessons() || [];
    const hub = (l) => l && (l.status === 'ready' || l.status === 'draft');
    const today = localISODate();
    const own = ids.length === 1 ? ls.find((l) => l.id === ids[0]) : null;
    const l = hub(own) ? own : ls.filter((x) => hub(x) && x.date && x.date <= today).pop();
    const keys = `${l ? `<a class="btn" href="${esc(new URL((l.hub || `lessons/${l.id}/`) + '#check', base()).href)}">Самоперевірка: ${esc(lessonName(l).replace(/^Урок/, 'урок'))} →</a>` : ''}
      <a class="btn ghost" href="${esc(base())}">Карта курсу</a>`;
    return inRow ? keys : `<div class="btn-row">${keys}</div>`;
  }
  function trainer(el, opts = {}) {
    if (typeof el === 'string') el = $(el);
    if (!el) throw new Error('StudyCards.trainer: element not found');
    const params = new URLSearchParams(location.search);
    const urlDecks = params.get('deck') ? list(params.get('deck')) : null;
    let available = [];   // [{id, title, group, cards}]
    let selected = new Set();
    let flip = !!readState().ui.flip;

    el.classList.add('fc-trainer');
    el.innerHTML = `
      <section class="fc-dash panel" aria-label="Сьогодні">
        <div class="fc-goal"></div>
        <div class="fc-nums"></div>
        <div class="fc-start-row">
          <button type="button" class="btn primary fc-review">Повторити сьогодні</button>
          <button type="button" class="btn fc-cram">Тренування уроку</button>
          <button type="button" class="btn ghost sm fc-flipmode" aria-pressed="${flip}" title="Для карток-термінів і символів: спершу визначення, потім термін">Перевернути</button>
        </div>
      </section>
      <div class="fc-stage" aria-live="polite"></div>
      <section class="fc-decks panel" aria-labelledby="fc-decks-h">
        <div class="ph"><h3 id="fc-decks-h">Колоди</h3><div class="fc-decks-ctl">
          <button type="button" class="btn ghost sm fc-all">Усі</button><button type="button" class="btn ghost sm fc-none">Жодної</button></div></div>
        <div class="pb"><div class="fc-deck-list"><p class="fc-msg">Завантаження колод…</p></div></div>
      </section>
      <details class="fc-tools panel" id="export">
        <summary>Експорт в Anki і резервна копія прогресу</summary>
        <div class="pb">
          <h4>Anki</h4>
          <p>Два файли, бо Anki імпортує один тип нотаток за раз: <b>Basic</b> (звичайні картки) і <b>Cloze</b> (з пропусками). Експортуються вибрані колоди.</p>
          <div class="btn-row"><button type="button" class="btn fc-anki">Завантажити для Anki</button>
            <button type="button" class="btn ghost fc-imgs">Завантажити зображення колоди</button></div>
          <ol class="fc-howto">
            <li>В Anki: <b>Файл → Імпорт</b>, виберіть файл <code>…-basic.txt</code>, потім <code>…-cloze.txt</code>. Тип нотаток і колода вже записані в заголовку файлу.</li>
            <li>Картки з картинками: завантажте зображення і скопіюйте їх у папку <code>collection.media</code> свого профілю Anki (<b>Інструменти → Перевірити медіа</b> покаже, чого бракує).</li>
            <li>Повторний імпорт оновлює наявні картки (їхній id — це GUID), а не дублює їх. Розклад повторень в Anki і на сайті окремий.</li>
            <li>Картки-символи експортуються як текст із назвою символу: малюнок символу є лише на сайті.</li>
          </ol>
          <h4>Прогрес</h4>
          <p>Прогрес зберігається лише в цьому браузері. Щоб перенести його на інший пристрій або не втратити після очищення даних сайту, збережіть файл.</p>
          <div class="btn-row">
            <button type="button" class="btn fc-save">Зберегти прогрес</button>
            <label class="btn ghost fc-load-l">Відновити з файлу<input type="file" accept="application/json,.json" class="sr-only fc-load"></label>
            <button type="button" class="btn ghost sm fc-reset">Скинути прогрес карток</button>
          </div>
        </div>
      </details>`;
    const stage = $('.fc-stage', el), listEl = $('.fc-deck-list', el);
    const sel = () => available.filter((d) => selected.has(d.id)).map((d) => d.id);
    const saveUI = () => { const st = readState(); st.ui = { ...st.ui, decks: [...selected], flip }; writeState(st); };

    function drawDash() {
      const ids = sel();
      const st = stats(ids);
      const qn = queue({ decks: ids }).length;
      $('.fc-goal', el).innerHTML = goalHTML(st);
      $('.fc-nums', el).innerHTML = `
        <div><b>${st.due}</b><span>до повторення</span></div>
        <div><b>${st.newAvail}</b><span>нових сьогодні</span></div>
        <div><b>${st.learned}</b><span>у розкладі</span></div>
        <div><b>${st.streakDays}</b><span>${plural(st.streakDays, 'день', 'дні', 'днів')} поспіль</span></div>`;
      const rb = $('.fc-review', el);
      rb.textContent = qn ? `Повторити сьогодні (${qn})` : ids.length ? 'На сьогодні все' : 'Повторити сьогодні';
      rb.disabled = !ids.length || !qn;
      rb.classList.toggle('primary', !!qn);
      $('.fc-cram', el).disabled = !ids.length;
      return { st, qn };
    }
    function drawDecks() {
      if (!available.length) {
        listEl.innerHTML = '<p class="fc-msg">Колоди ще не опубліковані. Щойно з’являться картки уроків, вони будуть тут.</p>';
        return;
      }
      const st = readState(), today = localISODate();
      let group = null;
      listEl.innerHTML = available.map((d) => {
        const cards = deckCache.get(d.id).cards;
        const due = cards.filter((c) => st.s[c.id] && st.s[c.id].d <= today).length;
        const neu = cards.filter((c) => !st.s[c.id]).length;
        const g = d.group && d.group !== group ? `<p class="fc-group">${esc(d.group)}</p>` : '';
        group = d.group;
        return `${g}<label class="fc-deck-row"><input type="checkbox" value="${esc(d.id)}"${selected.has(d.id) ? ' checked' : ''}>
          <span class="fc-deck-t">${esc(d.title)}${d.demo ? ' <span class="fc-demo">демо</span>' : ''}</span>
          <span class="fc-deck-n" title="${esc(cardsWord(cards.length))} у колоді">${[due ? `<b>${due}</b> до повт.` : '', neu ? `${neu} ${plural(neu, 'нова', 'нові', 'нових')}` : ''].filter(Boolean).join(' · ') || 'усе за розкладом'}</span></label>`;
      }).join('');
      $$('input', listEl).forEach((cb) => cb.addEventListener('change', () => {
        cb.checked ? selected.add(cb.value) : selected.delete(cb.value);
        saveUI(); drawDash(); idle();
      }));
    }
    function idle() {
      const ids = sel();
      const { st, qn } = drawDash();
      $('.fc-review', el).hidden = false;
      if (!available.length) { stage.innerHTML = ''; return; }
      if (!ids.length) { stage.innerHTML = '<div class="fc-empty panel"><p>Виберіть хоча б одну колоду нижче.</p></div>'; return; }
      if (!qn) {
        const limit = st.unseen > 0 && st.newAvail === 0;
        stage.innerHTML = `<div class="fc-empty panel"><p class="fc-done-h">На сьогодні все.</p>
          <p>${limit ? 'Нові картки на сьогодні вичерпано (15 на день): так легше втримати розклад. ' : ''}${nextLine(st)} Повертайтеся завтра.</p>
          <p class="small">Хочете ще? «Тренування уроку» проганяє всі картки вибраних колод без запису в розклад.</p>${whereNext(ids)}</div>`;
        return;
      }
      // The ready panel's «Почати» is the one primary start; the dashboard key would only repeat it.
      $('.fc-review', el).hidden = true;
      stage.innerHTML = `<div class="fc-empty panel fc-ready"><p class="fc-done-h">Сьогодні: ${cardsWord(qn)}</p>
        <p>${st.due ? `${st.due} до повторення` : 'Повторень немає'}${qn - Math.min(st.due, qn) > 0 ? ` і ${qn - Math.min(st.due, qn)} нових` : ''}. Спершу згадайте відповідь, потім відкрийте й оцініть. ${HINTS}</p>
        <button type="button" class="btn primary fc-go">Почати</button></div>`;
      $('.fc-go', stage).addEventListener('click', () => run(false));
    }
    function run(cram) {
      const ids = sel();
      const cards = cram ? loadedCards(ids) : queue({ decks: ids });
      if (!cards.length) { idle(); return; }
      el.classList.add('in-session');
      session(stage, cards, {
        cram, flip, global: true,
        // Keep the goal ring and the counters live while the session runs.
        onGrade: () => drawDash(),
        onEnd: (sum) => {
          el.classList.remove('in-session');
          drawDash(); drawDecks();
          stage.innerHTML = `<div class="fc-empty panel">${summaryHTML(sum, ids)}${sum.cram || stats(ids).due ? '' : '<p>Повертайтеся завтра: кілька хвилин щодня тримають розклад.</p>'}<div class="btn-row">
            <button type="button" class="btn primary fc-back">Готово</button>${whereNext(ids, true)}</div></div>`;
          $('.fc-back', stage).addEventListener('click', idle);
          focusQuiet($('.fc-back', stage));
        },
      });
      stage.scrollIntoView({ behavior: S() && S().reducedMotion() ? 'auto' : 'smooth', block: 'start' });
      focusQuiet($('.fc-flip', stage));
    }

    $('.fc-review', el).addEventListener('click', () => run(false));
    $('.fc-cram', el).addEventListener('click', () => run(true));
    $('.fc-flipmode', el).addEventListener('click', (e) => {
      flip = !flip;
      e.currentTarget.setAttribute('aria-pressed', String(flip));
      saveUI();
      toast(flip ? 'Терміни і символи: спершу визначення' : 'Терміни і символи: спершу термін');
    });
    $('.fc-all', el).addEventListener('click', () => { available.forEach((d) => selected.add(d.id)); saveUI(); drawDecks(); idle(); });
    $('.fc-none', el).addEventListener('click', () => { selected.clear(); saveUI(); drawDecks(); idle(); });
    $('.fc-anki', el).addEventListener('click', () => (sel().length ? downloadAnki(sel()) : toast('Спершу виберіть колоди', 'bad')));
    $('.fc-imgs', el).addEventListener('click', () => (sel().length ? downloadImages(sel()) : toast('Спершу виберіть колоди', 'bad')));
    $('.fc-save', el).addEventListener('click', () => download(`esp32-s3-progress-${localISODate()}.json`, exportProgress(), 'application/json'));
    $('.fc-load', el).addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try {
        const r = importProgress(await f.text());
        toast(`Відновлено: ${cardsWord(r.cards)}${r.quiz ? `, результати квізів: ${r.quiz}` : ''}`);
        drawDecks(); idle();
      } catch (err) { toast(err.message || 'Не вдалося прочитати файл', 'bad'); }
    });
    $('.fc-reset', el).addEventListener('click', () => {
      if (!confirm('Скинути весь прогрес карток у цьому браузері? Це не можна скасувати (хіба що з файлу резервної копії).')) return;
      resetProgress(); drawDecks(); idle(); toast('Прогрес карток скинуто');
    });

    // Discover decks: COURSE lessons + global decks; missing files are skipped. The demo deck appears only when nothing else exists.
    const cands = opts.decks ? list(opts.decks).map((id) => ({ id, title: id })) : decks();
    // ?deck=notation opens a deck even before it is listed in COURSE.
    for (const id of urlDecks || []) if (!cands.some((d) => d.id === id)) cands.push({ id, title: id, group: 'Інші колоди' });
    (async () => {
      const got = await Promise.all(cands.map((d) => loadDeck(d.id).then((x) => ({ ...d, title: x.title || d.title, cards: x.cards.length }), () => null)));
      available = got.filter(Boolean);
      if (!available.length) {
        const demo = await loadDeck('_sample').then((x) => ({ id: '_sample', title: x.title, group: 'Демо', demo: true, cards: x.cards.length }), () => null);
        if (demo) available = [demo];
      }
      const stored = readState().ui.decks;
      const want = urlDecks || (Array.isArray(stored) ? stored : null);
      selected = new Set(available.map((d) => d.id).filter((id) => !want || want.includes(id)));
      if (!selected.size) available.forEach((d) => selected.add(d.id));
      drawDecks();
      idle();
      // ../cards/#export (link on start/) opens the Anki/backup panel.
      if (location.hash === '#export') { const t = $('#export', el); if (t) { t.open = true; t.scrollIntoView({ block: 'start' }); } }
      const m = params.get('mode');
      if (m === 'cram' || m === 'review') run(m === 'cram');
    })().catch((e) => { console.error(e); listEl.innerHTML = '<p class="fc-msg">Не вдалося завантажити колоди. Оновіть сторінку.</p>'; });
    return { refresh: () => { drawDecks(); idle(); } };
  }

  /* ================================================================ styles */
  const CSS = `
.deck-mini.fc-mini { padding: 16px 18px; box-shadow: var(--shadow); }
.fc-msg { margin: 0; color: var(--muted); }
.fc-mini-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 12px; align-items: baseline; margin-bottom: 10px; }
.fc-mini-stats { font: 500 13px var(--f-mono); color: var(--muted); }
.fc-links { display: flex; flex-wrap: wrap; gap: 6px 18px; align-items: center; margin: 12px 0 0; font-size: 15px; }
.linkish { background: none; border: 0; padding: 0; color: var(--accent); font: inherit; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; min-height: 32px; }
.fc-start p { margin: 0 0 4px; }
.fc-start .btn-row { margin-bottom: 0; }

/* card face: quiet paper card, the question stays visible above the answer */
.fc-session { display: grid; gap: 14px; }
.fc-top { display: flex; align-items: center; gap: 12px; }
.fc-bar { flex: 1 1 auto; height: 6px; border-radius: 99px; background: var(--panel-2); border: 1px solid var(--line); overflow: hidden; }
.fc-bar span { display: block; height: 100%; width: 0; background: var(--accent); border-radius: 99px; transition: width .3s ease-out; }
.fc-left { font: 600 13px var(--f-mono); color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.fc-card { position: relative; min-height: 220px; padding: 20px 22px 22px; border-radius: 14px; outline: none;
  background: var(--panel); border: 1px solid var(--line); box-shadow: var(--shadow);
  background-image: linear-gradient(180deg, color-mix(in srgb, var(--accent) 4%, transparent), transparent 90px); }
.fc-card:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 45%, transparent); outline-offset: 3px; }
.fc-meta { display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: center; margin-bottom: 16px; font: 600 13px/1.3 var(--f-mono); }
.fc-deck { color: var(--accent); }
.fc-type { color: var(--muted); padding: 1px 8px; border-radius: 999px; border: 1px solid var(--line); background: var(--panel-2); }
.fc-type.t-calc { color: var(--hi-ink); border-color: color-mix(in srgb, var(--hi) 45%, var(--line)); }
.fc-type.t-debug { color: var(--bad); border-color: color-mix(in srgb, var(--bad) 40%, var(--line)); }
.fc-type.t-why, .fc-type.t-cloze { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, var(--line)); }
.fc-mc { color: var(--teach); border: 1px dashed var(--teach); border-radius: 6px; padding: 0 6px; }
.fc-status { margin-left: auto; color: var(--muted); font-weight: 500; }
.fc-q, .fc-a { font: 400 22px/1.5 var(--f-body); text-wrap: pretty; }
.fc-q p, .fc-a p { margin: 0 0 10px; } .fc-q > :last-child, .fc-a > :last-child { margin-bottom: 0; }
.fc-q code, .fc-a code { font-size: .85em; }
.fc-term { font: 700 clamp(30px, 6vw, 40px)/1.15 var(--f-display); letter-spacing: .01em; }
.fc-en { font-size: 17px; color: var(--muted); }
.fc-en span { font: 600 13px var(--f-mono); text-transform: uppercase; letter-spacing: .06em; margin-right: 4px; }
.fc-ask { font-size: 16px; color: var(--muted); }
.fc-gap { display: inline-block; min-width: 3.2em; padding: 0 .35em; border-radius: 6px; text-align: center;
  color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, var(--panel)); border: 1.5px dashed var(--accent); }
.fc-ans { color: inherit; padding: 0 .25em; border-radius: 5px; background: color-mix(in srgb, var(--ok) 20%, var(--panel)); box-shadow: inset 0 -2px 0 var(--ok); }
.fc-img { display: block; max-width: 100%; max-height: 280px; width: auto; height: auto; margin: 0 0 12px; border-radius: 8px; border: 1px solid var(--line); background: #fff; }
.fc-sym { display: block; width: 220px; max-width: 100%; height: auto; margin: 0 auto 12px; color: var(--ink); fill: none; stroke: currentColor; }
.fc-a { animation: fc-reveal .28s ease-out; }
@keyframes fc-reveal { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
.fc-rule { height: 0; margin: 18px 0 16px; border-top: 1.5px dashed var(--line); }
.fc-extra { font-size: 17px; color: var(--muted); }
.fc-foot { display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 15px !important; margin-top: 12px !important; }
.fc-by { color: var(--muted); }
.fc-actions .btn.fc-flip { width: 100%; min-height: 52px; font-size: 16px; }
.fc-actions kbd { margin-left: 6px; font-size: 13px; color: inherit; background: transparent; border-color: currentColor; opacity: .75; }
.fc-grades { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.fc-g { position: relative; display: grid; gap: 2px; justify-items: center; min-height: 64px; padding: 9px 6px 8px; border-radius: 10px; cursor: pointer;
  border: 1px solid var(--line); background: var(--panel); color: var(--ink); font: 500 13px/1.25 var(--f-body); transition: border-color .15s, background-color .15s; }
.fc-g b { font: 600 16px/1.2 var(--f-body); }
.fc-g span { color: var(--muted); font-family: var(--f-mono); font-size: 13px; line-height: 1.3; text-align: center; text-wrap: balance; }
.fc-g kbd { position: absolute; top: 6px; right: 8px; font-size: 13px; border: 0; background: none; padding: 0; color: var(--muted); opacity: .7; }
.fc-g.g1 { border-top: 3px solid var(--bad); } .fc-g.g2 { border-top: 3px solid var(--hi); }
.fc-g.g3 { border-top: 3px solid var(--ok); } .fc-g.g4 { border-top: 3px solid var(--accent); }
.fc-g:hover { background: var(--panel-2); border-color: var(--accent); }
.fc-g.g1:hover { border-color: var(--bad); } .fc-g.g2:hover { border-color: var(--hi); } .fc-g.g3:hover { border-color: var(--ok); }
@media (max-width: 420px) { .fc-g kbd { display: none; } .fc-g b { font-size: 15px; } .fc-card { padding: 16px 16px 18px; } .fc-q, .fc-a { font-size: 20px; } }
.fc-session.cram .fc-status { color: var(--hi-ink); }
.fc-empty { padding: 16px 18px; }
.fc-empty > :last-child { margin-bottom: 0; }
.fc-done-h { font: 700 1.5rem/1.15 var(--f-display); margin: 0 0 8px !important; }
.fc-tally { display: flex; flex-wrap: wrap; gap: 4px 16px; font: 500 14px var(--f-mono); color: var(--muted); }
.fc-tally .g1 b { color: var(--bad); } .fc-tally .g2 b { color: var(--hi-ink); } .fc-tally .g3 b { color: var(--ok); } .fc-tally .g4 b { color: var(--accent); }

/* trainer */
.fc-trainer { display: grid; gap: 18px; margin: 8px 0 24px; }
.fc-dash { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 14px 20px; align-items: center; padding: 16px 18px; box-shadow: var(--shadow); }
.fc-goal { display: flex; align-items: center; gap: 12px; }
.fc-goal-l { font: 600 13px/1.35 var(--f-mono); letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
.fc-goal-l small { font-size: 13px; text-transform: none; letter-spacing: 0; font-weight: 400; }
.fc-ring { width: 76px; height: 76px; flex: none; }
.fc-ring circle { fill: none; stroke-width: 7; }
.fc-ring .bg { stroke: var(--line); }
.fc-ring .fg { stroke: var(--accent); stroke-linecap: round; transition: stroke-dasharray .6s ease-out; }
.fc-ring.done .fg { stroke: var(--ok); }
.fc-ring .big { font: 700 20px var(--f-mono); fill: var(--ink); }
.fc-ring.done .big { fill: var(--ok); font-size: 24px; }
.fc-ring .sm { font: 500 13px var(--f-mono); fill: var(--muted); }
.fc-nums { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; align-items: start; }
.fc-nums div { display: grid; gap: 0; padding: 6px 10px; border-left: 2px solid var(--line); min-width: 0; }
.fc-nums b { font: 700 26px/1.1 var(--f-display); font-variant-numeric: tabular-nums; }
.fc-nums span { font-size: 13px; color: var(--muted); line-height: 1.3; min-height: 2lh; }
.fc-start-row { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.fc-start-row .fc-flipmode { margin-left: auto; }
@media (max-width: 640px) {
  .fc-dash { grid-template-columns: minmax(0, 1fr); }
  .fc-nums { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fc-start-row .btn:not(.sm) { flex: 1 1 100%; }
  .fc-start-row .fc-flipmode { margin-left: 0; }
}
.fc-trainer.in-session .fc-decks { display: none; }
.fc-trainer.in-session .fc-tools { opacity: .55; }
.fc-ready .btn { margin-top: 6px; }
.fc-decks .ph h3 { font-family: var(--f-mono); font-size: 13px; }
.fc-decks-ctl { display: flex; gap: 6px; }
.fc-deck-list { display: grid; gap: 2px; }
.fc-group { margin: 10px 0 2px; font: 600 13px var(--f-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.fc-group:first-child { margin-top: 0; }
.fc-deck-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 4px 12px; align-items: center; min-height: 44px; padding: 6px 8px; border-radius: 8px; cursor: pointer; }
.fc-deck-row:hover { background: var(--panel-2); }
.fc-deck-row input { width: 20px; height: 20px; accent-color: var(--accent); margin: 0; }
.fc-deck-t { font-weight: 500; }
.fc-deck-n { font: 500 13px var(--f-mono); color: var(--muted); white-space: nowrap; }
.fc-deck-n b { color: var(--accent); }
.fc-demo { font: 600 13px var(--f-mono); color: var(--hi-ink); border: 1px solid currentColor; border-radius: 6px; padding: 0 5px; margin-left: 4px; }
@media (max-width: 480px) { .fc-deck-row { grid-template-columns: auto minmax(0, 1fr); } .fc-deck-n { grid-column: 2; } }
.fc-tools > summary { cursor: pointer; padding: 12px 16px; min-height: 48px; font-weight: 600; color: var(--accent); }
.fc-tools h4 { margin-top: 4px; }
.fc-howto { font-size: 15px; }
.fc-session .fc-card:not(.flipped) { cursor: pointer; }
.touch-hint { display: none; }
@media (hover: none) and (pointer: coarse) { .kbd-hint { display: none; } .touch-hint { display: inline; } }
.fc-load-l { position: relative; cursor: pointer; }
.fc-load-l:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
@media print { .fc-actions, .fc-top, .fc-tools, .fc-start-row { display: none !important; } .fc-a[hidden] { display: block !important; } }
`;
  function injectCSS() {
    if (doc.getElementById('study-cards-css')) return;
    const st = doc.createElement('style');
    st.id = 'study-cards-css';
    st.textContent = CSS;
    (doc.head || doc.documentElement).append(st);
  }
  injectCSS();

  window.StudyCards = {
    load, loadDeck, decks, queue, grade, preview, schedule, stats, exportAnki, downloadAnki, downloadImages,
    exportProgress, importProgress, resetProgress, trainer, mini, session, today: localISODate, version: 1,
  };

  const go = () => $$('.deck-mini[data-deck]').forEach(mini);
  if (window.Study && Study.ready) Study.ready(go);
  else if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', go, { once: true });
  else setTimeout(go);
})();
