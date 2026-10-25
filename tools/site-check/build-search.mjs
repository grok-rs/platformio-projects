// Builds the site search index docs/data/search.json (read by the search box in docs/assets/site-nav.js).
//
//   node tools/site-check/build-search.mjs            rebuild the index (run from anywhere; no dependencies)
//   node tools/site-check/build-search.mjs --stats    the same, plus a count per type and the biggest records
//
// REBUILD THE INDEX after any change to the study pages or the data files: a new or edited page under docs/, a new
// glossary term, a new card deck or quiz. The index is a plain committed file (GitHub Pages has no build step), so
// a stale index just misses the new text; nothing breaks. Then check the results headless (see tools/site-check).
//
// What goes in (one record per hit the reader can land on):
//   docs/**/*.html          a record per page (its <title> and the text before the first heading) and one per h2/h3
//                           section, linked to the nearest id (the heading's own or its section's); pages under
//                           lessons/ are «урок», the rest «сторінка»; the parts of atlas/ (article.atl) and kit/
//                           (article.kit-card) are «деталь». New pages are picked up by themselves on the next run.
//                           Skipped: scripts, styles, svg, noscript, template, the site nav, buttons and outputs
//                           (widget labels), hidden / aria-hidden subtrees, assets/_demo.html and lessons/_test/.
//   data/glossary.json      «глосарій» → glossary/#t-<id>
//   data/cards/*.json       «картка» (front = title, back = text) → cards/?deck=<deck>
//   data/quiz/*.json        question stems join the keywords of the lesson's «Самоперевірка» (#check) record
//   data/pins-s3.json       «деталь»: every GPIO of the board → the pinout of lesson 1.4 (#w-pins)
//
// Record fields (short names keep the file small): y type, t title, a alternative names (en, aka), p where it lives
// (page title / deck), u URL relative to docs/, x display text (≤ 220 chars), k searchable words (deduplicated,
// lower-cased, without the words already in t/a/x, stop words and 1–2-letter words). Matching (normalisation, stemming, ranking) is done in the browser.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs');
const OUT = path.join(DOCS, 'data/search.json');
const SKIP = [/^assets\//, /^lessons\/_test\//];
const STATS = process.argv.includes('--stats');

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', laquo: '«',
  raquo: '»', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', times: '×', minus: '−', middot: '·', deg: '°', micro: 'µ',
  ohm: 'Ω', Omega: 'Ω', le: '≤', ge: '≥', rarr: '→', larr: '←', thinsp: ' ', shy: '', zwj: '', zwnj: '', asymp: '≈', plusmn: '±' };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1));
  return ENT[e] ?? m;
});
const clean = (s) => decode(String(s ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const clip = (s, n = 220) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1) > n * 0.6 ? s.lastIndexOf(' ', n - 1) : n - 1) + '…');

