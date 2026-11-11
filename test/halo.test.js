// The henna halo is part of the photo's own box. This sweeps margins, photo sizes, shapes, positions and header styles
// in real Chromium and checks the visible petals never leave the page and never touch the header text.
const test = require('node:test');
const assert = require('node:assert');
const T = require('../shared/templates');
const { buildHtml, getBrowser } = require('../server/pdf');

const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('henna halo stays on the page and clear of the header text', { timeout: 120000 }, async () => {
  const browser = await getBrowser(), page = await browser.newPage();
  await page.setViewport({ width: 900, height: 1200 });
  const bad = []; let n = 0;
  try {
    for (const margin of [0, 13, 26]) for (const size of [16, 27, 46]) for (const pos of ['left', 'right']) for (const shape of ['circle', 'square']) for (const style of ['left', 'center', 'banner']) {
      const d = T.sampleDoc('mehndi');
      d.header.photo = PHOTO; d.header.photoMode = 'custom'; d.header.name = 'Alexandria Montgomery-Rivera';
      d.settings.margins = { top: margin, bottom: margin, left: margin, right: margin };
      Object.assign(d.settings.header, { photoSize: size, photoPos: pos, photoShape: shape, style });
      d.settings.pattern = { type: 'henna', area: 'page', color: '#c2185b', opacity: 0.3, scale: 1, corner: 'tr' };
      await page.setContent(buildHtml(T.normalizeDoc(d)), { waitUntil: 'load' }); n++;
      const r = await page.evaluate(() => {
        const svg = document.querySelector('.rz-halo-art'), sr = svg.getBoundingClientRect(), bb = svg.getBBox(), k = sr.width / 100;
        const vis = { l: sr.left + (bb.x + 50) * k, r: sr.left + (bb.x + bb.width + 50) * k, t: sr.top + (bb.y + 50) * k, b: sr.top + (bb.y + bb.height + 50) * k };
        const rects = [...document.querySelectorAll('.rz-name,.rz-jobtitle,.rz-contacts li,.rz-tagline')].flatMap((el) => { const g = document.createRange(); g.selectNodeContents(el); return [...g.getClientRects()]; });
        return {
          vis, pageW: document.querySelector('.pg').getBoundingClientRect().width, cols: document.querySelector('.rz-cols').getBoundingClientRect().top,
          hit: rects.some((x) => !(vis.r <= x.left + 0.5 || vis.l >= x.right - 0.5 || vis.b <= x.top + 0.5 || vis.t >= x.bottom - 0.5)),
        };
      });
      if (r.vis.l < -0.5 || r.vis.r > r.pageW + 0.5 || r.vis.t < -0.5 || r.hit || r.vis.b > r.cols + 0.5) bad.push(`m${margin} s${size} ${pos} ${shape} ${style}`);
    }
  } finally { await page.close(); }
  assert.equal(n, 108);
  assert.deepEqual(bad, []);
});
