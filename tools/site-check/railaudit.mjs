// Split-rail audit: lists every Kit wire end that lands on a breadboard rail hole, with the rail half it is on.
//
//   node tools/site-check/railaudit.mjs page [page...]
//
// The group's WB-102 has split rails (a break between columns 31 and 33), so every net on a rail must stay on one half
// (L = columns ≤ 31, R = ≥ 33) or be joined by a BRIDGE wire across the gap. The output is for a human to read: look for a
// rail that has ends on both L and R without a BRIDGE line. Headless Chrome only; Chrome is killed on exit.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS = '/home/dromix/projects/platformio/docs';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const args = process.argv.slice(2);
const opt = { width: 1280, js: '', json: false };
const pages = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--width') opt.width = +args[++i];
  else if (args[i] === '--js') opt.js = args[++i];
  else if (args[i] === '--json') opt.json = true;
  else pages.push(args[i]);
}
if (!pages.length) { console.error('usage: wires.mjs [--width N] [--js code] [--json] page...'); process.exit(2); }

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(DOCS, p);
  if (!file.startsWith(DOCS)) { res.writeHead(403).end(); return; }
  try { res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(await readFile(file)); }
  catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}/`;
const profile = await mkdtemp(path.join(tmpdir(), 'wires-'));
const chrome = spawn('google-chrome', ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
process.on('exit', () => chrome.kill());
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => process.exit(130));
const wsUrl = await new Promise((resolve, reject) => {
  let buf = '';
  chrome.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) resolve(m[1]); });
  setTimeout(() => reject(new Error('chrome did not start')), 15000);
});
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let seq = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Runs in the page: geometry in screen pixels, so drawings at any viewBox scale compare alike.
const MEASURE = `(() => {
  const P = 25.4, out = [];
  const shown = (el) => { for (let n = el; n && n.nodeType === 1; n = n.parentNode) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false; } return true; };
  const RY = { 'top+': 1.5, 'top-': 2.5, 'bottom+': 18.5, 'bottom-': 19.5 };
  for (const svg of document.querySelectorAll('svg')) {
    const bb = [...svg.querySelectorAll('[data-kit="breadboard"]')].find((b) => b.closest('svg') === svg);
    if (!bb || svg.closest('.kit-viewer')) continue;
    const inv = bb.getScreenCTM().inverse();
    const loc = (el, x, y) => new DOMPoint(x, y).matrixTransform(el.getScreenCTM()).matrixTransform(inv);
    const railAt = (q) => { const c = q.x / P - 0.5; for (const [k, r] of Object.entries(RY)) if (Math.abs(q.y / P - r) < 0.3 && Math.abs(c - Math.round(c)) < 0.3) return k + Math.round(c); return null; };
    const half = (n) => { const c = +n.replace(/\\D+/, ''); return c <= 31 ? 'L' : 'R'; };
    const rows = [];
    for (const w of svg.querySelectorAll('.kit-wire')) {
      if (!shown(w)) continue;
      const core = w.querySelector('.kit-wire-core') || w.querySelector('path'); const L = core.getTotalLength();
      const a = core.getPointAtLength(0), b = core.getPointAtLength(L);
      const ea = railAt(loc(core, a.x, a.y)), eb = railAt(loc(core, b.x, b.y));
      const name = (w.getAttribute('aria-label') || w.querySelector('title')?.textContent || core.getAttribute('stroke') || '').slice(0, 50);
      if (ea || eb) rows.push((ea && eb ? 'BRIDGE ' : '') + [ea, eb].filter(Boolean).map((e) => e + '(' + half(e) + ')').join(' ~ ') + '  ' + core.getAttribute('stroke') + ' ' + name);
    }
    for (const p of svg.querySelectorAll('.kit-part')) {
      if (p.closest('svg') !== svg || p === bb || !shown(p)) continue;
      const k = p.getAttribute('data-kit');
      const r = p.getBoundingClientRect(), q1 = new DOMPoint(r.left, r.top).matrixTransform(inv), q2 = new DOMPoint(r.right, r.bottom).matrixTransform(inv);
      if (k === 'power-module' || (q1.y < 3 * P && q2.y > 1 * P) || (q2.y > 18 * P && q1.y < 20 * P)) rows.push('PART ' + k + ' cols ' + (q1.x / P - 0.5).toFixed(1) + '..' + (q2.x / P - 0.5).toFixed(1) + ' y ' + (q1.y / P).toFixed(1) + '..' + (q2.y / P).toFixed(1));
    }
    out.push({ svg: (svg.id ? '#' + svg.id : '') + ' «' + (svg.getAttribute('aria-label') || '').slice(0, 40) + '»', rows });
  }
  return out;
})()`;

let bad = 0;
const all = {};
for (const page of pages) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: sid } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sid);
  await send('Runtime.enable', {}, sid);
  await send('Emulation.setDeviceMetricsOverride', { width: opt.width, height: 1000, deviceScaleFactor: 1, mobile: opt.width < 600 }, sid);
  await send('Page.navigate', { url: origin + page }, sid);
  await sleep(2500);
  if (opt.js) { await send('Runtime.evaluate', { expression: `(async () => { ${opt.js} })()`, awaitPromise: true }, sid); await sleep(800); }
  const { result } = await send('Runtime.evaluate', { expression: MEASURE, returnByValue: true }, sid);
  const rows = result.value || [];
  all[page] = rows;
  console.log('== '+page); for (const r of rows) { console.log('  '+r.svg); r.rows.forEach((x)=>console.log('     '+x)); }
  await send('Target.closeTarget', { targetId });
}
if (opt.json) console.log(JSON.stringify(all, null, 1));
ws.close(); chrome.kill(); server.close();
await rm(profile, { recursive: true, force: true }).catch(() => {});
process.exit(bad ? 1 : 0);