// The same word normalisation as site-nav.js (keep the two in step): lower case, apostrophes dropped, ґ → г,
// Latin/Cyrillic kept apart, every other non-letter/digit a separator.
const norm = (s) => String(s).toLowerCase().replace(/[’'ʼ`´]/g, '').replace(/ґ/g, 'г').replace(/ё/g, 'е');
const words = (s) => norm(s).match(/[\p{L}\p{N}]+/gu) || [];

// ---------------------------------------------------------------- HTML
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const DROP = new Set(['script', 'style', 'svg', 'noscript', 'template', 'canvas', 'math', 'select', 'button', 'output']);
const BLOCK = new Set(['p', 'div', 'li', 'td', 'th', 'tr', 'section', 'article', 'header', 'footer', 'figure', 'figcaption',
  'blockquote', 'pre', 'dd', 'dt', 'summary', 'details', 'ul', 'ol', 'table', 'aside', 'main', 'h1', 'h2', 'h3', 'h4', 'br', 'button', 'label']);
const attr = (a, name) => {
  const m = a.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? decode(m[1] ?? m[2] ?? m[3] ?? '') : null;
};
const hasAttr = (a, name) => new RegExp(`(?:^|\\s)${name}(?:\\s|=|$)`, 'i').test(a);

function crawlPage(rel, html) {
  const pageTitle = clean((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || rel);
  const desc = (html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [])[1];
  const isLesson = rel.startsWith('lessons/');
  const pageUrl = rel.replace(/index\.html$/, '');
  const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [, html])[1].replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|template|textarea)\b[\s\S]*?<\/\1>/gi, ' ');
  const recs = [];
  const page = { y: isLesson ? 'урок' : 'сторінка', t: pageTitle.replace(/ · Embedded на ESP32-S3$/, ''), p: '', u: pageUrl, buf: [] };
  recs.push(page);
  let cur = page;
  const stack = []; // {tag, id, cls, drop}
  let dropDepth = 0;   // > 0 inside a dropped subtree
  let head = null;     // heading being read: {tag, buf, anchor, part}
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)/g;
  let m;
  while ((m = re.exec(body))) {
    if (m[4] != null) {
      if (dropDepth) continue;
      const t = m[4];
      if (head) { if (!head.skipN) head.buf.push(t); } else cur.buf.push(t);
      continue;
    }
    const close = m[1] === '/';
    const tag = m[2].toLowerCase();
    const a = m[3] || '';
    if (!close) {
      if (VOID.has(tag) || /\/\s*$/.test(a)) {
        if (BLOCK.has(tag) && !dropDepth) (head ? head.buf : cur.buf).push(' ');
        continue;
      }
      const cls = attr(a, 'class') || '';
      const drop = dropDepth > 0 || DROP.has(tag) || hasAttr(a, 'hidden') || attr(a, 'aria-hidden') === 'true'
        || (tag === 'nav' && /\bsite-nav\b|\btopbar\b/.test(cls)) || /\b(?:skip|sn-skip|sr-only)\b/.test(cls) && tag === 'a';
      stack.push({ tag, id: attr(a, 'id'), cls, drop });
      if (drop) { dropDepth++; continue; }
      if (BLOCK.has(tag)) (head ? head.buf : cur.buf).push(' ');
      if ((tag === 'p' || tag === 'dd' || tag === 'li') && !head && !cur.lead) stack[stack.length - 1].p = { rec: cur, at: cur.buf.length };
      if (head && tag === 'span' && /(?:^|\s)n(?:\s|$)/.test(cls)) head.skipN = stack.length; // «01» section numbers
      if (/^h[1-3]$/.test(tag) && !head) {
        const own = attr(a, 'id');
        let anchor = own, part = null;
        for (let i = stack.length - 2; i >= 0; i--) {
          const s = stack[i];
          if (s.tag === 'article' && /\b(?:atl|kit-card)\b/.test(s.cls)) part = part || s;
          if (!anchor && s.id && s.id !== 'main') anchor = s.id;
        }
        if (part && part.id) anchor = part.id;
        head = { tag, buf: [], anchor, part, depth: stack.length };
      }
      continue;
    }
    // closing tag: pop to the matching open element
    let i = stack.length - 1;
    while (i >= 0 && stack[i].tag !== tag) i--;
    if (i < 0) continue;
    while (stack.length > i) {
      const s = stack.pop();
      if (s.drop) dropDepth--;
      // the first real paragraph (p, dd or li of ≥ 40 chars) of a section is its display text (widgets and labels come out as word salad)
      if (s.p && !s.p.rec.lead) { const t = clean(s.p.rec.buf.slice(s.p.at).join('')); if (t.length >= 40) s.p.rec.lead = t; }
      if (head && head.skipN && stack.length < head.skipN) head.skipN = 0;
      if (head && stack.length < head.depth) {
        const text = clean(head.buf.join(''));
        const h = head;
        head = null;
        if (h.tag === 'h1') { page.buf.push(' '); continue; }
        if (!text) continue;
        cur = { y: h.part ? 'деталь' : page.y, t: text, p: page.t, u: pageUrl + (h.anchor ? '#' + h.anchor : ''), buf: [], sec: true };
        recs.push(cur);
      }
    }
    // badges inside a heading («W9», «01») end with a space: «W9 Часова діаграма»
    // and so do links set side by side as chips («1.1 Мультиметр» «1.2 Резистор»)
    if (!dropDepth && (BLOCK.has(tag) || tag === 'a' || (head && tag === 'span'))) (head ? head.buf : cur.buf).push(' ');
  }
  // h3 sections without an id of their own share their section's anchor: fine. Merge empty records into nothing.
  return recs.map((r) => ({ ...r, text: clean(r.buf.join('')), desc: r === page && desc ? clean(desc) : '', lead: r.lead || '' })).filter((r) => r.text || !r.sec || r.y === 'деталь');
}

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const readJSON = async (rel) => JSON.parse(await readFile(path.join(DOCS, rel), 'utf8'));

// ---------------------------------------------------------------- build
const recs = [];
const files = (await walk(DOCS)).map((f) => path.relative(DOCS, f).split(path.sep).join('/')).sort();
for (const rel of files) {
  if (SKIP.some((r) => r.test(rel))) continue;
  for (const r of crawlPage(rel, await readFile(path.join(DOCS, rel), 'utf8'))) {
    // source lists and errata are links and dates: findable by their heading only
    const body = /^(?:Джерела|Список джерел|Матеріали|Що виправлено)/.test(r.t) ? '' : `${r.desc} ${r.text}`;
    recs.push({ y: r.y, t: r.t, p: r.p, u: r.u, // display text: the meta description (page), the first paragraph, or a short section's whole text; a widget
    // panel without a paragraph shows only its heading (its labels and buttons read as word salad)
    x: r.desc || r.lead || (!r.sec || r.text.length <= 200 ? r.text : ''), body });
  }
}

