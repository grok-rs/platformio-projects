// Theme switch shared by every study page: Авто (follow the system) → Світла → Темна → Авто.
// Each page already defines light tokens on :root and dark ones under
// `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` and `:root[data-theme="dark"]`,
// so the switch only sets or removes data-theme on <html>.
//
// Loaded synchronously in <head>: the stored choice is applied before the first paint (no flash of
// the wrong theme). The button goes into the page's .site-nav, or into [data-theme-slot] on the index.
// Pages that cache colours for canvas/SVG drawing listen for the `themechange` event on window and
// re-read their tokens, exactly as they do on a system theme change.
(() => {
  const KEY = 'site-theme';
  const MODES = ['auto', 'light', 'dark'];
  const LABEL = { auto: 'Авто', light: 'Світла', dark: 'Темна' };
  const ICON = { auto: '◐', light: '☀', dark: '☾' };
  const root = document.documentElement;

  // Storage can be missing or throw (private mode, blocked site data): then the theme is just per visit.
  const load = () => {
    try { return localStorage.getItem(KEY); } catch { return null; }
  };
  const save = (mode) => {
    try { mode === 'auto' ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, mode); } catch { /* per visit */ }
  };
  const apply = (mode) => {
    if (mode === 'auto') delete root.dataset.theme;
    else root.dataset.theme = mode;
  };

  let mode = MODES.includes(load()) ? load() : 'auto';
  apply(mode);

  const mount = () => {
    const host = document.querySelector('.site-nav, [data-theme-slot]');
    if (!host) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-btn';
    const render = () => {
      const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
      btn.innerHTML = `<span aria-hidden="true">${ICON[mode]}</span> ${LABEL[mode]}`;
      btn.setAttribute('aria-label', `Тема: ${LABEL[mode]}. Натисніть, щоб увімкнути «${LABEL[next]}»`);
      btn.title = mode === 'auto' ? 'Тема як у системі' : `Тема: ${LABEL[mode].toLowerCase()}`;
    };
    btn.addEventListener('click', () => {
      mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
      save(mode);
      apply(mode);
      render();
      window.dispatchEvent(new Event('themechange'));
    });
    render();
    host.appendChild(btn);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  // Another tab changed the theme — follow it.
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    mode = MODES.includes(e.newValue) ? e.newValue : 'auto';
    apply(mode);
    document.querySelectorAll('.theme-btn').forEach((b) => b.remove());
    mount();
    window.dispatchEvent(new Event('themechange'));
  });
})();

// Offline + install (PWA): the browser bar colour follows the theme, and the service worker docs/sw.js is
// registered next to this file (scope = the site root, /platformio-projects/ on GitHub Pages). When a new worker
// is installed and waiting, a small toast offers «Оновити»: the page tells the worker to take over and reloads.
(() => {
  const root = document.documentElement;
  const dark = matchMedia('(prefers-color-scheme: dark)');
  const syncBar = () => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const t = root.dataset.theme;
    meta.content = (t === 'dark' || (t !== 'light' && dark.matches)) ? '#14110e' : '#f4f0e8';
  };
  const watchBar = () => {
    syncBar();
    window.addEventListener('themechange', syncBar);
    try { dark.addEventListener('change', syncBar); } catch { /* old Safari: bar keeps the first colour */ }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchBar);
  else watchBar();

  const script = document.currentScript;
  if (!('serviceWorker' in navigator) || !script || !script.src) return;
  // Live site (https) only. On a local preview or the headless checks the worker would cache work in progress,
  // so it registers there only on request: open any page with ?sw once.
  if (location.protocol !== 'https:' && !(['localhost', '127.0.0.1'].includes(location.hostname) && /[?&]sw\b/.test(location.search))) return;
  const base = new URL('./', script.src);
  const sw = navigator.serviceWorker;

  const showUpdate = (worker) => {
    if (!worker || document.querySelector('.sw-update')) return;
    if (!document.getElementById('sw-update-css')) {
      const css = document.createElement('style');
      css.id = 'sw-update-css';
      css.textContent = `
.sw-update { position: fixed; left: 50%; transform: translateX(-50%); bottom: max(16px, env(safe-area-inset-bottom)); z-index: 110;
  display: flex; align-items: center; gap: 4px 10px; flex-wrap: wrap; width: max-content; max-width: calc(100vw - 32px);
  box-sizing: border-box; padding: 8px 8px 8px 16px; border-radius: 12px; background: var(--ink, #2a241d); color: var(--paper, #f4f0e8);
  font: 600 15px/1.4 var(--f-body, system-ui, sans-serif); box-shadow: 0 14px 34px -12px rgba(0, 0, 0, .55); }
.sw-update span { flex: 1 1 auto; }
.sw-update button { min-height: 44px; min-width: 44px; padding: 0 14px; border-radius: 8px; cursor: pointer; font: inherit;
  border: 1px solid currentColor; background: transparent; color: inherit; }
.sw-update button.go { background: var(--paper, #f4f0e8); color: var(--ink, #2a241d); border-color: var(--paper, #f4f0e8); }
.sw-update button:focus-visible { outline: 3px solid var(--focus, #2f7ad8); outline-offset: 2px; }
@media (max-width: 899px) { .sw-update { bottom: calc(72px + env(safe-area-inset-bottom)); } }
@media print { .sw-update { display: none; } }`;
      document.head.appendChild(css);
    }
    const box = document.createElement('div');
    box.className = 'sw-update';
    box.setAttribute('role', 'status');
    box.innerHTML = '<span>Доступна нова версія</span>'
      + '<button type="button" class="go">Оновити</button>'
      + '<button type="button" class="later" aria-label="Пізніше">✕</button>';
    box.querySelector('.go').addEventListener('click', () => {
      sw.addEventListener('controllerchange', () => location.reload(), { once: true });
      worker.postMessage({ type: 'SKIP_WAITING' });
    });
    box.querySelector('.later').addEventListener('click', () => box.remove());
    document.body.appendChild(box);
  };

  window.addEventListener('load', () => {
    sw.register(new URL('sw.js', base).href, { scope: base.href }).then((reg) => {
      // An update is waiting only if a worker already controls this page (the very first install takes over silently).
      if (reg.waiting && sw.controller) showUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && sw.controller) showUpdate(nw);
        });
      });
    }).catch(() => { /* no offline mode on this visit; the site works as before */ });
  });
})();
