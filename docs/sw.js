// sw.js: offline support for the study site (registered by site-theme.js; scope = the docs/ root, which is
// /platformio-projects/ on GitHub Pages, so every URL here is relative to this file).
//
//   Pages (navigations, *.html)  network-first (4 s timeout) → cached copy → built-in «Ви офлайн» page.
//   Same-origin assets & data    cache first while fresh (< 10 min), otherwise network with a 4 s timeout and the
//                                cached copy as fallback; every hit also refreshes the cache in the background
//                                (stale-while-revalidate that never serves a days-old study.js to fresh HTML).
//   Google Fonts (CSS + woff2)   stale-while-revalidate.
//   Any other cross-origin URL   not touched (YouTube, LMS, datasheets go straight to the network).
//
// SHELL is pre-cached on install (~4 MB). Missing entries (a page not published yet) are skipped, not fatal.
// Bump VERSION whenever this file or SHELL changes: the new worker installs, waits, and site-theme.js shows the
// «Доступна нова версія — оновити» toast; «Оновити» sends SKIP_WAITING, the page reloads, old caches are deleted.
const VERSION = 'v1-2026-10-25';
const SHELL_CACHE = `esp-shell-${VERSION}`;
const RUNTIME_CACHE = `esp-runtime-${VERSION}`;
const FRESH_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 4000;
const STAMP = 'x-sw-fetched';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

const LESSONS = ['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', 'mp1', 'mp1-review', '2-1', '2-2', '2-3', '2-4'];
const GLOBALS = ['start', 'cards', 'warmup', 'team', 'review', 'cases', 'live', 'datasheets', 'kit', 'atlas',
  'schematics', 'bugs', 'glossary', 'teacher'];
const DEEP = ['pull-resistors', 'lab', 'scope-signals', 'bounce-lab', 'bounce-bench', 'adc-light', 'ldr-lab',
  'twilight-relay', 'power-loads'];
const DECKS = ['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', 'mp1', '2-1', '2-2', '2-3', '2-4', 'atlas', 'notation', 'symbols'];
const QUIZZES = ['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', 'mp1', '2-1', '2-2', '2-3', '2-4'];

const SHELL = [
  './', 'manifest.webmanifest', 'site-theme.js', 'site-nav.css', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png',
  'assets/theme.css', 'assets/study.css', 'assets/study.js', 'assets/course.js', 'assets/site-nav.js',
  'assets/quiz.js', 'assets/flashcards.js', 'assets/kit.js', 'assets/schem.js', 'assets/symbols.svg',
  'assets/hero-circuit-light.svg', 'assets/hero-circuit-dark.svg',
  ...LESSONS.map((id) => `lessons/${id}/`),
  ...GLOBALS.map((key) => `${key}/`),
  ...DEEP.map((key) => `${key}/`),
  'data/search.json', 'assets/serial.js',
  // Page-local scripts and styles (a page without them is broken offline).
  'lessons/1-1/bench.js', 'lessons/1-2/bench.js', 'lessons/mp1/twilight-kit.css', 'lessons/mp1/twilight-kit.js',
  'review/review.css', 'review/review.js', 'cases/cases.css', 'cases/scenes.js', 'cases/cases.js',
  'datasheets/datasheets.css', 'datasheets/datasheets.js', 'teacher/live-tools.css', 'teacher/live-tools.js',
  'data/challenges.json', 'data/facts.json', 'data/glossary.json', 'data/pins-s3.json', 'data/scoreboard.json',
  ...DECKS.map((id) => `data/cards/${id}.json`),
  ...QUIZZES.map((id) => `data/quiz/${id}.json`),
];

const scopeUrl = new URL('./', self.location).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // One by one so a single 404 (a page not published yet) never fails the whole install.
    await Promise.allSettled(SHELL.map(async (path) => {
      const url = new URL(path, scopeUrl).href;
      const res = await fetch(url, { cache: 'reload' });
      if (res.ok) await cache.put(url, await stamp(res));
    }));
    // First install: take over at once. An update waits for the user's «Оновити» (SKIP_WAITING below).
    if (!self.registration.active) await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, RUNTIME_CACHE]);
    for (const key of await caches.keys()) if (key.startsWith('esp-') && !keep.has(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (!url.href.startsWith(scopeUrl)) return;
    if (url.pathname.endsWith('/sw.js')) return;
    if (req.mode === 'navigate' || req.destination === 'document' || url.pathname.endsWith('.html')) {
      event.respondWith(page(req, event));
    } else {
      event.respondWith(asset(req, event));
    }
  } else if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(swr(req, event));
  }
  // Everything else cross-origin: not intercepted.
});

