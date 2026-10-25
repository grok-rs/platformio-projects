// site-nav.js: fills every nav.site-nav from window.COURSE (design brief §3.6, SPEC §9).
//
// Pages keep only the «← Карта курсу» link (.sn-home) in their markup; this script adds the rest from one data set
// (lessons with status 'ready' or 'draft'; planned ones live only on the course map; globals from COURSE.globals):
//   .sn-group (one per module, plus .sn-ref «Довідка»)  the flat list; phones show all of it in one sideways row;
//   details.sn-menu «Усі уроки ▾» and «Довідка ▾»       desktop only: the row shows just the current module's lessons
//                                                       (.sn-group.sn-here) and these two disclosures.
// The current page is found from nav[data-page]:
//   "lesson:1-4"      the hub of lesson 1-4: a filled pill;
//   "pull-resistors"  a deep page: one pill «1.4 GPIO › Підтяжка входу» (parent lesson link + the page itself);
//   "cards", "atlas"… a global page: the latest module is shown and «Довідка › Картки» is marked.
// Phones: «← Карта» and the theme switch are sticky ends of the scroller; their measured widths become the
// scroller's scroll-padding, so the current pill and every focused link stay in the visible gap (WCAG 2.4.11).
// Site search (second IIFE at the end): a «Пошук» button before the theme switch in every nav.site-nav and in the
// course map's [data-search-slot] top bar; «/» or Ctrl+K open it; the index is data/search.json.
// Deferred classic script, loaded after course.js.
(() => {
  'use strict';

  // Skip link + main landmark on every page (WCAG 2.4.1): pages without their own .skip get «До змісту» as the first
  // element of body, pointing at the first of main / article.hub / .wrap (given id="main" and, if the page has no
  // <main>, role="main"). tabindex=-1 so focus lands on the target. Done even without COURSE.
  (function skip() {
    const target = document.querySelector('main') || document.querySelector('article.hub') || document.querySelector('.wrap');
    if (!target) return;
    if (!document.querySelector('main, [role="main"]')) target.setAttribute('role', 'main');
    if (document.querySelector('a.skip, .skip-link')) return;
    if (!target.id) target.id = 'main';
    if (!target.hasAttribute('tabindex')) { target.tabIndex = -1; target.setAttribute('data-sn-main', ''); }
    const a = document.createElement('a');
    a.className = 'skip sn-skip';
    a.href = '#' + target.id;
    a.textContent = 'До змісту';
    document.body.prepend(a);
  })();

  // «← Карта курсу» → «← Карта» on phones (the rest stays in the accessible name). Done even without COURSE.
  document.querySelectorAll('nav.site-nav .sn-home').forEach((a) => {
    if (a.querySelector('.sn-long')) return;
    const t = [...a.childNodes].find((n) => n.nodeType === 3 && /Карта курсу/.test(n.nodeValue));
    if (!t) return;
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '←';
    const long = document.createElement('span');
    long.className = 'sn-long';
    long.textContent = ' курсу';
    t.replaceWith(arrow, ' Карта', long);
  });

  const C = window.COURSE;
  if (!C || !Array.isArray(C.modules)) return;

  // docs/ root from this script's URL (…/docs/assets/site-nav.js), so links work from any page depth.
  const self = document.currentScript || document.querySelector('script[src*="assets/site-nav.js"]');
  const base = new URL('../', self ? self.src : location.href);
  const url = (path) => new URL(path, base).href;

  const VISIBLE = new Set(['ready', 'draft']);
  const hubHref = (l) => url(l.hub || `lessons/${l.id}/`);
  const navLessons = (m) => (m.lessons || []).filter((l) => VISIBLE.has(l.status) && l.nav !== false);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function link(href, text, title) {
    const a = el('a', null, text);
    a.href = href;
    if (title) a.title = title;
    return a;
  }

  // Parse data-page into what to highlight.
  function current(nav) {
    const page = (nav.dataset.page || '').trim();
    if (page.startsWith('lesson:')) return { lesson: page.slice(7) };
    if (C.deepPages && C.deepPages[page]) return { deep: page, lesson: C.deepPages[page].lesson };
    return { global: page || null };
  }

  // A lesson link: «1.4» + « GPIO». On the desktop row only the number of the other lessons shows (.sn-t is then
  // visually hidden, so the accessible name keeps the title); a number used twice in a module keeps its title.
  function lessonLink(l, dup) {
    const a = link(hubHref(l), null, `Урок ${l.n} · ${l.title}${l.status === 'draft' ? ' (чернетка)' : ''}`);
    a.append(el('span', 'sn-n', l.n), el('span', 'sn-t', ` ${l.short || l.title}`));
    if (dup) a.classList.add('sn-keep');
    return a;
  }

  function lessonItems(m, cur) {
    const out = [];
    const seen = new Set();
    for (const l of navLessons(m)) {
      const a = lessonLink(l, seen.has(l.n));
      seen.add(l.n);
      if (cur.lesson !== l.id) { out.push(a); continue; }
      if (!cur.deep) { a.setAttribute('aria-current', 'page'); out.push(a); continue; }
      // Deep page: one pill = the parent lesson (current section) › the page itself (current page).
      a.setAttribute('aria-current', 'true');
      const d = C.deepPages[cur.deep];
      // the page: its title on the desktop row, its short name in the narrow phone gap
      const sub = link(url(cur.deep + '/'), null, d.title);
      sub.append(el('span', 'sn-long', d.title), el('span', 'sn-short', d.short || d.title));
      sub.className = 'sn-sub';
      sub.setAttribute('aria-current', 'page');
      const pill = el('span', 'sn-pill');
      pill.append(a, el('span', 'sn-sep', '›'), sub);
      pill.querySelector('.sn-sep').setAttribute('aria-hidden', 'true');
      out.push(pill);
    }
    return out;
  }

  function group(label, items, cls) {
    const g = el('span', 'sn-group' + (cls ? ' ' + cls : ''));
    g.append(el('span', 'sn-mod', label), ...items);
    return g;
  }

  // A disclosure menu (desktop): <details> gives Enter/Space and the open state for free; Esc, an outside click and
  // focus leaving it close it (see wireMenus).
  function menu(label, cls, build) {
    const d = el('details', 'sn-menu ' + cls);
    const s = el('summary', null);
    s.append(el('span', 'sn-sum', label), el('span', 'sn-caret', '▾'));
    s.lastChild.setAttribute('aria-hidden', 'true');
    const panel = el('div', 'sn-panel');
    build(panel);
    d.append(s, panel);
    return d;
  }

  function render(nav) {
    nav.querySelectorAll('.sn-group, .sn-menu').forEach((g) => g.remove());
    const cur = current(nav);
    const mods = C.modules.filter((m) => navLessons(m).length);
    const here = mods.find((m) => navLessons(m).some((l) => l.id === cur.lesson)) || mods[mods.length - 1];
    const nodes = [];

    for (const m of mods) {
      nodes.push(group(m.short || `Модуль ${m.id}`, lessonItems(m, cur), m === here ? 'sn-here' : ''));
    }
    const globals = C.globals || [];
    const refLink = (g) => {
      const a = link(url(g.href), g.short || g.title, g.title);
      if (cur.global === g.key) a.setAttribute('aria-current', 'page');
      return a;
    };
    // flat «Довідка» (phones): the nav:true pages plus the current one
    const flat = globals.filter((g) => g.nav || g.key === cur.global).map(refLink);
    if (flat.length) nodes.push(group('Довідка', flat, 'sn-ref'));

    // desktop disclosures
    nodes.push(menu('Усі уроки', 'sn-all', (p) => {
      for (const m of mods) {
        const sec = el('div', 'sn-msec');
        sec.append(el('p', 'sn-mod', m.title || m.short));
        const ul = el('ul');
        for (const l of navLessons(m)) {
          const li = el('li');
          const a = link(hubHref(l), null, l.status === 'draft' ? 'чернетка' : null);
          a.append(el('span', 'sn-n', l.n), el('span', null, l.title));
          if (cur.lesson === l.id) a.setAttribute('aria-current', cur.deep ? 'true' : 'page');
          li.append(a);
          ul.append(li);
        }
        sec.append(ul);
        p.append(sec);
      }
    }));
    const curRef = globals.find((g) => g.key === cur.global);
    const refs = menu('Довідка', 'sn-refs', (p) => {
      const ul = el('ul');
      globals.forEach((g) => { const li = el('li'); li.append(refLink(g)); ul.append(li); });
      p.append(ul);
    });
    if (curRef) {
      refs.classList.add('is-here');
      const s = refs.querySelector('.sn-sum');
      s.append(el('span', 'sn-sep', ' › '), el('span', 'sn-cur', curRef.short || curRef.title));
      s.querySelector('.sn-sep').setAttribute('aria-hidden', 'true');
    }
    nodes.push(refs);

    // after .sn-home, before the theme button if site-theme.js has already mounted it
    const before = nav.querySelector('.theme-btn');
    nodes.forEach((n) => nav.insertBefore(n, before));
    wireMenus(nav);
    wireScroller(nav);
  }

  function wireMenus(nav) {
    const menus = [...nav.querySelectorAll('details.sn-menu')];
    menus.forEach((d) => {
      d.addEventListener('toggle', () => {
        if (d.open) menus.forEach((o) => { if (o !== d) o.open = false; });
      });
      d.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || !d.open) return;
        d.open = false;
        d.querySelector('summary').focus();
        e.stopPropagation();
      });
      d.addEventListener('focusout', (e) => {
        if (d.open && e.relatedTarget && !d.contains(e.relatedTarget)) d.open = false;
      });
    });
    document.addEventListener('click', (e) => {
      menus.forEach((d) => { if (d.open && !d.contains(e.target)) d.open = false; });
    });
  }

  // ---- phones: the sideways scroller with sticky ends
  const isScroller = (nav) => nav.scrollWidth > nav.clientWidth + 1;
  const visible = (e) => e.offsetParent !== null && e.getClientRects().length > 0;

  // Desktop row too full for the search button: first its «Пошук /» label goes (icon only), then the «Тема» caption
  // of the theme switch; if the row wraps even then, the caption comes back (the wrap is not the button's fault).
  function tighten(nav) {
    nav.classList.remove('sn-tight1', 'sn-tight2');
    if (!nav.querySelector(':scope > .sn-search-btn') || !matchMedia('(min-width: 641px)').matches) return;
    const home = nav.querySelector('.sn-home');
    const last = nav.lastElementChild;
    const wraps = () => home && last && last.offsetTop > home.offsetTop + home.offsetHeight / 2;
    if (!wraps()) return;
    nav.classList.add('sn-tight1');
    if (!wraps()) return;
    nav.classList.add('sn-tight2');
    if (wraps()) nav.classList.remove('sn-tight2');
  }

  function fit(nav) {
    tighten(nav);
    // .sn-scroll: the strip overflows, so site-nav.css fades the links next to the pinned ends
    nav.classList.toggle('sn-scroll', isScroller(nav));
    if (!isScroller(nav)) return;
    const home = nav.querySelector('.sn-home');
    const theme = nav.querySelector(':scope > .theme-btn');
    const search = nav.querySelector(':scope > .sn-search-btn');
    const hw = home ? home.offsetWidth : 0;
    const th = theme ? theme.offsetWidth : 0;
    // the search button is pinned just left of the theme switch: the right pinned end is both of them
    const tw = th + (search ? search.offsetWidth + 12 : 0);
    nav.style.setProperty('--sn-home-w', hw + 8 + 'px');
    nav.style.setProperty('--sn-tw', th + 'px');
    nav.style.setProperty('--sn-theme-w', tw + 8 + 'px');
    // Re-centre only until the reader scrolls the strip themselves.
    if (nav.dataset.snScrolled === '1') return;
    let on = [...nav.querySelectorAll('.sn-pill, .sn-group a[aria-current="page"]')].find(visible);
    if (!on) return;
    const gap = nav.clientWidth - hw - tw - 16;
    // a deep-page pill wider than the gap: keep the page itself (its right part) in view
    if (on.offsetWidth > gap && on.classList.contains('sn-pill')) on = on.querySelector('a[aria-current="page"]');
    const left = on.offsetLeft - nav.offsetLeft - hw - 8 - Math.max(0, (gap - on.offsetWidth) / 2);
    nav.scrollLeft = Math.max(0, left);
  }

  function wireScroller(nav) {
    // Keyboard focus never hides under a sticky end: scroll-padding (above) + nearest.
    nav.addEventListener('focusin', (e) => {
      const a = e.target.closest('.sn-group a');
      if (!a || !isScroller(nav)) return;
      nav.dataset.snScrolled = '1';
      a.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    });
    // Only the reader's own gestures stop the re-centring (late fonts and the theme button also move the strip).
    const mine = () => { nav.dataset.snScrolled = '1'; };
    for (const ev of ['wheel', 'touchstart', 'pointerdown', 'keydown']) nav.addEventListener(ev, mine, { passive: true });
  }

  const navs = [...document.querySelectorAll('nav.site-nav')];
  navs.forEach(render);
  // The theme button is mounted on DOMContentLoaded and fonts change widths, so measure again then.
  const refit = () => navs.forEach(fit);
  refit();
  if (document.readyState !== 'complete') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(refit, 0));
    window.addEventListener('load', refit);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);
  let raf = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(refit); });
})();

