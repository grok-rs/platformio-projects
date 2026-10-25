// Headless-Chrome interaction test for lesson hubs (companion of check.mjs).
//
//   node tools/site-check/interact.mjs [--storage on|off|both] [page ...]      (default: lessons/_test/, both)
//
// For every page it opens a fresh browser profile, then does what a student does on a hub:
//   1. answers the first .predict (the correct option) and checks that its .gated widget opens,
//   2. answers every question of the first stepper .quiz (MCQ: first option; numeric: «1») and reaches the end,
//   3. starts the first .deck-mini session, shows the answer and grades the card «Добре»,
//   4. types into the first table.measure input and the exit-ticket textarea,
//      (team/: fills the role generators with four names and checks the page stays 375 px wide),
//   5. reloads and checks that the prediction, quiz score, card state, table value and ticket text came back.
// With --storage off, Storage.prototype.getItem/setItem/removeItem throw (private mode, blocked site data):
// the same steps must run without exceptions; nothing is expected to survive the reload.
// Steps whose component is absent on the page are reported as «skip», and so is the saved-score check of a quiz
// with several sources or data-manual (no single lesson key). Exit code 1 on any failure.
// Needs Node ≥ 22 (built-in WebSocket) and google-chrome on PATH.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2' };

const args = process.argv.slice(2);
let storageModes = ['on', 'off'];
const pages = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--storage') { const v = args[++i]; storageModes = v === 'both' ? ['on', 'off'] : [v]; }
  else pages.push(args[i]);
}
if (!pages.length) pages.push('lessons/_test/');

