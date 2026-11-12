// Document model: sanitising garbage, idempotence, rendering in both modes, and the template mixing rules.
const test = require('node:test');
const assert = require('node:assert');
const T = require('../shared/templates');
const R = require('../shared/render');

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function junk(r, depth = 0) {
  const pick = Math.floor(r() * 12);
  if (pick === 0) return null; if (pick === 1) return undefined; if (pick === 2) return Math.floor(r() * 1e6) - 5e5;
  if (pick === 3) return NaN; if (pick === 4) return r() < 0.5; if (pick === 5) return '<script>alert(1)</script>'.repeat(1 + Math.floor(r() * 3));
  if (pick === 6) return 'x'.repeat(Math.floor(r() * 5000)); if (pick === 7) return '';
  if (pick === 8 && depth < 3) return Array.from({ length: Math.floor(r() * 4) }, () => junk(r, depth + 1));
  if (depth < 3) return Object.fromEntries(['title', 'text', 'bullets', 'tags', 'items', 'icon', 'level', 'name', 'date', 'column', 'type', 'colors', 'settings'].filter(() => r() < 0.4).map((k) => [k, junk(r, depth + 1)]));
  return 'z';
}

test('normalizeDoc survives arbitrary garbage and the result always renders safely', () => {
  const r = rng(12345);
  for (let i = 0; i < 300; i++) {
    const raw = i % 3 === 0 ? junk(r) : { settings: junk(r), header: junk(r), sections: junk(r), title: junk(r) };
    const doc = T.normalizeDoc(raw);
    assert.ok(Array.isArray(doc.sections) && doc.header && doc.settings, 'shape');
    for (const edit of [false, true]) {
      const html = R.render(doc, { edit });
      assert.ok(!/<script/i.test(html), 'no script tag (case ' + i + ')');
      assert.ok(!/NaN|undefined|\[object/.test(html.replace(/data-ph="[^"]*"/g, '')), 'no NaN/undefined leaking (case ' + i + ')');
    }
  }
});

test('normalizeDoc is idempotent for every sample', () => {
  for (const t of T.TEMPLATES) {
    const once = T.normalizeDoc(T.sampleDoc(t.id));
    assert.deepEqual(T.normalizeDoc(JSON.parse(JSON.stringify(once))), once, t.id);
  }
});

test('every template renders in both modes with no stray values', () => {
  for (const t of T.TEMPLATES) {
    const d = T.normalizeDoc(T.sampleDoc(t.id));
    for (const edit of [false, true]) {
      const html = R.render(d, { edit });
      assert.ok(html.length > 500, t.id);
      assert.ok(!/NaN|undefined|\[object/.test(html.replace(/data-ph="[^"]*"/g, '')), `${t.id} edit=${edit}`);
    }
  }
});

test('template parts: layout keeps your colors, colors keep your layout, content is never touched', () => {
  const base = T.normalizeDoc(T.sampleDoc('classic'));
  const text = (d) => JSON.stringify(d.sections.map((s) => s.items.map((i) => [i.title, i.text, i.bullets, i.tags])).concat(d.header.name));
  for (const t of T.TEMPLATES) {
    const lay = T.applyTemplateParts(base, t.id, 'layout');
    assert.deepEqual(lay.settings.colors, base.settings.colors, `${t.id} layout leaves colors`);
    assert.equal(lay.settings.template, t.id);
    assert.equal(text(lay), text(base), `${t.id} layout leaves content`);
    const col = T.applyTemplateParts(base, t.id, 'colors');
    assert.equal(col.settings.layout, base.settings.layout, `${t.id} colors leave layout`);
    assert.equal(col.settings.fontBody, base.settings.fontBody);
    assert.equal(text(col), text(base), `${t.id} colors leave content`);
  }
});

test('mixTemplates: layout from one, colors from another, either may be empty', () => {
  const base = T.normalizeDoc(T.sampleDoc('classic'));
  const a = 'modern', b = 'midnight';
  const mix = T.mixTemplates(base, a, b);
  const layoutOnly = T.applyTemplateParts(base, a, 'layout');
  assert.equal(mix.settings.layout, layoutOnly.settings.layout);
  assert.equal(mix.settings.colors.bg, T.applyTemplateParts(base, b, 'colors').settings.colors.bg);
  assert.deepEqual(T.mixTemplates(base, '', ''), base);
  assert.deepEqual(T.mixTemplates(base, a, '').settings.colors, base.settings.colors);
  // the same template for both is the template itself
  const same = T.mixTemplates(base, 'steel', 'steel'), full = T.applyTemplate(base, 'steel');
  assert.equal(same.settings.layout, full.settings.layout);
});

test('size limits: oversized photos and logos are dropped, not stored', () => {
  const big = 'data:image/png;base64,' + 'A'.repeat(700000);
  const d = T.normalizeDoc({ header: { photo: big }, sections: [{ type: 'experience', items: [{ logo: big }] }] });
  assert.equal(d.header.photo, '');
  assert.equal(d.sections[0].items[0].logo, '');
});
