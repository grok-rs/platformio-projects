// Label-fit check: finds SVG text that sticks out of the shape drawn around it (a pill, box or circle behind a label).
//
//   node tools/site-check/labels.mjs [--width 1280] [--json] page [page...]
//
// For every <text> in every <svg>, the shapes (rect, ellipse, circle, path, polygon) in the same <g> or right before it
// that contain the text's centre count as its frame; the text must fit inside the frame with a small margin. Every
// Study.anim figure is stepped through all its steps (start, middle and end of each), because labels change per step.
// Hardware drawings (Kit parts) are skipped: their silkscreen is drawn to size. Exit code 1 if anything overflows.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const args = process.argv.slice(2);
const opt = { width: 1280, json: false };
const pages = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--width') opt.width = +args[++i];
  else if (args[i] === '--json') opt.json = true;
  else pages.push(args[i]);
}
if (!pages.length) { console.error('usage: labels.mjs [--width N] [--json] page...'); process.exit(2); }

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(DOCS, p);
  if (!file.startsWith(DOCS)) { res.writeHead(403).end(); return; }
  try { const body = await readFile(file); res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(body); }
  catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}/`;
const profile = await mkdtemp(path.join(tmpdir(), 'labels-'));
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

// Runs in the page. Returns overflow records for the current state of the document.
const MEASURE = `(() => {
  const out = [];
  const shown = (el) => { for (let n = el; n && n.nodeType === 1; n = n.parentNode) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false; } return true; };
  const SHAPES = 'rect, ellipse, circle, path, polygon';
  for (const t of document.querySelectorAll('svg text')) {
    if (t.closest('.kit-part, .kit-wire, defs, symbol, .kit-viewer') || !t.textContent.trim() || !shown(t)) continue;
    const tr = t.getBoundingClientRect(); if (!tr.width || !tr.height) continue;
    const cx = tr.left + tr.width / 2, cy = tr.top + tr.height / 2;
    // candidate frames: shapes among the text's siblings, its parent's siblings, drawn before the text
    const cands = [];
    for (let g = t.parentElement, depth = 0; g && depth < 2 && g.tagName !== 'svg'; g = g.parentElement, depth++)
      for (const s of g.querySelectorAll(':scope > ' + SHAPES.split(', ').join(', :scope > '))) cands.push(s);
    let prev = t.previousElementSibling; for (let k = 0; prev && k < 3; prev = prev.previousElementSibling, k++) if (prev.matches(SHAPES)) cands.push(prev);
    let best = null;
    for (const s of new Set(cands)) {
      if (s.closest('.kit-part, .kit-wire') || !shown(s)) continue;
      const cs = getComputedStyle(s);
      const transparent = /^(transparent|rgba\(\s*0,\s*0,\s*0,\s*0\s*\))$/.test(cs.fill);
      const filled = cs.fill && cs.fill !== 'none' && !transparent && +cs.fillOpacity > 0.05, stroked = cs.stroke && cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0;
      if (!filled && !stroked) continue;
      // a frame is a closed outline: an unfilled open path is a wire or a plotted line, not something the label sits in
      if (s.tagName === 'path' && !filled && !/z\s*$/i.test((s.getAttribute('d') || '').trim())) continue;
      const r = s.getBoundingClientRect(); if (r.width < 6 || r.height < 6) continue;
      if (!(cx > r.left && cx < r.right && cy > r.top && cy < r.bottom)) continue;     // must sit behind the text's centre
      if (r.width > tr.width * 6 && r.height > tr.height * 6) continue;                // a big panel, not a label frame
      if (!best || r.width * r.height < best.r.width * best.r.height) best = { s, r };
    }
    if (!best) continue;
    const r = best.r, pad = 1;
    let over = Math.max(r.left + pad - tr.left, tr.right - (r.right - pad), r.top - tr.top, tr.bottom - r.bottom);
    // a rounded pill / ellipse needs room at its ends: allow the text only inside the straight part plus half the radius
    if (best.s.tagName === 'ellipse' || best.s.tagName === 'circle') over = Math.max(over, tr.width - r.width * 0.8);
    else if (best.s.tagName === 'rect') { const rx = Math.min(r.height / 2, parseFloat(best.s.getAttribute('rx') || 0) * (r.height / (best.s.getBBox().height || 1))); over = Math.max(over, tr.left - r.left < rx * 0.35 || r.right - tr.right < rx * 0.35 ? 1 : over); }
    if (over > 0.5) {
      const svg = t.closest('svg');
      out.push({ where: (svg.id ? '#' + svg.id : '') + (svg.closest('[id]') ? ' in #' + svg.closest('[id]').id : ''), text: t.textContent.trim().slice(0, 40), over: Math.round(over), frame: best.s.tagName });
    }
  }
  return out;
})()`;
const STEP_ANIMS = `(async () => {
  const res = [];
  const figs = [...document.querySelectorAll('figure.anim')].filter((f) => f.querySelector('.anim-steps'));
  for (const f of figs) {
    const ticks = f.querySelectorAll('.anim-steps button');
    f.scrollIntoView({ block: 'center' });
    for (let i = 0; i < ticks.length; i++) {
      ticks[i].click();
      const play = f.querySelector('.anim-btn.play'); if (play && /⏸/.test(play.textContent)) play.click();
      await new Promise((r) => setTimeout(r, 60));
      // middle and end of the step: let it run a little, then pause
      if (play) { play.click(); await new Promise((r) => setTimeout(r, 900)); if (/⏸/.test(play.textContent)) play.click(); }
      res.push(...(${MEASURE}).map((o) => ({ ...o, step: (f.id || 'anim') + ' step ' + (i + 1) })));
    }
  }
  return res;
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
  const a = (await send('Runtime.evaluate', { expression: MEASURE, returnByValue: true }, sid)).result.value || [];
  const b = (await send('Runtime.evaluate', { expression: STEP_ANIMS, awaitPromise: true, returnByValue: true }, sid)).result.value || [];
  const seen = new Set(), rows = [];
  for (const o of [...a, ...b]) { const k = o.where + '|' + o.text; if (seen.has(k)) continue; seen.add(k); rows.push(o); }
  all[page] = rows;
  if (rows.length) bad++;
  if (!opt.json) {
    console.log(`${rows.length ? 'FAIL' : 'ok  '} ${page}: ${rows.length} label(s) out of their frame`);
    rows.slice(0, 30).forEach((o) => console.log(`     «${o.text}» ${o.over}px out of its ${o.frame}${o.step ? ' (' + o.step + ')' : ''} ${o.where}`));
  }
  await send('Target.closeTarget', { targetId });
}
if (opt.json) console.log(JSON.stringify(all, null, 1));
ws.close(); chrome.kill(); server.close();
await rm(profile, { recursive: true, force: true }).catch(() => {});
process.exit(bad ? 1 : 0);