/* ---------------------------------------------------------------- static server + Chrome over CDP (as in check.mjs) */
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(DOCS, p);
  if (!file.startsWith(DOCS)) { res.writeHead(403).end(); return; }
  try { const body = await readFile(file); res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(body); } // read first: a 404 must not follow a 200 header
  catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}/`;

const profile = await mkdtemp(path.join(tmpdir(), 'site-interact-'));
const chrome = spawn('google-chrome', ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--no-default-browser-check', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'] });
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

/* ---------------------------------------------------------------- page-side helpers */
// Injected before every evaluate: wait(fn) polls until fn() is truthy (or throws after 5 s).
const PRELUDE = `const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (fn, ms = 5000) => { const t0 = Date.now(); for (;;) { const v = fn(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timeout: ' + fn); await new Promise((r) => setTimeout(r, 50)); } };
  const tick = () => new Promise((r) => setTimeout(r, 30));
  const store = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return 'blocked'; } };
  // The self-check quiz: data-mode="stepper" (the default), or a page-mounted data-manual one that is not a warm-up.
  const isStepper = (q) => (q.dataset.mode || 'stepper') === 'stepper' || (q.hasAttribute('data-manual') && !/warmup|present/.test(q.dataset.mode || ''));`;

// Step 1–4: interact. Returns {name: 'ok' | 'skip' | 'FAIL: …'}.
const ACT = `(async () => { ${PRELUDE}
  const out = {};
  await wait(() => window.Study && Study.isReady);
  // 1. predict → gate
  const p = $('.predict[data-gate]') || $('.predict');
  if (!p) out.predict = 'skip';
  else {
    const ok = p.dataset.ok ? +p.dataset.ok : 0;
    $$('.opt', p)[ok].click();
    await tick();
    const g = p.dataset.gate && document.getElementById(p.dataset.gate);
    out.predict = p.dataset.done !== '1' ? 'FAIL: not marked done' : g && !g.classList.contains('open') ? 'FAIL: gate still locked'
      : g && $('.gate-msg', g) ? 'FAIL: overlay still shown' : 'ok';
  }
  // 2. stepper quiz, all questions
  const qz = $$('.quiz').find(isStepper);
  if (!qz) out.quiz = 'skip';
  else {
    try {
      await wait(() => $('.qz-q', qz) || $('.qz-msg', qz));
      if (!$('.qz-q', qz)) throw new Error($('.qz-msg', qz).textContent.trim().slice(0, 80));
      for (let i = 0; i < 40 && !$('.qz-end', qz); i++) {
        const box = await wait(() => $('.qz-body .qz-q', qz));
        if ($('.qz-opt', box)) $('.qz-opt', box).click(); else $('.qz-input', box).value = '1';
        await tick();
        $('.qz-check', box)?.click();
        await wait(() => $('.qz-next', qz));
        $('.qz-next', qz).click();
        await tick();
      }
      out.quiz = $('.qz-end', qz) ? 'ok' : 'FAIL: end screen not reached';
    } catch (e) { out.quiz = 'FAIL: ' + e.message; }
  }
  // 3. mini deck: start, flip, grade 3
  const dm = $('.deck-mini');
  if (!dm) out.cards = 'skip';
  else {
    try {
      const go = await wait(() => $('.fc-go', dm) || $('.fc-empty', dm) || $('.fc-msg b', dm));
      if (!go.classList.contains('fc-go')) throw new Error('no session to start: ' + dm.textContent.trim().slice(0, 80));
      go.click();
      (await wait(() => $('.fc-flip', dm))).click();
      (await wait(() => $('.fc-g[data-g="3"]', dm))).click();
      await tick();
      out.cards = 'ok';
    } catch (e) { out.cards = 'FAIL: ' + e.message; }
  }
  // 4. measure table + exit ticket
  const mi = $('table.measure td[data-col="pred"] input');
  if (!mi) out.measure = 'skip';
  else { mi.value = '6,4'; mi.dispatchEvent(new Event('input', { bubbles: true })); await tick();
    const diff = $('td[data-col="diff"]', mi.closest('tr'));
    const mm = $('td[data-col="meas"] input', mi.closest('tr'));
    if (mm) { mm.value = '6,1'; mm.dispatchEvent(new Event('input', { bubbles: true })); await tick(); }
    out.measure = !diff || /%/.test(diff.textContent) ? 'ok' : 'FAIL: diff not computed («' + diff.textContent + '»)'; }
  const et = $('form.exit-ticket textarea');
  if (!et) out.exit = 'skip';
  else { et.value = 'Струм однаковий у всьому колі.'; et.dispatchEvent(new Event('input', { bubbles: true })); out.exit = 'ok'; }
  // teacher mode toggles html.teacher
  const tb = $('.teacher-btn, [data-teacher-toggle]');
  if (!tb) out.teacher = 'skip';
  else { const was = document.documentElement.classList.contains('teacher'); tb.click(); await tick();
    const now = document.documentElement.classList.contains('teacher'); tb.click();
    out.teacher = now !== was ? 'ok' : 'FAIL: html.teacher did not toggle'; }
  return out;
})()`;

// Step 5: after reload, what came back from storage.
const CHECK = `(async () => { ${PRELUDE}
  await wait(() => window.Study && Study.isReady);
  await new Promise((r) => setTimeout(r, 400)); // let quiz/deck mount
  const out = {};
  const p = $('.predict[data-gate]') || $('.predict');
  if (p) out.predict = p.dataset.done === '1' ? 'restored' : 'empty';
  const qz = $$('.quiz').find(isStepper);
  // A score is saved under one lesson id; a multi-source (data-src="a,b") or page-mounted (data-manual) quiz has
  // no single key to look for, so its reload check is skipped rather than failed.
  if (qz) {
    const k = (qz.dataset.src || '').trim();
    if (!k || k.includes(',') || qz.hasAttribute('data-manual')) out.quiz = 'skip (multi-source/manual)';
    else { const s = store('study.quiz.v1'); out.quiz = s === 'blocked' ? 'blocked' : s && s[k] && Number.isFinite(s[k].best) ? 'restored' : 'empty'; }
  }
  const dm = $('.deck-mini');
  if (dm) { const s = store('study.cards.v1'); out.cards = s === 'blocked' ? 'blocked' : s && s.s && Object.keys(s.s).length ? 'restored' : 'empty'; }
  const mi = $('table.measure td[data-col="pred"] input');
  if (mi) out.measure = mi.value === '6,4' ? 'restored' : 'empty';
  const et = $('form.exit-ticket textarea');
  if (et) out.exit = et.value ? 'restored' : 'empty';
  return out;
})()`;

// team/: the role generators must not widen the 375 px page once they are filled with four names.
const TEAM = `(async () => {
  const r = document.querySelector('#r-names'), c = document.querySelector('#c-names');
  if (!r) return null;
  for (const t of [r, c].filter(Boolean)) {
    t.value = 'Олександра Коваленко, Андрій Шевченко, Марко Бондаренко, Ірина Ткаченко';
    t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true }));
  }
  await new Promise((res) => setTimeout(res, 500));
  const sw = document.documentElement.scrollWidth, cw = document.documentElement.clientWidth;
  return sw <= cw ? 'ok (' + sw + ' <= ' + cw + ')' : 'FAIL page ' + sw + 'px wide > ' + cw + 'px after 4 names';
})()`;

const BLOCK = `(() => { const no = () => { throw new DOMException('blocked by test', 'SecurityError'); };
  Storage.prototype.getItem = no; Storage.prototype.setItem = no; Storage.prototype.removeItem = no; })();`;

/* ---------------------------------------------------------------- run */
let failed = 0;
for (const page of pages) {
  for (const mode of storageModes) {
    const { browserContextId } = await send('Target.createBrowserContext'); // fresh, empty storage per run
    const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const problems = [];
    const onMsg = (m) => {
      if (m.sessionId !== sessionId) return;
      if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails;
        const urls = (d.stackTrace?.callFrames || []).map((f) => f.url).filter(Boolean);
        // giscus's own client.js reads localStorage unguarded; with storage blocked only the comment box fails, not the page.
        if (urls.length && urls.every((u) => u.startsWith('https://giscus.app/'))) return;
        problems.push('exception: ' + (d.exception?.description || d.text).split('\n')[0] + (urls.length ? ' @' + urls.join(' < ') : ''));
      }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') problems.push('console.error: ' + m.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 200));
      if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') problems.push('log: ' + m.params.entry.text.slice(0, 200));
    };
    listeners.add(onMsg);
    await send('Runtime.enable', {}, sessionId);
    await send('Log.enable', {}, sessionId);
    await send('Page.enable', {}, sessionId);
    await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true }, sessionId);
    if (mode === 'off') await send('Page.addScriptToEvaluateOnNewDocument', { source: BLOCK }, sessionId);
    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    };
    // Heavy hubs (many Kit drawings, the code editor) can still be loading after the fixed sleep on a busy machine:
    // wait up to 8 s more for the load event and for every quiz to have replaced its «Завантаження питань…» stub.
    const READY = `document.readyState === 'complete' && ![...document.querySelectorAll('.quiz')].some((q) => /Завантаження питань/.test(q.textContent))`;
    const settle = async () => { for (let t0 = Date.now(); Date.now() - t0 < 8000; await sleep(100)) if (await evaluate(READY)) return; };
    const tag = `${page} storage=${mode}`;
    const lines = [];
    try {
      await send('Page.navigate', { url: origin + page }, sessionId);
      await sleep(1500);
      await settle();
      const team = await evaluate(TEAM);
      if (team) { lines.push(`team     ${team}`); if (team.startsWith('FAIL')) problems.push(`team: ${team}`); }
      const acted = await evaluate(ACT);
      for (const [k, v] of Object.entries(acted)) { lines.push(`${k.padEnd(8)} ${v}`); if (v.startsWith('FAIL')) problems.push(`${k}: ${v}`); }
      await sleep(300);
      await send('Page.reload', {}, sessionId);
      await sleep(1500);
      await settle();
      const back = await evaluate(CHECK);
      for (const [k, v] of Object.entries(back)) {
        lines.push(`reload   ${k}: ${v}`);
        // With storage on everything must come back; with storage off nothing can (and that is fine).
        if (mode === 'on' && v !== 'restored' && !v.startsWith('skip')) problems.push(`${k} not restored after reload (${v})`);
      }
    } catch (e) { problems.push('script: ' + e.message.split('\n')[0]); }
    listeners.delete(onMsg);
    await send('Target.closeTarget', { targetId });
    await send('Target.disposeBrowserContext', { browserContextId });
    if (problems.length) { failed++; console.log(`FAIL ${tag}`); } else console.log(`ok   ${tag}`);
    lines.forEach((l) => console.log('     ' + l));
    [...new Set(problems)].forEach((p) => console.log('  - ' + p));
  }
}

ws.close(); chrome.kill(); server.close();
await rm(profile, { recursive: true, force: true }).catch(() => {});
process.exit(failed ? 1 : 0);