/* ---------------------------------------------------------------- strategies */

async function page(req, event) {
  const key = pageKey(req.url);
  try {
    const res = await withTimeout(fetch(req), TIMEOUT_MS);
    if (res.ok) event.waitUntil(put(key, res.clone()));
    return res;
  } catch {
    const cached = await match(key) || await match(req.url);
    if (cached) return cached;
    const home = await match(scopeUrl);
    return offlinePage(!!home);
  }
}

async function asset(req, event) {
  const cached = await match(req.url);
  const refresh = fetch(req).then(async (res) => {
    if (res.ok && res.type === 'basic') await put(req.url, res.clone());
    return res;
  });
  if (cached) {
    event.waitUntil(refresh.catch(() => {}));
    const at = +cached.headers.get(STAMP) || 0;
    if (Date.now() - at < FRESH_MS) return cached;
    try {
      const res = await withTimeout(refresh, TIMEOUT_MS);
      return res.ok ? res : cached;
    } catch { return cached; }
  }
  return refresh; // not cached yet: the network answer (or its error) as is
}

async function swr(req, event) {
  const cached = await match(req.url);
  const refresh = fetch(req).then(async (res) => {
    if (res.ok || res.type === 'opaque') await put(req.url, res.clone());
    return res;
  });
  if (cached) {
    event.waitUntil(refresh.catch(() => {}));
    return cached;
  }
  return refresh;
}

/* ---------------------------------------------------------------- helpers */

// «lessons/1-1/index.html», «lessons/1-1/?x» and «lessons/1-1/» are one page.
function pageKey(href) {
  const u = new URL(href);
  u.hash = '';
  u.search = '';
  if (u.pathname.endsWith('/index.html')) u.pathname = u.pathname.slice(0, -'index.html'.length);
  return u.href;
}

async function match(url) {
  return (await caches.match(url, { cacheName: SHELL_CACHE })) || (await caches.match(url, { cacheName: RUNTIME_CACHE }))
    || undefined;
}

// Shell entries are refreshed in place; everything else goes to the runtime cache.
async function put(url, res) {
  try {
    const name = (await caches.match(url, { cacheName: SHELL_CACHE })) ? SHELL_CACHE : RUNTIME_CACHE;
    await (await caches.open(name)).put(url, await stamp(res));
  } catch { /* quota or a body already used: skip caching this one */ }
}

// Copy a same-origin response with the time it was fetched (used for the 10-minute freshness window).
async function stamp(res) {
  if (res.type === 'opaque') return res;
  const headers = new Headers(res.headers);
  headers.set(STAMP, String(Date.now()));
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers });
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

function offlinePage(hasHome) {
  const html = `<!doctype html><html lang="uk"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Немає з’єднання</title>
<style>
:root { color-scheme: light dark; --paper: #f4f0e8; --ink: #2a241d; --muted: #6a5f52; --accent: #8a5a00; }
@media (prefers-color-scheme: dark) { :root { --paper: #14110e; --ink: #ece4d8; --muted: #b3a796; --accent: #e0b25a; } }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; box-sizing: border-box;
  background: var(--paper); color: var(--ink); font: 17px/1.5 system-ui, sans-serif; }
main { max-width: 34rem; }
h1 { font-size: 24px; margin: 0 0 8px; }
p { margin: 0 0 12px; color: var(--muted); }
a, button { display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; margin: 4px 8px 0 0;
  border: 1px solid var(--accent); border-radius: 8px; color: var(--accent); background: none; font: inherit;
  font-weight: 600; text-decoration: none; cursor: pointer; }
</style></head><body><main>
<h1>Немає з’єднання з інтернетом</h1>
<p>Цю сторінку ви ще не відкривали з інтернетом, тому її немає в пам’яті пристрою. Уроки, картки й довідка, які ви вже
відвідували, працюють і без мережі.</p>
<button type="button" onclick="location.reload()">Спробувати ще раз</button>
${hasHome ? `<a href="${scopeUrl}">До карти курсу</a>` : ''}
</main></body></html>`;
  return new Response(html, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
