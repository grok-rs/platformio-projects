// Headless-Chrome smoke test for the study site (docs/).
//
//   node tools/site-check/check.mjs [--shots DIR] [--width 375,1280] [--theme light,dark] [--scrollbars] page [page...]
//
// `page` is a path under docs/ ("lessons/1-1/", "index.html"). The script serves docs/ itself on a free
// port, opens every page at every width × theme, and reports per run:
//   - console errors and uncaught exceptions,
//   - failed requests (404 etc.),
//   - horizontal overflow (document wider than the viewport) and the widest offending elements.
// --scrollbars keeps classic (space-taking) scrollbars, as on desktop Windows/Linux, so 100vw-style overflow shows.
// With --shots it saves a full-page PNG per run (pages taller than 16000 px: scrolled views X-c1…X-cN, see below). Exit code 1 if any run has a problem. WARN (exit 0): overflow on a
// page without a viewport meta (a fixed-width document) and the browser's own /favicon.ico 404. Before the browser
// runs, docs/data/**/*.json is linted for HTML entities (FAIL).
// Needs only Node ≥ 22 (built-in WebSocket) and google-chrome on PATH.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, readdir, mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon' };

const args = process.argv.slice(2);
let shots = null, widths = [375, 1280], themes = ['light', 'dark'], scrollbars = false;
const pages = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--shots') shots = path.resolve(args[++i]);
  else if (args[i] === '--width') widths = args[++i].split(',').map(Number);
  else if (args[i] === '--theme') themes = args[++i].split(',');
  else if (args[i] === '--scrollbars') scrollbars = true;
  else pages.push(args[i]);
}
if (!pages.length) { console.error('usage: check.mjs [--shots DIR] [--width 375,1280] [--theme light,dark] [--scrollbars] page...'); process.exit(2); }

