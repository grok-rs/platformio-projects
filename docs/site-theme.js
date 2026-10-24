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
