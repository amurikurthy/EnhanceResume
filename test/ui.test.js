// Editor behaviour in real Chromium: dialogs, right-click menu, highlights that follow between page and sidebar,
// design previews with Revert/Apply.
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/er-ui-test-');
const test = require('node:test');
const assert = require('node:assert');
const app = require('../server/index.js');
const { getBrowser } = require('../server/pdf');

let server, base, browser, page, resumeId;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const count = (sel) => page.evaluate((s) => document.querySelectorAll(s).length, sel);

test.before(async () => {
  server = app.listen(0); base = 'http://127.0.0.1:' + server.address().port;
  const hdr = { 'Content-Type': 'application/json', 'X-Requested-With': 'EnhanceResume' };
  const reg = await fetch(base + '/api/auth/register', { method: 'POST', headers: hdr, body: JSON.stringify({ email: 'ui@example.com', password: 'password123', name: 'UI Tester' }) });
  const [name, value] = reg.headers.get('set-cookie').split(';')[0].split('=');
  resumeId = (await (await fetch(base + '/api/resumes', { method: 'POST', headers: { ...hdr, Cookie: `${name}=${value}` }, body: JSON.stringify({ title: 'UI', template: 'classic' }) })).json()).id;
  browser = await getBrowser(); page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 950 });
  await page.setCookie({ name, value, url: base });
  await page.goto(`${base}/#/edit/${resumeId}`);
  await page.waitForSelector('.sheet [data-f]'); await sleep(800);
});
test.after(async () => { if (page) await page.close().catch(() => {}); server.close(); });

test('Escape closes dialogs, topmost first', async () => {
  await page.click('button[title="Add a section"]'); await sleep(300);
  assert.equal(await count('.overlay'), 1);
  await page.keyboard.press('Escape'); await sleep(200);
  assert.equal(await count('.overlay'), 0);
});

test('right-click menu offers only relevant actions and survives the sidebar auto-scroll', async () => {
  await page.click('.sheet .rz-bul li', { button: 'right' }); await sleep(700); // longer than the sidebar\'s smooth scroll
  const items = await page.evaluate(() => [...document.querySelectorAll('.ctx-menu .ctx-l')].map((x) => x.textContent));
  assert.ok(items.includes('Delete bullet') && items.includes('Move bullet up'), items.join('|'));
  assert.ok(!items.includes('Delete entry'), 'bullet menu is not the entry menu');
  await page.keyboard.press('Escape'); await sleep(150);
  assert.equal(await count('.ctx-menu'), 0, 'Escape closes it');
  await page.click('.sheet .rz-e-title', { button: 'right' }); await sleep(700);
  const entry = await page.evaluate(() => [...document.querySelectorAll('.ctx-menu .ctx-l')].map((x) => x.textContent));
  assert.ok(entry.includes('Delete entry'), entry.join('|'));
  await page.keyboard.press('Escape');
});

test('clicking a bullet on the page highlights entry, bullet and its sidebar row', async () => {
  await page.click('.sheet .rz-bul li:nth-child(2)'); await sleep(400);
  const st = await page.evaluate(() => ({ entry: !!document.querySelector('.rz-entry.is-active'), bullet: document.querySelector('.rz-bul li.is-bullet') && document.querySelector('.rz-bul li.is-bullet').textContent.slice(0, 20), row: document.querySelectorAll('.follow-b').length }));
  assert.ok(st.entry && st.bullet && st.row === 1, JSON.stringify(st));
});

test('focusing a bullet in the sidebar gives the very same highlights on the page', async () => {
  await page.click('.sheet [data-f="H:name"]'); await sleep(300);
  await page.evaluate(() => document.querySelectorAll('.rows.bullets .row.bullet textarea')[1].focus()); await sleep(500);
  const st = await page.evaluate(() => ({ entry: !!document.querySelector('.rz-entry.is-active'), bullet: document.querySelector('.rz-bul li.pv-bullet') && document.querySelector('.rz-bul li.pv-bullet').textContent.slice(0, 20), row: document.querySelectorAll('.follow-b').length }));
  assert.ok(st.entry && st.bullet && st.row === 1, JSON.stringify(st));
  await page.evaluate(() => document.activeElement.blur()); await sleep(300);
  assert.equal(await count('.is-active'), 0, 'everything clears on blur');
});

