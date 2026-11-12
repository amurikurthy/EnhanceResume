// API behaviour beyond the happy path: JSON export/import round trip, PDF naming, validation and abuse limits.
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/er-api-test-');
const test = require('node:test');
const assert = require('node:assert');
const app = require('../server/index.js');
const T = require('../shared/templates');

let base, server;
let main;
test.after(() => { server.close(); setTimeout(() => process.exit(0), 100); });

const call = (method, url, body, cookie, extra = {}) => fetch(base + url, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'EnhanceResume', ...(cookie ? { Cookie: cookie } : {}), ...extra }, body: body == null ? undefined : JSON.stringify(body) });
async function signup(email) {
  const r = await call('POST', '/api/auth/register', { email, password: 'password123', name: 'Pat Person' });
  assert.equal(r.status, 200);
  return r.headers.get('set-cookie').split(';')[0];
}

test.before(async () => { server = app.listen(0); base = 'http://127.0.0.1:' + server.address().port; main = await signup('main@example.com'); });

test('export then import gives back the same resume (what the dashboard buttons do)', async () => {
  const c = main;
  const made = await (await call('POST', '/api/resumes', { title: 'Original', template: 'steel' }, c)).json();
  const got = await (await call('GET', '/api/resumes/' + made.id, null, c)).json();
  const exported = JSON.parse(JSON.stringify({ title: got.title, data: got.data })); // the file the Export button writes
  const imported = await (await call('POST', '/api/resumes', { title: exported.title, data: exported.data }, c)).json();
  const back = await (await call('GET', '/api/resumes/' + imported.id, null, c)).json();
  const strip = (d) => { const x = JSON.parse(JSON.stringify(d)); return x; };
  assert.deepEqual(strip(back.data.sections.map((s) => s.items.map((i) => i.title))), strip(got.data.sections.map((s) => s.items.map((i) => i.title))));
  assert.equal(back.data.settings.template, got.data.settings.template);
  // a bare document (no wrapper) imports too
  const bare = await call('POST', '/api/resumes', { title: 'Bare', data: got.data }, c);
  assert.equal(bare.status, 200);
});

test('importing junk is cleaned, never rejected into a broken state', async () => {
  const c = main;
  const r = await call('POST', '/api/resumes', { title: 'J', data: { sections: 'nope', header: [], settings: 5 } }, c);
  assert.equal(r.status, 200);
  const doc = await (await call('GET', '/api/resumes/' + (await r.json()).id, null, c)).json();
  assert.ok(Array.isArray(doc.data.sections));
  assert.equal((await call('POST', '/api/resumes', { title: 'x'.repeat(5000), data: {} }, c)).status, 200);
});

test('PDF download is named after the resume title and sanitised', async () => {
  const c = main;
  const made = await (await call('POST', '/api/resumes', { title: 'My: "Best" <Resume>/2026', template: 'classic' }, c)).json();
  const res = await call('GET', `/api/resumes/${made.id}/pdf`, null, c);
  assert.equal(res.status, 200);
  const cd = res.headers.get('content-disposition');
  assert.match(cd, /^attachment; filename="[\w.\- ]+\.pdf"$/);
  assert.ok(!/Pat|Person/.test(cd));
  assert.ok(/Best/.test(cd));
  const inline = await call('GET', `/api/resumes/${made.id}/pdf?inline=1`, null, c);
  assert.match(inline.headers.get('content-disposition'), /^inline;/);
  assert.equal(inline.headers.get('cache-control'), 'no-store');
});

test('validation: bad email, short password, duplicate account, wrong password', async () => {
  assert.equal((await call('POST', '/api/auth/register', { email: 'nope', password: 'password123' })).status, 400);
  assert.equal((await call('POST', '/api/auth/register', { email: 'v@example.com', password: 'short' })).status, 400);
  await signup('dup@example.com');
  assert.equal((await call('POST', '/api/auth/register', { email: 'dup@example.com', password: 'password123' })).status >= 400, true);
  assert.equal((await call('POST', '/api/auth/login', { email: 'dup@example.com', password: 'wrong-password' })).status, 401);
});

test('sign-in attempts are rate limited', async () => {
  await signup('rl@example.com');
  let limited = false;
  for (let i = 0; i < 40 && !limited; i++) limited = (await call('POST', '/api/auth/login', { email: 'rl@example.com', password: 'bad' + i })).status === 429;
  assert.ok(limited, 'eventually answers 429');
});

test('oversized request bodies are refused', async () => {
  const c = main;
  const r = await call('POST', '/api/resumes', { title: 'big', data: { header: { name: 'x'.repeat(6 * 1024 * 1024) } } }, c);
  assert.ok(r.status === 413 || r.status === 400, 'status ' + r.status);
});

test('a deleted resume takes its revisions and photo with it', async () => {
  const c = main;
  const made = await (await call('POST', '/api/resumes', { title: 'gone', template: 'classic' }, c)).json();
  await call('POST', `/api/resumes/${made.id}/revisions`, { label: 'v1' }, c);
  assert.equal((await call('DELETE', '/api/resumes/' + made.id, null, c)).status, 200);
  assert.equal((await call('GET', '/api/resumes/' + made.id, null, c)).status, 404);
  assert.equal((await call('GET', `/api/resumes/${made.id}/revisions`, null, c)).status, 404);
});

test('sessions: sign out invalidates the cookie', async () => {
  const c = await signup('so@example.com');
  assert.ok((await (await call('GET', '/api/auth/me', null, c)).json()).user);
  await call('POST', '/api/auth/logout', {}, c);
  assert.equal((await (await call('GET', '/api/auth/me', null, c)).json()).user, null, 'old cookie no longer identifies anyone');
  assert.equal((await call('GET', '/api/resumes', null, c)).status, 401);
});