// Course map: the page title alone is «Карта курсу»; the lesson list is drawn by JS, so name the lessons here.
const lessonTitle = {};
try {
  const src = await readFile(path.join(DOCS, 'assets/course.js'), 'utf8');
  for (const m of src.matchAll(/L\('([\w-]+)',\s*'([^']*)',\s*'([^']*)'/g)) lessonTitle[m[1]] = `${m[2]} ${m[3]}`;
} catch { /* optional */ }

// glossary
const gl = await readJSON('data/glossary.json');
for (const t of gl.terms) {
  const aka = [t.en, ...(t.aka || [])].filter(Boolean).map(clean).join(' · ');
  recs.push({ y: 'глосарій', t: clean(t.uk), a: aka, p: 'Глосарій' + (lessonTitle[t.lesson] ? ` · урок ${lessonTitle[t.lesson].split(' ')[0]}` : ''),
    u: `glossary/#t-${t.id}`, x: clean(t.def), body: clean(t.def) });
}

// cards
for (const f of (await readdir(path.join(DOCS, 'data/cards'))).filter((f) => f.endsWith('.json') && !f.startsWith('_')).sort()) {
  const d = await readJSON('data/cards/' + f);
  const deck = d.deck || f.replace(/\.json$/, '');
  for (const c of d.cards || []) {
    const front = clean(c.front), back = clean(c.back);
    if (!front) continue;
    recs.push({ y: 'картка', t: front, p: clean(d.title) || `Картки ${deck}`, u: `cards/?deck=${encodeURIComponent(deck)}`, x: back, body: back });
  }
}

// quiz stems → the lesson's #check record
for (const f of (await readdir(path.join(DOCS, 'data/quiz'))).filter((f) => f.endsWith('.json') && !f.startsWith('_'))) {
  const d = await readJSON('data/quiz/' + f);
  const id = d.lesson || f.replace(/\.json$/, '');
  const r = recs.find((x) => x.u === `lessons/${id}/#check`);
  if (r) r.body += ' ' + (d.questions || []).map((q) => clean(q.stem)).join(' ');
}

// pins of the board
const pins = await readJSON('data/pins-s3.json');
for (const p of pins.pins) {
  if (p.gpio == null) continue;
  const cls = (p.classes || []).map((c) => pins.classes[c]).filter(Boolean).join(', ');
  recs.push({ y: 'деталь', t: `GPIO${p.gpio}`, a: `IO${p.gpio} пін ${p.gpio}`, p: `Розпіновка YD-ESP32-S3 · ${pins.verdicts[p.verdict] || ''}`.replace(/ · $/, ''),
    u: 'lessons/1-4/#w-pins', x: clean(p.note) || cls, body: `${cls} ${clean(p.note)}` });
}

// words too common to search for (short words of ≤ 2 letters are dropped anyway)
const STOP = new Set(('але або без був була були було вам вас ваш ваша ваше ваші вже все всі він вона вони воно для його '
  + 'якщо яка який які яке коли тут там так теж тому того той тож цей ця це ці цього цієї щоб що ще як із при про під '
  + 'над між через після перед поки лише тільки також навіть дуже можна треба буде будь має мають немає нема від зі '
  + 'the and for are with that this from you your').split(' '));

// keywords: every distinct word of the body that is not already in the title / alt names
const out = recs.map((r) => {
  const x = r.x ? clip(r.x) : '';
  const own = new Set(words(`${r.t} ${r.a || ''} ${x}`));
  const k = [...new Set(words(r.body))].filter((w) => !own.has(w) && !STOP.has(w) && (w.length > 2 || /\d/.test(w))).join(' ');
  const o = { y: r.y, t: r.t };
  if (r.a) o.a = r.a;
  if (r.p) o.p = r.p;
  o.u = r.u;
  if (x) o.x = x;
  if (k) o.k = k;
  return o;
});

const json = JSON.stringify({ version: 1, built: new Date().toISOString().slice(0, 10), count: out.length, items: out });
await writeFile(OUT, json + '\n');
console.log(`search index: ${out.length} records, ${(json.length / 1024).toFixed(0)} KB → ${path.relative(process.cwd(), OUT)}`);
if (STATS) {
  const by = {};
  out.forEach((r) => { by[r.y] = (by[r.y] || 0) + 1; });
  console.log(by);
  console.log(out.map((r) => [JSON.stringify(r).length, r.u, r.t]).sort((a, b) => b[0] - a[0]).slice(0, 8));
}