test('bullet toolbar buttons move and delete exactly the bullet you are in', async () => {
  await page.click('.sheet .rz-bul li:nth-child(2)'); await sleep(400);
  const textOf = (n) => page.evaluate((i) => document.querySelectorAll('.sheet .rz-bul')[0].children[i].textContent, n);
  const second = await textOf(1), third = await textOf(2), len = await page.evaluate(() => document.querySelectorAll('.sheet .rz-bul')[0].children.length);
  await page.click('.fbtn[title="Move this bullet up"]'); await sleep(400);
  assert.equal(await textOf(0), second);
  await page.click('.fbtn[title="Delete this bullet"]'); await sleep(400);
  assert.equal(await page.evaluate(() => document.querySelectorAll('.sheet .rz-bul')[0].children.length), len - 1);
  assert.ok(!(await page.evaluate(() => document.querySelector('.sheet').textContent)).includes(second.slice(0, 30)));
  assert.equal(await textOf(1), third);
});

test('templates tab: picks from the gallery preview with Revert and Apply, no Mix & Match section', async () => {
  await page.click('.tabs button:nth-child(3)'); await page.waitForSelector('.tpl'); await sleep(500);
  assert.equal(await count('.mix'), 0);
  const beforeHtml = await page.evaluate(() => document.querySelector('.stage').innerHTML);
  const ids = await page.evaluate(() => [...document.querySelectorAll('.tpl')].map((t) => t.dataset.id));
  const clickMode = (label) => page.evaluate((l) => [...document.querySelectorAll('.tpl-mode button')].find((b) => b.textContent.includes(l)).click(), label);
  await clickMode('Layout'); await sleep(300);
  await page.click(`.tpl[data-id="${ids[1]}"]`); await sleep(400);
  await clickMode('Colors'); await sleep(300);
  await page.click(`.tpl[data-id="${ids[8]}"]`); await sleep(400);
  const banner = await page.evaluate(() => document.querySelector('.preview-banner').textContent);
  assert.match(banner, /layout \+ .* colors/);
  assert.match(banner, /Revert/);
  const marks = await page.evaluate(() => [...document.querySelectorAll('.tpl.picked')].map((t) => t.dataset.id + ':' + [...t.querySelectorAll('.tpl-marks em')].map((m) => m.textContent).join('+')));
  assert.deepEqual(marks.sort(), [`${ids[1]}:Layout`, `${ids[8]}:Colors`].sort());
  assert.notEqual(await page.evaluate(() => document.querySelector('.stage').innerHTML.length), beforeHtml.length, 'preview changed');
  await page.evaluate(() => [...document.querySelectorAll('.preview-banner button')].find((b) => b.textContent === 'Revert').click()); await sleep(400);
  const after = await page.evaluate(() => document.querySelector('.stage').innerHTML);
  const clean = (h) => h.replace(/ class=""/g, '');
  assert.equal(clean(after), clean(beforeHtml), 'Revert restores the page exactly');
  assert.equal(await count('.tpl.picked'), 0);
  assert.equal(await count('.stage.previewing'), 0, 'preview mode is off');
});

test('the template grid never overflows the panel, at any panel width', async () => {
  for (const w of [280, 360, 520, 700]) {
    await page.evaluate((x) => { document.querySelector('.panel').style.width = x + 'px'; }, w); await sleep(250);
    const o = await page.evaluate(() => { const b = document.querySelector('.panel-body'); return { sw: b.scrollWidth, cw: b.clientWidth }; });
    assert.ok(o.sw <= o.cw + 1, `panel ${w}px: scrollWidth ${o.sw} > clientWidth ${o.cw}`);
  }
});
