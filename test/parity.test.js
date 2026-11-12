// What you see is what you export: the editor's layout (edit mode + the editor stylesheet) must be exactly as tall as the
// PDF's print layout, for every template, both with complete content and with plenty of optional fields left empty.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const T = require('../shared/templates');
const R = require('../shared/render');
const { buildHtml, getBrowser } = require('../server/pdf');

const APP_CSS = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'app.css'), 'utf8');

function emptySome(doc) {
  doc.sections.forEach((s) => s.items.forEach((it, i) => {
    if (i % 2 === 0) it.text = '';
    if (i % 3 === 0) { it.date = ''; it.location = ''; }
    if (i % 3 === 1) { it.org = ''; it.bullets = ['']; }
    if (it.sub !== undefined && i % 2) it.sub = '';
    if (it.label !== undefined && i % 2) it.label = '';
  }));
  doc.header.tagline = '';
  doc.header.contacts.forEach((c, i) => { if (i % 2) c.text = ''; });
  if (doc.sections[2]) doc.sections[2].items = []; // a section with nothing in it
  return doc;
}

test('editor layout is exactly as tall as the exported PDF layout, for every template', { timeout: 240000 }, async () => {
  const browser = await getBrowser(), page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 900 });
  const bad = []; let n = 0;
  try {
    for (const t of T.TEMPLATES) for (const mode of ['full', 'sparse']) {
      let doc = T.sampleDoc(t.id); if (mode === 'sparse') doc = emptySome(doc);
      doc = T.normalizeDoc(doc);
      const base = buildHtml(doc);
      await page.setContent(base, { waitUntil: 'load' });
      const printH = await page.evaluate(() => document.querySelector('.rz').getBoundingClientRect().height);
      const a = base.indexOf('<tbody><tr><td>') + 15, z = base.indexOf('</td></tr></tbody></table>');
      await page.setContent(base.slice(0, a) + '<div class="sheet-edit">' + R.render(doc, { edit: true }) + '</div>' + base.slice(z), { waitUntil: 'load' });
      await page.addStyleTag({ content: APP_CSS });
      const editH = await page.evaluate(() => document.querySelector('.rz').getBoundingClientRect().height);
      n++;
      if (Math.abs(printH - editH) > 0.5) bad.push(`${t.id}/${mode}: pdf ${printH.toFixed(1)} vs editor ${editH.toFixed(1)}`);
    }
  } finally { await page.close(); }
  assert.equal(n, T.TEMPLATES.length * 2);
  assert.deepEqual(bad, []);
});

test('the PDF document title is the file name, not the person\'s name', () => {
  const doc = T.normalizeDoc(T.sampleDoc('classic'));
  doc.header.name = 'Some Person';
  const html = buildHtml(doc, 'Quarterly <Resume>');
  assert.match(html, /<title>Quarterly &lt;Resume&gt;<\/title>/);
  assert.ok(!/<title>[^<]*Some Person/.test(html));
});
