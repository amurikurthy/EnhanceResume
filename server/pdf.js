const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const T = require('../shared/templates');
const R = require('../shared/render');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'shared', 'resume.css'), 'utf8');
const FONT_DIR = path.join(__dirname, '..', 'public', 'fonts');
let manifest = {};
try { manifest = JSON.parse(fs.readFileSync(path.join(FONT_DIR, 'fonts.json'), 'utf8')); } catch { /* run npm run build:assets */ }
const fontCache = new Map();

function fontFaces(names) {
  let css = '';
  for (const name of new Set(names)) {
    for (const f of manifest[name] || []) {
      if (!fontCache.has(f.file)) fontCache.set(f.file, fs.readFileSync(path.join(FONT_DIR, f.file)).toString('base64'));
      css += `@font-face{font-family:'${name}';font-style:${f.style};font-weight:${f.weight};src:url(data:font/woff2;base64,${fontCache.get(f.file)}) format('woff2');}\n`;
    }
  }
  return css;
}

/* icon libraries are large, so each is read only when a resume actually uses it */
const libLoaded = {};
function ensureIconLibs(doc) {
  const j = JSON.stringify(doc);
  const need = { brands: /"icon":"brand:/.test(j), lucide: [...j.matchAll(/"icon":"([a-z0-9-]+)"/g)].some((m) => !R.ICONS[m[1]]) };
  for (const kind of Object.keys(need)) {
    if (!need[kind] || libLoaded[kind]) continue;
    try { R.setIconLib(kind, JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'icons', kind + '.json'), 'utf8'))); libLoaded[kind] = true; } catch { /* run npm run build:assets */ }
  }
}

function buildHtml(doc) {
  ensureIconLibs(doc);
  const s = doc.settings, m = s.margins;
  const [pw, ph] = T.PAGE_MM[s.pageSize] || T.PAGE_MM.A4;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${R.esc(doc.header.name || 'Resume')}</title><style>
${fontFaces([s.fontHeading, s.fontBody])}
@page { size: ${pw}mm ${ph}mm; margin: 0; }
html { background: ${s.colors.bg}; }
html, body { margin: 0; padding: 0; }
.rz-bg { position: fixed; left: 0; top: 0; width: ${pw}mm; height: ${ph}mm; z-index: -1; }
.pg { width: ${pw}mm; border-collapse: collapse; border-spacing: 0; table-layout: fixed; }
.pg td { padding: 0 ${m.right}mm 0 ${m.left}mm; vertical-align: top; }
.pg thead td { height: ${m.top}mm; padding-top: 0; padding-bottom: 0; }
.pg tfoot td { height: ${m.bottom}mm; padding-top: 0; padding-bottom: 0; }
${CSS}
</style></head><body><div class="rz-bg" style="${R.esc(R.pageBg(doc))}"></div>
<table class="pg"><thead><tr><td></td></tr></thead><tfoot><tr><td></td></tr></tfoot><tbody><tr><td>${R.render(doc)}</td></tr></tbody></table></body></html>`;
}

/* ---- chromium management ---- */
function findChrome() {
  const cands = [process.env.CHROME_PATH, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome'];
  try {
    for (const d of fs.readdirSync('/opt/pw-browsers')) if (d.startsWith('chromium-')) cands.push(`/opt/pw-browsers/${d}/chrome-linux/chrome`);
  } catch { /* none */ }
  const hit = cands.find((p) => p && fs.existsSync(p));
  if (!hit) throw new Error('Chromium not found. Set CHROME_PATH.');
  return hit;
}

let browserP = null;
function getBrowser() {
  if (!browserP) {
    browserP = puppeteer.launch({
      executablePath: findChrome(), headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none'],
    }).then((b) => { b.on('disconnected', () => { browserP = null; }); return b; }).catch((e) => { browserP = null; throw e; });
  }
  return browserP;
}

let active = 0;
const waiters = [];
const MAX_CONCURRENT = Number(process.env.PDF_CONCURRENCY || 3);
async function slot() {
  if (active >= MAX_CONCURRENT) await new Promise((r) => waiters.push(r));
  active++;
}
function release() { active--; const w = waiters.shift(); if (w) w(); }

async function renderPdf(doc) {
  await slot();
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setRequestInterception(true); // resume content is self-contained; block every outbound request
    page.on('request', (req) => (/^(data:|about:)/.test(req.url()) ? req.continue() : req.abort()));
    await page.setContent(buildHtml(doc), { waitUntil: 'load', timeout: 20000 });
    await page.evaluate(() => document.fonts.ready);
    const buf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    return Buffer.from(buf);
  } finally {
    if (page) await page.close().catch(() => {});
    release();
  }
}

process.on('exit', () => { if (browserP) browserP.then((b) => b.close()).catch(() => {}); });

module.exports = { renderPdf, buildHtml, getBrowser };
