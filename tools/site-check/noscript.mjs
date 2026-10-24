// Regenerates the <noscript> fallback list in docs/index.html from docs/assets/course.js.
import { readFileSync, writeFileSync } from 'node:fs';
const docs = process.argv[2];
globalThis.window = {};
new Function(readFileSync(docs + '/assets/course.js', 'utf8'))();
const C = window.COURSE;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const out = [];
for (const m of C.modules) {
  const items = [];
  for (const l of m.lessons) {
    const href = l.hub || `lessons/${l.id}/`;
    const hub = l.status !== 'planned' ? `<a href="${href}">${esc(l.n)} · ${esc(l.title)}</a>` : `${esc(l.n)} · ${esc(l.title)}`;
    const deep = (l.deep || []).map((d) => `<a href="${d.href}">${esc(d.label)}</a>`).join(', ');
    const date = l.date ? ` (${l.day} ${l.date.slice(8)}.${l.date.slice(5, 7)})` : '';
    items.push(`        <li>${hub}${date}${deep ? ' — глибше: ' + deep : ''}</li>`);
  }
  out.push(`      <h3>${esc(m.title)}</h3>\n      <ul>\n${items.join('\n')}\n      </ul>`);
}
out.push(`      <h3>Довідка</h3>\n      <ul>\n${C.globals.map((g) => `        <li><a href="${g.href}">${esc(g.title)}</a></li>`).join('\n')}\n      </ul>`);
out.push(`      <h3>Проєкти в репозиторії</h3>\n      <ul>\n${C.projects.map((p) => `        <li><a href="${C.repo}/tree/main/${p.folder}">${p.folder}</a> — ${esc(p.title)}</li>`).join('\n')}\n      </ul>`);
const f = docs + '/index.html';
const html = readFileSync(f, 'utf8').replace(/(<!-- NOSCRIPT:BEGIN[^\n]*\n)[\s\S]*?(<!-- NOSCRIPT:END -->)/, `$1      <p>Для інтерактивної карти увімкніть JavaScript. Усі сторінки курсу:</p>\n${out.join('\n')}\n$2`);
writeFileSync(f, html);
