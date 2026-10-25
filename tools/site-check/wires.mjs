// Breadboard tidiness check: measures every <svg> that holds Kit wires (docs/assets/kit.js) in headless Chrome.
//
//   node tools/site-check/wires.mjs [--width 1280] [--js "code after load"] [--json] page [page...]
//
// Per drawing it reports (all must be 0 for a «perfectionist» drawing):
//   crossings  pairs of different wires whose lines cross (touching at a shared hole does not count),
//   overParts  wires running over the body of a part (not the breadboard; the few mm next to a wire's own ends are free),
//   diagonal   wires with a segment that is neither horizontal nor vertical (Kit.route keeps everything on the grid),
//   labels     annotation texts outside parts that overlap another label, a wire or a part body.
// Exit code 1 if any drawing has a non-zero count. Chrome is killed on exit.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs');
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
  try { const body = await readFile(file); res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(body); } // read first: a 404 must not follow a 200 header
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
  const out = [];
  const segsOf = (p) => {
    const L = p.getTotalLength(), n = Math.max(8, Math.ceil(L / 4)), m = p.getScreenCTM(), pts = [];
    for (let i = 0; i <= n; i++) { const q = p.getPointAtLength(L * i / n); const s = new DOMPoint(q.x, q.y).matrixTransform(m); pts.push({ x: s.x, y: s.y }); }
    return pts;
  };
  const inter = (a, b, c, d) => {
    const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x); if (Math.abs(den) < 1e-9) return false;
    const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den, u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / den;
    return t > 0 && t < 1 && u > 0 && u < 1;
  };
  const inBox = (p, r, pad = 0) => p.x > r.left - pad && p.x < r.right + pad && p.y > r.top - pad && p.y < r.bottom + pad;
  const boxHit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  // hidden by the page (an animation frame, a closed tab): opacity 0 somewhere up the tree or not rendered
  const shown = (el) => { for (let n = el; n && n.nodeType === 1; n = n.parentNode) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false; } return true; };
  const name = (el) => el.getAttribute('data-kit') || el.getAttribute('class') || el.tagName;
  for (const svg of document.querySelectorAll('svg')) {
    const wires = [...svg.querySelectorAll('.kit-wire')].filter((w) => { const r = w.getBoundingClientRect(); return w.closest('svg') === svg && (r.width > 0 || r.height > 0) && shown(w); });
    if (!wires.length || svg.closest('.kit-viewer')) continue;
    const label = (svg.id ? '#' + svg.id : '') + (svg.getAttribute('aria-label') ? ' «' + svg.getAttribute('aria-label').slice(0, 50) + '»' : '');
    const W = wires.map((w) => {
      const core = w.querySelector('.kit-wire-core') || w.querySelector('path');
      const pts = segsOf(core), sw = parseFloat(getComputedStyle(core).strokeWidth) || 2;
      const sc = core.getScreenCTM().a; // user → px
      return { w, pts, a: pts[0], b: pts[pts.length - 1], px: Math.max(1, sw * Math.abs(sc)), d: core.getAttribute('d') || '' };
    });
    const near = (p, q, r) => Math.hypot(p.x - q.x, p.y - q.y) < r;
    let crossings = [], overParts = [], diagonal = [], labels = [];
    for (let i = 0; i < W.length; i++) for (let j = i + 1; j < W.length; j++) {
      const A = W[i], B = W[j], r = (A.px + B.px) * 1.5;
      let hit = false;
      for (let k = 1; k < A.pts.length && !hit; k++) for (let l = 1; l < B.pts.length && !hit; l++) {
        const a = A.pts[k - 1], b = A.pts[k], c = B.pts[l - 1], d = B.pts[l];
        if (!inter(a, b, c, d)) continue;
        const ends = [A.a, A.b, B.a, B.b];
        if (ends.some((e) => near(a, e, r) || near(c, e, r))) continue;
        hit = true;
      }
      if (hit) crossings.push(i + '×' + j);
    }
    const parts = [...svg.querySelectorAll('.kit-part')].filter((p) => p.getAttribute('data-kit') !== 'breadboard' && p.closest('svg') === svg);
    W.forEach((A, i) => {
      if (A.w.classList.contains('kit-lead')) return;
      const free = Math.max(18, A.px * 4);
      for (const p of parts) {
        if (p.contains(A.w)) continue;
        // the part's drawn body only: glow halos (an LED's light) are not the part
        const r = (p.querySelector(':scope > .kit-sh') || p).getBoundingClientRect(); if (!r.width) continue;
        const inside = A.pts.filter((q) => inBox(q, r, -2) && !near(q, A.a, free) && !near(q, A.b, free)).length;
        if (inside > 2) { overParts.push(i + '→' + name(p)); break; }
      }
      if (A.w.classList.contains('kit-lead')) return; // meter test leads hang freely, as in real life
      if (A.w.classList.contains('kit-route')) {
        const segs = A.d.match(/L[^LQ]+/g) || [];
        let prev = A.d.match(/^M\\s*([\\d.\\-]+)[ ,]([\\d.\\-]+)/);
        let px = prev ? +prev[1] : 0, py = prev ? +prev[2] : 0, diag = false;
        for (const t of A.d.match(/[MLQ][^MLQ]+/g) || []) {
          const nums = t.slice(1).trim().split(/[\\s,]+/).map(Number);
          const x = nums[nums.length - 2], y = nums[nums.length - 1];
          if (t[0] === 'L' && Math.abs(x - px) > 0.5 && Math.abs(y - py) > 0.5) diag = true;
          px = x; py = y;
        }
        if (diag) diagonal.push(i);
      } else diagonal.push(i + '(arc)');
    });
    const texts = [...svg.querySelectorAll('text')].filter((t) => !t.closest('.kit-part, .kit-wire') && t.getBoundingClientRect().width > 0 && t.textContent.trim() && shown(t));
    const tb = texts.map((t) => ({ t, r: t.getBoundingClientRect() }));
    for (let i = 0; i < tb.length; i++) {
      const A = tb[i];
      for (let j = i + 1; j < tb.length; j++) if (boxHit(A.r, tb[j].r)) labels.push('«' + A.t.textContent.trim().slice(0, 14) + '»×«' + tb[j].t.textContent.trim().slice(0, 14) + '»');
      if (W.some((w) => w.pts.some((q) => inBox(q, A.r, -1)))) labels.push('«' + A.t.textContent.trim().slice(0, 14) + '» on a wire');
      for (const p of parts) { const r = (p.querySelector(':scope > .kit-sh') || p).getBoundingClientRect(); const ov = Math.max(0, Math.min(A.r.right, r.right) - Math.max(A.r.left, r.left)) * Math.max(0, Math.min(A.r.bottom, r.bottom) - Math.max(A.r.top, r.top)); if (ov > A.r.width * A.r.height * 0.3) { labels.push('«' + A.t.textContent.trim().slice(0, 14) + '» on ' + name(p)); break; } }
    }
    out.push({ svg: label || '(svg)', wires: W.length, crossings, overParts, diagonal, labels });
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
  if (!opt.json) {
    console.log(`== ${page}`);
    if (!rows.length) console.log('   (no drawings with Kit wires)');
    for (const r of rows) {
      const n = r.crossings.length + r.overParts.length + r.diagonal.length + r.labels.length;
      if (n) bad++;
      console.log(`${n ? 'FAIL' : 'ok  '} ${r.svg}: ${r.wires} wires · crossings ${r.crossings.length} · over parts ${r.overParts.length} · diagonal ${r.diagonal.length} · labels ${r.labels.length}`);
      if (r.crossings.length) console.log('     crossings: ' + r.crossings.join(', '));
      if (r.overParts.length) console.log('     over parts: ' + r.overParts.join(', '));
      if (r.diagonal.length) console.log('     diagonal/arc wires: ' + r.diagonal.join(', '));
      if (r.labels.length) console.log('     labels: ' + r.labels.slice(0, 8).join('; ') + (r.labels.length > 8 ? ' …' : ''));
    }
  } else rows.forEach((r) => { if (r.crossings.length + r.overParts.length + r.diagonal.length + r.labels.length) bad++; });
  await send('Target.closeTarget', { targetId });
}
if (opt.json) console.log(JSON.stringify(all, null, 1));
ws.close(); chrome.kill(); server.close();
await rm(profile, { recursive: true, force: true }).catch(() => {});
process.exit(bad ? 1 : 0);