// ---------------------------------------------------------------- site search
// A «Пошук» button in every nav.site-nav (and in [data-search-slot], the course map's top bar) opens a modal
// <dialog>: type and the results come instantly, ↑/↓ choose, Enter opens, Esc closes. «/» (outside text fields) or
// Ctrl+K / ⌘K open it from anywhere. On phones it is a full-screen sheet and the button is a pinned icon next to the
// theme switch.
// The index docs/data/search.json is built by tools/site-check/build-search.mjs (rebuild it after editing pages or
// data) and fetched only on the first open (or when the pointer/focus reaches the button). Records: y type, t title,
// a alt names, p where, u URL from docs/, x text, k the other body words (x and k are both searched as body). Matching: lower case, apostrophes dropped, ґ → г
// (the same as the builder), a light Ukrainian stemmer (endings + the і/о alternation: брязкіт ~ брязкоту), prefix
// match for the word being typed; every query word must match (stop words and 1–2-letter words may not). Ranking: page titles > section headings / parts >
// glossary > cards > body text.
(() => {
  'use strict';
  const hosts = [...document.querySelectorAll('nav.site-nav, [data-search-slot]')];
  if (!hosts.length) return;
  const self = document.querySelector('script[src*="assets/site-nav.js"]');
  const base = new URL('../', self ? self.src : location.href);
  const INDEX = new URL('data/search.json', base).href;
  const EXAMPLES = ['резистор', 'підтяжка', 'брязкіт', 'volatile', 'GPIO0', 'закон Ома'];
  const MAX = 40;

  const norm = (s) => String(s).toLowerCase().replace(/[’'ʼ`´]/g, '').replace(/ґ/g, 'г').replace(/ё/g, 'е');
  const words = (s) => norm(s).match(/[\p{L}\p{N}]+/gu) || [];
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Light Ukrainian stemmer: one ending off (the stem keeps ≥ 3 letters), then the last-syllable і → о
  // (кіт/кота, вихід/виходу, брязкіт/брязкоту). Applied the same way to the query and the index.
  const ENDS = ['ування', 'ювання', 'ання', 'яння', 'ення', 'іння', 'ться', 'ують', 'юють', 'ами', 'ями', 'ові', 'еві',
    'єві', 'ого', 'ому', 'ими', 'іми', 'ють', 'ать', 'ять', 'ала', 'али', 'ало', 'ій', 'их', 'ім', 'ою', 'ею', 'єю', 'ів',
    'ах', 'ях', 'ам', 'ям', 'ий', 'ої', 'ей', 'ти', 'ть', 'ує', 'ла', 'ли', 'ло', 'ив', 'а', 'я', 'у', 'ю', 'і', 'и', 'о',
    'е', 'є', 'ь', 'ї', 'й'];
  const CYR = /^[а-щьюяєії]+$/;
  // The builder drops these (and 1–2-letter words) from the body words, so in a query they are optional: they add to
  // the score where they match but never rule a record out (keep in step with STOP in build-search.mjs).
  const STOP = new Set(('але або без був була були було вам вас ваш ваша ваше ваші вже все всі він вона вони воно для його '
    + 'якщо яка який які яке коли тут там так теж тому того той тож цей ця це ці цього цієї щоб що ще як із при про під '
    + 'над між через після перед поки лише тільки також навіть дуже можна треба буде будь має мають немає нема від зі '
    + 'the and for are with that this from you your').split(' '));
  const optional = (q) => STOP.has(q) || (q.length <= 2 && !/\d/.test(q));
  const stems = new Map();
  function stem(w) {
    let s = stems.get(w);
    if (s !== undefined) return s;
    s = w;
    if (w.length >= 4 && CYR.test(w)) {
      for (const e of ENDS) if (s.length - e.length >= 3 && s.endsWith(e)) { s = s.slice(0, -e.length); break; }
      s = s.replace(/і([^аеєиіїоуюяь]+)$/, 'о$1');
    }
    stems.set(w, s);
    return s;
  }
  // How well an index word matches a query word: 1 exact, .9 same stem, .75 prefix (typing), .6 stem prefix.
  function quality(w, q, qs, last) {
    if (w === q) return 1;
    if (qs.length >= 3 && stem(w) === qs) return 0.9;
    if (w.startsWith(q) && (last || q.length >= 3)) return 0.75;
    if (qs.length >= 4 && stem(w).startsWith(qs)) return 0.6;
    return 0;
  }

  // ---- index: postings word → [record*4 + field]; fields 0 title, 1 alt names, 2 where (p), 3 body (x + k)
  let idx = null, loading = null;
  function load() {
    if (!loading) {
      loading = fetch(INDEX).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((d) => {
        const items = d.items || [];
        const post = new Map();
        const add = (w, v) => { let a = post.get(w); if (!a) post.set(w, a = []); if (a[a.length - 1] !== v) a.push(v); };
        items.forEach((r, i) => {
          r.page = !r.u.includes('#') && (r.y === 'урок' || r.y === 'сторінка') && !r.p;
          r.nt = norm(r.t);
          words(r.t).forEach((w) => add(w, i * 4));
          if (r.a) words(r.a).forEach((w) => add(w, i * 4 + 1));
          if (r.p) words(r.p).forEach((w) => add(w, i * 4 + 2));
          if (r.x) words(r.x).forEach((w) => add(w, i * 4 + 3));
          if (r.k) r.k.split(' ').forEach((w) => add(w, i * 4 + 3)); // the body words not already in t / a / x
        });
        idx = { items, post, vocab: [...post.keys()] };
        return idx;
      }).catch((e) => { loading = null; throw e; });
    }
    return loading;
  }

  // field weights by record kind (titles > headings > glossary > cards > body)
  function weight(r, f) {
    if (f === 0) return r.page ? 12 : r.y === 'деталь' ? 9 : r.y === 'глосарій' ? 7 : r.y === 'картка' ? 4 : 8;
    if (f === 1) return r.y === 'глосарій' ? 6.5 : 6;
    if (f === 2) return 1.5;
    return r.y === 'глосарій' ? 2 : 1;
  }

  function search(query) {
    const qw = words(query);
    if (!qw.length || !idx) return { list: [], total: 0, qw };
    const scores = new Map(); // record → [score per query word]
    qw.forEach((q, n) => {
      const qs = stem(q);
      const last = n === qw.length - 1;
      for (const w of idx.vocab) {
        const qa = quality(w, q, qs, last);
        if (!qa) continue;
        for (const v of idx.post.get(w)) {
          const i = v >> 2, f = v & 3;
          const r = idx.items[i];
          const sc = qa * weight(r, f);
          let a = scores.get(i);
          if (!a) scores.set(i, a = new Array(qw.length).fill(0));
          if (sc > a[n]) a[n] = sc;
        }
      }
    });
    const nq = qw.join(' ');
    const must = qw.every(optional) ? qw.map(() => true) : qw.map((q) => !optional(q));
    const out = [];
    for (const [i, a] of scores) {
      if (a.some((x, n) => !x && must[n])) continue;
      const r = idx.items[i];
      let s = a.reduce((x, y, n) => x + (must[n] ? y : y * 0.3), 0); // optional words only nudge the order
      const nt = words(r.t).join(' ');
      if (nt === nq) s += 3;
      else if (nt.startsWith(nq)) s += 1.5;
      out.push([s, i]);
    }
    out.sort((x, y) => y[0] - x[0] || idx.items[x[1]].t.length - idx.items[y[1]].t.length || x[1] - y[1]);
    // one hit per URL + title (an h3 inside a section shares its section's anchor: keep both, they read differently)
    const seen = new Set(), list = [];
    for (const [, i] of out) {
      const r = idx.items[i], key = r.u + '\n' + r.t;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(r);
      if (list.length >= MAX) break;
    }
    return { list, total: out.length, qw };
  }

  // <mark> the words of `text` that match the query
  function mark(text, qw) {
    if (!qw.length) return esc(text);
    const qs = qw.map(stem);
    return String(text).split(/([\p{L}\p{N}’'ʼ]+)/u).map((part, k) => {
      if (k % 2 === 0) return esc(part);
      const w = norm(part).replace(/[^\p{L}\p{N}]/gu, '');
      return qw.some((q, n) => quality(w, q, qs[n], true)) ? `<mark>${esc(part)}</mark>` : esc(part);
    }).join('');
  }

  // ---- UI
  const ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  let dlg = null, input, list, status, opener = null, active = -1, results = [], timer = 0;

  function build() {
    dlg = document.createElement('dialog');
    dlg.className = 'sn-sdlg';
    dlg.setAttribute('aria-labelledby', 'sn-s-h');
    dlg.innerHTML = `
      <div class="sn-s-box">
        <h2 class="sn-s-h" id="sn-s-h">Пошук по сайту</h2>
        <div class="sn-s-head">
          <span class="sn-s-ico">${ICON}</span>
          <input id="sn-s-q" type="search" role="combobox" aria-autocomplete="list" aria-expanded="false"
            aria-controls="sn-s-list" aria-labelledby="sn-s-h" aria-describedby="sn-s-status"
            placeholder="Урок, термін, деталь, пін…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go">
          <button type="button" class="sn-s-close">Закрити<span class="sn-s-esc" aria-hidden="true">Esc</span></button>
        </div>
        <p class="sn-s-status" id="sn-s-status" aria-live="polite"></p>
        <div class="sn-s-list" id="sn-s-list" role="listbox" aria-label="Результати пошуку"></div>
        <p class="sn-s-foot" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> вибрати · <kbd>Enter</kbd> відкрити · <kbd>Esc</kbd> закрити</p>
      </div>`;
    document.body.append(dlg);
    input = dlg.querySelector('input');
    list = dlg.querySelector('.sn-s-list');
    status = dlg.querySelector('.sn-s-status');
    dlg.querySelector('.sn-s-close').addEventListener('click', close);
    // a click on the backdrop (outside the box) closes
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
    dlg.addEventListener('close', () => {
      document.documentElement.classList.remove('sn-s-open');
      if (opener && opener.isConnected) opener.focus();
    });
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 60); });
    input.addEventListener('keydown', onKey);
    list.addEventListener('click', (e) => {
      const b = e.target.closest('.sn-s-ex');
      if (b) { input.value = b.textContent; run(); input.focus(); return; }
      if (e.target.closest('a')) close(); // same-page anchors: the page scrolls, the dialog must go
    });
    list.addEventListener('mousemove', (e) => {
      const a = e.target.closest('a[role="option"]');
      if (a) setActive(+a.dataset.i, false);
    });
  }

  function open(from) {
    if (!dlg) build();
    if (dlg.open) { input.focus(); input.select(); return; }
    opener = from || document.activeElement;
    document.documentElement.classList.add('sn-s-open');
    dlg.showModal();
    input.focus();
    input.select();
    run();
  }
  function close() { if (dlg && dlg.open) dlg.close(); }

  function hints() {
    list.innerHTML = `<div class="sn-s-hint" role="presentation"><p>Шукайте уроки, розділи, терміни глосарія, картки й деталі набору.</p>
      <p class="sn-s-exs">Наприклад: ${EXAMPLES.map((x) => `<button type="button" class="sn-s-ex">${esc(x)}</button>`).join(' ')}</p></div>`;
  }

  function run() {
    const q = input.value.trim();
    active = -1;
    input.removeAttribute('aria-activedescendant');
    if (!q) { results = []; hints(); status.textContent = ''; input.setAttribute('aria-expanded', 'false'); return; }
    if (!idx) {
      status.textContent = 'Завантажую індекс пошуку…';
      load().then(run, () => {
        status.textContent = '';
        list.innerHTML = '<div class="sn-s-hint" role="presentation"><p>Не вдалося завантажити пошук. Перевірте з’єднання і спробуйте ще раз.</p><p><button type="button" class="sn-s-retry">Спробувати ще раз</button></p></div>';
        list.querySelector('.sn-s-retry').addEventListener('click', () => { run(); input.focus(); });
      });
      return;
    }
    const { list: rs, total, qw } = search(q);
    results = rs;
    input.setAttribute('aria-expanded', rs.length ? 'true' : 'false');
    if (!rs.length) {
      list.innerHTML = `<div class="sn-s-hint" role="presentation"><p>Нічого не знайшли за «${esc(q)}». Спробуйте коротше слово або інше написання (наприклад, англійською: pull-up, ISR).</p></div>`;
      status.textContent = 'Нічого не знайдено';
      return;
    }
    list.innerHTML = rs.map((r, i) => {
      const where = r.p ? `<span class="sn-s-where">${esc(r.p)}</span>` : '';
      // the English name / synonyms of a glossary term (pins keep theirs for matching only)
      const alt = r.y === 'глосарій' && r.a && norm(r.a) !== r.nt ? ` <span class="sn-s-alt">· ${mark(r.a, qw)}</span>` : '';
      return `<a role="option" id="sn-s-o${i}" data-i="${i}" tabindex="-1" aria-selected="false" href="${esc(new URL(r.u, base).href)}">
        <span class="sn-s-top"><span class="sn-s-type" data-y="${esc(r.y)}">${esc(r.y)}</span>${where}</span>
        <span class="sn-s-t">${mark(r.t, qw)}${alt}</span>
        ${r.x ? `<span class="sn-s-x">${mark(r.x, qw)}</span>` : ''}</a>`;
    }).join('');
    status.textContent = total > rs.length ? `Знайдено ${total}, показано перші ${rs.length}` : `Знайдено: ${total}`;
    setActive(0, false);
  }

  function setActive(i, scroll = true) {
    const opts = list.querySelectorAll('a[role="option"]');
    if (!opts.length) return;
    i = Math.max(0, Math.min(opts.length - 1, i));
    if (opts[active]) opts[active].setAttribute('aria-selected', 'false');
    active = i;
    opts[i].setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', opts[i].id);
    if (scroll) opts[i].scrollIntoView({ block: 'nearest' });
  }

  function onKey(e) {
    const opts = list.querySelectorAll('a[role="option"]');
    if (e.key === 'ArrowDown' && opts.length) { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp' && opts.length) { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'PageDown' && opts.length) { e.preventDefault(); setActive(active + 5); }
    else if (e.key === 'PageUp' && opts.length) { e.preventDefault(); setActive(active - 5); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (!idx && input.value.trim()) return; // still loading
      const a = opts[active] || opts[0];
      if (!a) return;
      close();
      if (e.ctrlKey || e.metaKey) window.open(a.href, '_blank', 'noopener');
      else location.href = a.href;
    }
  }

  // ---- the button(s)
  hosts.forEach((host) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sn-search-btn';
    b.setAttribute('aria-haspopup', 'dialog');
    b.setAttribute('aria-keyshortcuts', mac ? '/ Meta+K' : '/ Control+K');
    b.setAttribute('aria-label', 'Пошук по сайту');
    b.title = `Пошук по сайту ( / або ${mac ? '⌘K' : 'Ctrl+K'} )`;
    b.innerHTML = `${ICON}<span class="sn-s-lbl">Пошук</span><kbd class="sn-s-kbd" aria-hidden="true">/</kbd>`;
    b.addEventListener('click', () => open(b));
    // warm the index when the reader heads for the button
    const warm = () => { load().catch(() => {}); };
    b.addEventListener('pointerenter', warm, { once: true });
    b.addEventListener('focus', warm, { once: true });
    host.insertBefore(b, host.querySelector(':scope > .theme-btn'));
  });
  // the strip measures its pinned ends again on DOMContentLoaded / load / fonts, after this button is in

  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.isComposing) return;
    const k = e.key;
    // e.code: the same physical keys on the Ukrainian layout (К → «л», / → «.»)
    if ((e.code === 'KeyK' || /^[kKлЛ]$/.test(k)) && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      if (dlg && dlg.open) close(); else open();
      return;
    }
    if (!(k === '/' || (e.code === 'Slash' && !e.shiftKey)) || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (document.querySelector('dialog[open]:not(.sn-sdlg)')) return;
    e.preventDefault();
    open();
  });
})();
