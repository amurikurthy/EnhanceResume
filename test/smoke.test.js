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

test('revision history: named versions, auto restore points, restore, tenant isolation', async () => {
  const a = await signup('rev-a@example.com'), b = await signup('rev-b@example.com');
  const r = await (await call('POST', '/api/resumes', { title: 'R', blank: true }, a)).json();
  const edit = async (name) => { const cur = await (await call('GET', '/api/resumes/' + r.id, null, a)).json(); cur.data.header.name = name; assert.equal((await call('PUT', '/api/resumes/' + r.id, { data: cur.data }, a)).status, 200); };
  await edit('First');
  const v1 = await (await call('POST', `/api/resumes/${r.id}/revisions`, { label: 'Before layout change' }, a)).json();
  assert.equal(v1.label, 'Before layout change'); assert.equal(v1.auto, false);
  await edit('Second');
  const list = await (await call('GET', `/api/resumes/${r.id}/revisions`, null, a)).json();
  assert.ok(list.some((x) => x.id === v1.id));
  assert.equal((await call('GET', `/api/resumes/${r.id}/revisions`, null, b)).status, 404, 'other tenant cannot list');
  assert.equal((await call('GET', `/api/resumes/${r.id}/revisions/${v1.id}`, null, b)).status, 404);
  assert.equal((await call('POST', `/api/resumes/${r.id}/revisions/${v1.id}/restore`, null, b)).status, 404);
  assert.equal((await call('DELETE', `/api/resumes/${r.id}/revisions/${v1.id}`, null, b)).status, 404);
  const got = await (await call('GET', `/api/resumes/${r.id}/revisions/${v1.id}`, null, a)).json();
  assert.equal(got.data.header.name, 'First');
  const restored = await (await call('POST', `/api/resumes/${r.id}/revisions/${v1.id}/restore`, null, a)).json();
  assert.equal(restored.data.header.name, 'First');
  const now = await (await call('GET', '/api/resumes/' + r.id, null, a)).json();
  assert.equal(now.data.header.name, 'First');
  const after = await (await call('GET', `/api/resumes/${r.id}/revisions`, null, a)).json();
  assert.ok(after.some((x) => x.auto && /Before restoring/.test(x.label)), 'restore keeps a restore point of the replaced state');
  assert.equal((await call('PATCH', `/api/resumes/${r.id}/revisions/${v1.id}`, { label: 'Renamed' }, a)).status, 200);
  assert.equal((await call('DELETE', `/api/resumes/${r.id}/revisions/${v1.id}`, null, a)).status, 200);
});

test('icon names: library and brand icons are accepted, junk is dropped', () => {
  const T = require('../shared/templates');
  const d = T.normalizeDoc({ sections: [{ type: 'custom', icon: 'brand:cisco', items: [{ icon: 'router', title: 'x' }, { icon: '"><script>', title: 'y' }, { icon: 'Brand:UPPER', title: 'z' }] }] });
  assert.equal(d.sections[0].icon, 'brand:cisco');
  assert.deepEqual(d.sections[0].items.map((i) => i.icon), ['router', '', '']);
});

test('profile: details and photo flow into new resumes, validation, no password endpoint', async () => {
  const a = await signup('prof-a@example.com'), b = await signup('prof-b@example.com');
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  assert.equal((await call('PUT', '/api/profile', { photo: 'javascript:alert(1)' }, a)).status, 400);
  const up = await (await call('PUT', '/api/profile', { name: 'Pat Doe', photo: png, profile: { headline: 'Network Engineer', phone: '555-1', linkedin: 'linkedin.com/in/pat', location: 'Chicago, IL' } }, a)).json();
  assert.equal(up.user.name, 'Pat Doe'); assert.equal(up.user.photo, png);
  assert.equal((await (await call('GET', '/api/profile', null, b)).json()).user.photo, '', 'profiles are per account');
  const r = await (await call('POST', '/api/resumes', { title: 'X', blank: true }, a)).json();
  assert.equal(r.data.header.name, 'Pat Doe'); assert.equal(r.data.header.title, 'Network Engineer'); assert.equal(r.data.header.photoMode, 'profile');
  assert.equal(r.data.header.photo, '', 'the photo stays linked, it is not copied into the resume');
  assert.ok(r.data.header.contacts.some((c) => c.icon === 'phone' && c.text === '555-1'));
  assert.ok(r.data.header.contacts.some((c) => c.icon === 'mail' && c.text === 'prof-a@example.com'));
  assert.equal((await call('GET', `/api/resumes/${r.id}/pdf`, null, a)).status, 200);
  assert.equal((await call('POST', '/api/profile/password', { current: 'password123', password: 'brand-new-pass1' }, a)).status, 404, 'passwords cannot be changed from the profile');
});
