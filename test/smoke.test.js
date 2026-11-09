// Run: npm test   (needs Chromium: set CHROME_PATH if not auto-detected)
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/er-test-');
const test = require('node:test');
const assert = require('node:assert');
const app = require('../server/index.js');

let base, server;
test.before(async () => { server = app.listen(0); base = 'http://127.0.0.1:' + server.address().port; });
test.after(() => { server.close(); setTimeout(() => process.exit(0), 100); });

async function call(method, url, body, cookie) {
  const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'EnhanceResume', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return res;
}
async function signup(email) {
  const r = await call('POST', '/api/auth/register', { email, password: 'password123', name: 'U' });
  assert.equal(r.status, 200);
  return r.headers.get('set-cookie').split(';')[0];
}

test('tenant isolation, CSRF header and PDF export', async () => {
  const a = await signup('a@example.com'), b = await signup('b@example.com');
  const created = await (await call('POST', '/api/resumes', { title: 'A resume', template: 'modern' }, a)).json();
  assert.ok(created.id);
  assert.equal((await call('GET', '/api/resumes/' + created.id, null, b)).status, 404, 'other tenant must not read');
  assert.equal((await call('PUT', '/api/resumes/' + created.id, { title: 'x' }, b)).status, 404);
  assert.equal((await call('DELETE', '/api/resumes/' + created.id, null, b)).status, 404);
  assert.equal((await call('GET', '/api/resumes', null, undefined)).status, 401);
  const noHeader = await fetch(base + '/api/resumes', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a }, body: '{}' });
  assert.equal(noHeader.status, 403);
  const list = await (await call('GET', '/api/resumes', null, b)).json();
  assert.equal(list.length, 0);
  const pdf = await call('GET', `/api/resumes/${created.id}/pdf`, null, a);
  assert.equal(pdf.status, 200);
  const buf = Buffer.from(await pdf.arrayBuffer());
  assert.equal(buf.subarray(0, 5).toString(), '%PDF-');
});

test('sanitises hostile content', async () => {
  const T = require('../shared/templates');
  const R = require('../shared/render');
  const doc = T.normalizeDoc({ settings: { colors: { accent: 'red;}</style><script>' }, fontBody: 'evil' }, header: { name: '<img src=x onerror=1>', photo: 'javascript:alert(1)' },
    sections: [{ type: 'experience', title: '<b>', items: [{ title: '[x](javascript:alert(1))', orgLink: 'javascript:alert(1)', bullets: ['<script>'] }] }] });
  const html = R.render(doc);
  assert.ok(!/<script|<img src=x|javascript:/i.test(html));
  assert.equal(doc.settings.fontBody, 'Inter');
});
