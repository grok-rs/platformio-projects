// Screenshot one element of a study page after optional actions, in headless Chrome.
//
//   node tools/site-check/elshot.mjs <page> <selector> <out.png> [--width 1280] [--theme light|dark]
//        [--js "code run in the page after load"] [--wait 1500] [--reduce]
//
// `page` is a path under docs/ ("lessons/2-2/"). --js runs after study:ready (e.g. click a switch), then the
// script waits --wait ms (let an animation run) and captures the element's box. Console errors and exceptions
// are printed and make the exit code 1. --reduce emulates prefers-reduced-motion. Chrome is killed on exit.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };

const args = process.argv.slice(2);
const opt = { width: 1280, theme: 'light', js: '', wait: 1500, reduce: false };
const pos = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--width') opt.width = +args[++i];
  else if (a === '--theme') opt.theme = args[++i];
  else if (a === '--js') opt.js = args[++i];
  else if (a === '--wait') opt.wait = +args[++i];
  else if (a === '--reduce') opt.reduce = true;
  else pos.push(a);
}
const [page, selector, out] = pos;
if (!out) { console.error('usage: elshot.mjs <page> <selector> <out.png> [--width N] [--theme light|dark] [--js code] [--wait ms] [--reduce]'); process.exit(2); }

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(DOCS, p);
  if (!file.startsWith(DOCS)) { res.writeHead(403).end(); return; }
  try { const body = await readFile(file); res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(body); } // read first: a 404 must not follow a 200 header
  catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}/`;
const profile = await mkdtemp(path.join(tmpdir(), 'elshot-'));
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
const pending = new Map(), problems = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); return; }
  if (m.method === 'Runtime.exceptionThrown') problems.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split('\n')[0]);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') problems.push('console.error: ' + m.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 200));
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId: sid } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Runtime.enable', {}, sid);
await send('Page.enable', {}, sid);
await send('Emulation.setDeviceMetricsOverride', { width: opt.width, height: 1000, deviceScaleFactor: 1, mobile: opt.width < 600 }, sid);
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: opt.theme },
  { name: 'prefers-reduced-motion', value: opt.reduce ? 'reduce' : 'no-preference' }] }, sid);
await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.clear();localStorage.setItem('site-theme', ${JSON.stringify(opt.theme)})}catch{}` }, sid);
await send('Page.navigate', { url: origin + page }, sid);
await sleep(1800);
const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sid)).result.value;
await ev(`(async () => { const el = document.querySelector(${JSON.stringify(selector)}); if (el) el.scrollIntoView({ block: 'center' }); })()`);
await sleep(300);
if (opt.js) await ev(`(async () => { ${opt.js} })()`);
await sleep(opt.wait);
const box = await ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null;
  const r = el.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; })()`);
if (!box) { console.error(`no element matches ${selector}`); process.exit(1); }
const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
  clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(box.w + 16, opt.width), height: Math.min(box.h + 16, 6000), scale: 1 } }, sid);
await mkdir(path.dirname(path.resolve(out)), { recursive: true });
await writeFile(out, Buffer.from(data, 'base64'));
console.log(`saved ${out} (${Math.round(box.w)}×${Math.round(box.h)})`);
problems.forEach((p) => console.log('  - ' + p));
ws.close(); chrome.kill(); server.close();
await rm(profile, { recursive: true, force: true }).catch(() => {});
process.exit(problems.length ? 1 : 0);