// Static server for docs/ (directories serve index.html).
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(DOCS, p);
  if (!file.startsWith(DOCS)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}/`;

const profile = await mkdtemp(path.join(tmpdir(), 'site-check-'));
const chrome = spawn('google-chrome', ['--headless=new', '--disable-gpu', ...(scrollbars ? [] : ['--hide-scrollbars']), '--no-first-run',
  '--no-default-browser-check', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'] });
// Data lint: quiz.js / flashcards.js escape data text themselves (safe()), so an HTML entity in data/**/*.json
// would show to students as literal "&gt;". Write the plain character (> < &) instead.
let failed = 0;
for (const rel of (await readdir(path.join(DOCS, 'data'), { recursive: true })).filter((f) => f.endsWith('.json'))) {
  const lines = (await readFile(path.join(DOCS, 'data', rel), 'utf8')).split('\n');
  lines.forEach((l, i) => { const m = l.match(/&(?:gt|lt|amp|quot|nbsp|#\d+);/); if (m) { failed++; console.log(`FAIL data/${rel}:${i + 1} HTML entity ${m[0]} in data text (write the plain character)`); } });
}

// Never leave a headless Chrome behind, even when the run is killed by a timeout.
process.on('exit', () => chrome.kill());
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => process.exit(130));
const wsUrl = await new Promise((resolve, reject) => {
  let buf = '';
  chrome.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) resolve(m[1]); });
  chrome.on('exit', () => reject(new Error('chrome exited:\n' + buf)));
  setTimeout(() => reject(new Error('chrome did not start')), 15000);
});

const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let seq = 0;
const pending = new Map(), listeners = new Set();
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id); msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result); }
  else listeners.forEach((fn) => fn(msg));
});
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++seq; pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params, sessionId }));
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TALL = 16000; // above this, --shots captures scrolled views instead of one full-page PNG
if (shots) await mkdir(shots, { recursive: true });

for (const page of pages) {
  for (const width of widths) {
    for (const theme of themes) {
      const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
      const problems = [], warnings = [];
      const onMsg = (m) => {
        if (m.sessionId !== sessionId) return;
        if (m.method === 'Runtime.exceptionThrown') problems.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split('\n')[0]);
        if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') problems.push('console.error: ' + m.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 200));
        if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
          // The browser's own /favicon.ico probe (pages without <link rel="icon">) is not a broken page reference.
          const url = m.params.entry.url || '';
          (/\/favicon\.ico$/.test(url) ? warnings : problems).push('log: ' + m.params.entry.text.slice(0, 200) + (url ? ' ' + url : ''));
        }
      };
      listeners.add(onMsg);
      await send('Runtime.enable', {}, sessionId);
      await send('Log.enable', {}, sessionId);
      await send('Page.enable', {}, sessionId);
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 }, sessionId);
      // Theme: site-theme.js reads localStorage 'site-theme'; also emulate the media feature.
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] }, sessionId);
      await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('site-theme', ${JSON.stringify(theme)})}catch{}` }, sessionId);
      await send('Page.navigate', { url: origin + page }, sessionId);
      await sleep(2500);
      const { result } = await send('Runtime.evaluate', { returnByValue: true, expression: `(() => {
        const vw = document.documentElement.clientWidth, sw = document.documentElement.scrollWidth;
        const wide = sw > vw + 1 ? [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.right > vw + 1 && r.width > 0 && getComputedStyle(e).position !== 'fixed'; })
          .filter(e => !e.closest('.tbl, pre, .scroll-x, [data-scroll-x]'))
          // Children of a sideways-scrolling box (e.g. the phone nav strip) don't widen the page.
          .filter(e => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { if (/auto|scroll|hidden|clip/.test(getComputedStyle(a).overflowX)) return false; } return true; })
          .slice(0, 5).map(e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/).join('.') : '') + ' right=' + Math.round(e.getBoundingClientRect().right)) : [];
        return { vw, sw, wide, title: document.title, h: document.documentElement.scrollHeight,
          viewport: !!document.querySelector('meta[name="viewport"]') };
      })()` }, sessionId);
      const v = result.value || {};
      // A page without <meta name="viewport"> is a fixed-width document (e.g. the source of a rendered PNG):
      // phone browsers zoom it out to fit, so its overflow is only a warning.
      if (v.sw > v.vw + 1) (v.viewport ? problems : warnings).push(`overflow: scrollWidth ${v.sw} > ${v.vw}: ${v.wide.join(', ')}` + (v.viewport ? '' : ' (no viewport meta: fixed-width page)'));
      if (shots) {
        const name = page.replace(/\/$/, '/index').replace(/[\/]/g, '_').replace(/\.html$/, '') + `-${width}-${theme}`;
        const h = v.h || 900;
        if (h <= TALL) {
          // One full-page PNG (crop.py splits it into -c1…-cN views).
          await send('Emulation.setDeviceMetricsOverride', { width, height: h, deviceScaleFactor: 1, mobile: width < 600 }, sessionId);
          await sleep(300);
          const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, sessionId);
          await writeFile(path.join(shots, name + '.png'), Buffer.from(data, 'base64'));
        } else {
          // Tall page: one giant capture comes out blank where widgets draw only when visible, and Chrome cuts it at
          // 16384 px. Scroll a viewport-sized window instead and save each view directly as -c1…-cN (the crop.py
          // naming; crop.py leaves these alone). The last view is aligned to the page bottom, so it may overlap.
          const step = width > 600 ? 1500 : 1300;
          await send('Emulation.setDeviceMetricsOverride', { width, height: step, deviceScaleFactor: 1, mobile: width < 600 }, sessionId);
          await send('Runtime.evaluate', { expression: `document.documentElement.style.scrollBehavior = 'auto'` }, sessionId);
          let i = 0;
          for (let y = 0; y < h; y += step) {
            await send('Runtime.evaluate', { expression: `scrollTo(0, ${y})` }, sessionId);
            await sleep(350);
            const { data } = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
            await writeFile(path.join(shots, `${name}-c${++i}.png`), Buffer.from(data, 'base64'));
          }
          warnings.push(`tall page (${h}px): saved ${i} scrolled views ${name}-c1…c${i} instead of one full-page PNG`);
        }
      }
      listeners.delete(onMsg);
      await send('Target.closeTarget', { targetId });
      const tag = `${page} @${width} ${theme}`;
      if (problems.length) { failed++; console.log(`FAIL ${tag} (${v.title})`); [...new Set(problems)].forEach((p) => console.log('  - ' + p)); }
      else if (warnings.length) { console.log(`WARN ${tag} (${v.title})`); [...new Set(warnings)].forEach((p) => console.log('  - ' + p)); }
      else console.log(`ok   ${tag} (${v.title}, ${v.h}px tall)`);
    }
  }
}

ws.close(); chrome.kill(); server.close();
await rm(profile, { recursive: true, force: true }).catch(() => {});
process.exit(failed ? 1 : 0);
