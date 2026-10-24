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

  function fit(nav) {
    // .sn-scroll: the strip overflows, so site-nav.css fades the links next to the pinned ends
    nav.classList.toggle('sn-scroll', isScroller(nav));
    if (!isScroller(nav)) return;
    const home = nav.querySelector('.sn-home');
    const theme = nav.querySelector(':scope > .theme-btn');
    const hw = home ? home.offsetWidth : 0;
    const tw = theme ? theme.offsetWidth : 0;
    nav.style.setProperty('--sn-home-w', hw + 8 + 'px');
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
