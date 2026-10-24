// Interaction-state screenshots (answered predict, hover, keyboard focus, teacher mode, quiz, flashcard face).
//   node states.mjs <docsDir> <outDir>
// Serves docsDir, drives headless Chrome over CDP, kills Chrome on exit.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const [DOCS, OUT] = process.argv.slice(2).map((p) => path.resolve(p));
await mkdir(OUT, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(DOCS, p);
  try { res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(await readFile(file)); }
  catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}/`;
const profile = await mkdtemp(path.join(tmpdir(), 'states-'));
const chrome = spawn('google-chrome', ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
process.on('exit', () => chrome.kill());
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => process.exit(130));
const wsUrl = await new Promise((res, rej) => { let b = ''; chrome.stderr.on('data', (d) => { b += d; const m = b.match(/DevTools listening on (ws:\/\/\S+)/); if (m) res(m[1]); }); setTimeout(() => rej(new Error('no chrome')), 15000); });
const ws = new WebSocket(wsUrl); await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let seq = 0; const pend = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const { res, rej } = pend.get(m.id); pend.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } });
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++seq; pend.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(page, theme, width = 1280) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: sid } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sid);
  await send('Emulation.setFocusEmulationEnabled', { enabled: true }, sid);
  await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 }, sid);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] }, sid);
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.clear();localStorage.setItem('site-theme', ${JSON.stringify(theme)})}catch{}` }, sid);
  await send('Page.navigate', { url: origin + page }, sid);
  await sleep(2600);
  const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sid)).result.value;
  const close = () => send('Target.closeTarget', { targetId });
  const shot = async (sel, name, pad = 16) => {
    const r = await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.scrollIntoView({block:'start'}); const b = e.getBoundingClientRect(); return {x:b.left+scrollX, y:b.top+scrollY, w:b.width, h:b.height}; })()`);
    await sleep(350);
    const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: r.w + 2 * pad, height: r.h + 2 * pad, scale: 1 } }, sid);
    await writeFile(path.join(OUT, name), Buffer.from(data, 'base64'));
  };
  const key = async (k, code, vk) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk }, sid); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk }, sid); };
  const hover = async (sel) => {
    const c = await ev(`(() => { const b = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return {x:b.left+b.width/2, y:b.top+b.height/2}; })()`);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y }, sid); await sleep(300);
  };
  return { ev, shot, key, hover, close, sid };
}

for (const theme of ['dark', 'light']) {
  // 1. warm-up predicts: wrong, right, then keyboard focus on the third
  let p = await open('lessons/1-1/', theme);
  await p.ev(`document.querySelector('#wu-1 .opt:nth-child(1)').click(); document.querySelector('#wu-2 .opt:nth-child(3)').click(); true`);
  await p.ev(`document.querySelector('#warmup').scrollIntoView(); true`); await sleep(200);
  await p.key('Tab', 'Tab', 9);
  await p.ev(`document.querySelector('#wu-3 .opt:nth-child(2)').focus(); true`);
  await p.shot('#warmup', `state-predict-${theme}.png`);
  // 2. gated multimeter: before and after the prediction
  await p.shot('#w-meter', `state-gate-locked-${theme}.png`);
  await p.ev(`document.querySelector('.predict[data-gate="w-meter"] .opt:nth-child(2)').click(); true`); await sleep(900);
  await p.shot('.predict[data-gate="w-meter"]', `state-gate-answer-${theme}.png`);
  await p.shot('#w-meter', `state-gate-open-${theme}.png`);
  // 3. teacher mode + team challenge
  await p.ev(`(document.querySelector('.teacher-btn')||{click(){document.documentElement.classList.add('teacher')}}).click(); true`); await sleep(400);
  if (await p.ev(`!!document.querySelector('.challenge')`)) await p.shot('.challenge', `state-challenge-${theme}.png`);
  if (await p.ev(`!!document.querySelector('.note.tip, .note.warn')`)) await p.shot('.note.tip, .note.warn', `state-note-${theme}.png`);
  // 4. lesson quiz: answer the first question
  await p.ev(`(() => { const o = document.querySelector('.quiz .qz-opt'); if (o) o.click(); const b = [...document.querySelectorAll('.quiz .qz-actions .btn')].find(b => /Перевір/.test(b.textContent)); if (b) b.click(); return true; })()`); await sleep(500);
  await p.shot('.quiz', `state-quiz-${theme}.png`);
  await p.close();
  // 5. flashcards (desktop + phone): start a session and reveal the answer
  for (const w of [1280, 375]) {
    p = await open('cards/', theme, w);
    await p.ev(`(() => { const b = [...document.querySelectorAll('#trainer .btn')].find(b => /Почати|Повторити сьогодні/.test(b.textContent)); b && b.click(); return !!b; })()`); await sleep(700);
    await p.ev(`(() => { const b = document.querySelector('.fc-flip'); b && b.click(); return !!b; })()`); await sleep(600);
    await p.shot('.fc-session', `state-flashcard-${w}-${theme}.png`);
    await p.close();
  }
  // 6. projector: reveal the answer
  p = await open('warmup/', theme);
  await p.ev(`(() => { const b = [...document.querySelectorAll('.qp-ctrl .btn')].find(b => /Показати/.test(b.textContent)); b && b.click(); return !!b; })()`); await sleep(600);
  await p.shot('.qp', `state-projector-${theme}.png`);
  await p.close();
}
ws.close(); chrome.kill(); server.close(); await rm(profile, { recursive: true, force: true }).catch(() => {});
console.log('ok');
process.exit(0);
