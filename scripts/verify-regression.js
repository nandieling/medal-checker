const path = require('path');
const ROOT = path.resolve(__dirname, '..');
delete require.cache[path.resolve(ROOT, 'tests/mocks/chrome-mock.js')];
const { createChromeMock } = require(path.relative(__dirname, path.resolve(ROOT, 'tests/mocks/chrome-mock')));
const { JSDOM } = require(path.relative(__dirname, path.resolve(ROOT, 'node_modules/jsdom')));

global.DOMParser = (new JSDOM('')).window.DOMParser;
global.chrome = createChromeMock();
global.AbortController = AbortController;
global.navigator = { userAgent: 'test' };
global.fetch = () => Promise.resolve({ ok: false });

delete require.cache[require.resolve('../background.js')];
const bg = require('../background.js');

const fs = require('fs');
const debugFile = process.argv[2] || path.resolve(__dirname, '..', 'PT_Debug_2026-05-21.json');
const data = JSON.parse(fs.readFileSync(debugFile, 'utf-8'));

let totalMedals = 0;
for (const p of data.pages) {
  const r = bg.extractMedalsFromHtml(p.html);
  if (r.length > 0) {
    const domain = new URL(p.url).hostname;
    const pathn = new URL(p.url).pathname;
    console.log(`\n[${r.length}] ${domain}${pathn}`);
    for (const m of r) {
      console.log(`  - ${m.name}  price=${m.price}  dur=${m.duration}  bonus=${m.bonus}  stock=${m.stock}  timeRange=${m.timeRange}  id=${m.medalId || '-'}`);
    }
    totalMedals += r.length;
  }
}
console.log(`\nTotal medals: ${totalMedals}`);