// Admin-from-environment and OIDC (Authentik style) tests, using an in-process mock identity provider.
const fs = require('fs'), os = require('os'), http = require('http');
const test = require('node:test');
const assert = require('node:assert');
const jose = require('jose');

process.env.DATA_DIR = fs.mkdtempSync(os.tmpdir() + '/er-sso-');
process.env.ADMIN_EMAIL = 'root@example.com';
process.env.ADMIN_PASSWORD = 'adminpass1';
process.env.OIDC_CLIENT_ID = 'er-client';
process.env.OIDC_CLIENT_SECRET = 'sekret';
process.env.OIDC_ADMIN_GROUP = 'er-admins';

let idp, idpUrl, app, server, base, key, jwk;
const pending = {}; // code -> claims
const lastToken = {};

test.before(async () => {
  const pair = await jose.generateKeyPair('RS256');
  key = pair.privateKey; jwk = { ...(await jose.exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  idp = http.createServer(async (req, res) => {
    const json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
    if (req.url.startsWith('/.well-known/openid-configuration')) return json({ issuer: idpUrl + '/', authorization_endpoint: idpUrl + '/authorize', token_endpoint: idpUrl + '/token', jwks_uri: idpUrl + '/jwks', userinfo_endpoint: idpUrl + '/userinfo' });
    if (req.url === '/jwks') return json({ keys: [jwk] });
    if (req.url === '/userinfo') return json({ sub: lastToken.sub, email: lastToken.email, name: 'SSO Person', groups: lastToken.groups });
    if (req.url === '/token') {
      let body = ''; for await (const c of req) body += c;
      const p = new URLSearchParams(body), claims = pending[p.get('code')];
      if (!claims || p.get('client_secret') !== 'sekret' || !p.get('code_verifier')) { res.statusCode = 400; return json({ error: 'invalid_grant' }); }
      Object.assign(lastToken, claims);
      const idt = await new jose.SignJWT({ nonce: claims.nonce, email: claims.email, name: 'SSO Person' }).setProtectedHeader({ alg: 'RS256', kid: 'k1' })
        .setIssuer(idpUrl + '/').setAudience('er-client').setSubject(claims.sub).setIssuedAt().setExpirationTime('5m').sign(key);
      return json({ id_token: idt, access_token: 'at', token_type: 'Bearer' });
    }
    res.statusCode = 404; res.end();
  });
  await new Promise((r) => idp.listen(0, '127.0.0.1', r));
  idpUrl = 'http://127.0.0.1:' + idp.address().port;
  process.env.OIDC_ISSUER = idpUrl + '/application/o/er/';
  // discovery is fetched at <issuer>/.well-known/...: serve it from the same mock regardless of the path prefix
  const orig = idp.listeners('request')[0];
  idp.removeAllListeners('request');
  idp.on('request', (req, res) => { req.url = req.url.replace('/application/o/er', ''); orig(req, res); });
  app = require('../server/index.js');
  server = app.listen(0); base = 'http://127.0.0.1:' + server.address().port;
});
test.after(() => { server.close(); idp.close(); setTimeout(() => process.exit(0), 100); });

const H = { 'Content-Type': 'application/json', 'X-Requested-With': 'EnhanceResume' };
const call = (m, u, b, cookie) => fetch(base + u, { method: m, redirect: 'manual', headers: { ...H, ...(cookie ? { Cookie: cookie } : {}) }, body: b ? JSON.stringify(b) : undefined });
const cookieOf = (r) => (r.headers.get('set-cookie') || '').split(';')[0];

async function ssoLogin(claims) {
  const r = await call('GET', '/api/auth/oidc/login');
  assert.equal(r.status, 302);
  const loc = new URL(r.headers.get('location'));
  assert.equal(loc.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(loc.searchParams.get('client_id'), 'er-client');
  const state = loc.searchParams.get('state'), nonce = loc.searchParams.get('nonce');
  pending[claims.code] = { ...claims, nonce };
  return { state, cookie: cookieOf(r) };
}

test('environment admin account', async () => {
  const bad = await call('POST', '/api/auth/login', { email: 'root@example.com', password: 'wrong-pass' });
  assert.equal(bad.status, 401);
  const r = await call('POST', '/api/auth/login', { email: 'root@example.com', password: 'adminpass1' });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.user.isAdmin, true);
  let admin = cookieOf(r);
  assert.equal((await call('GET', '/api/admin/users', null, admin)).status, 200);

  const reg = await call('POST', '/api/auth/register', { email: 'plain@example.com', password: 'password123', name: 'Plain' });
  const plain = cookieOf(reg);
  assert.equal((await call('GET', '/api/admin/users', null, plain)).status, 403);
  assert.equal((await call('GET', '/api/admin/users')).status, 401);

  // env admin is protected; password changes in the environment are applied on startup
  const users = (await (await call('GET', '/api/admin/users', null, admin)).json()).users;
  const me = users.find((u) => u.email === 'root@example.com');
  assert.equal((await call('PATCH', '/api/admin/users/' + me.id, { disabled: true }, admin)).status, 400);
  assert.equal((await call('DELETE', '/api/admin/users/' + me.id, null, admin)).status, 400);
  process.env.ADMIN_PASSWORD = 'rotated-pass1';
  require('../server/admin').ensureEnvAdmin({ log() {}, error() {} });
  assert.equal((await call('POST', '/api/auth/login', { email: 'root@example.com', password: 'adminpass1' })).status, 401);
  assert.equal((await call('GET', '/api/admin/users', null, admin)).status, 401, 'old admin sessions are revoked on password rotation');
  const relog = await call('POST', '/api/auth/login', { email: 'root@example.com', password: 'rotated-pass1' });
  assert.equal(relog.status, 200);
  admin = cookieOf(relog);

  // admin manages users
  const plainRow = users.find((u) => u.email === 'plain@example.com');
  assert.equal((await call('PATCH', '/api/admin/users/' + plainRow.id, { disabled: true }, admin)).status, 200);
  assert.equal((await (await call('GET', '/api/auth/me', null, plain)).json()).user, null, 'disabled user loses session');
  assert.equal((await call('POST', '/api/auth/login', { email: 'plain@example.com', password: 'password123' })).status, 403);
  assert.equal((await call('POST', '/api/admin/users', { email: 'made@example.com', password: 'password123', isAdmin: false }, admin)).status, 200);
  assert.equal((await call('DELETE', '/api/admin/users/' + plainRow.id, null, admin)).status, 200);
});

test('OIDC sign-in via authorization code + PKCE', async () => {
  const me = await (await call('GET', '/api/auth/me')).json();
  assert.ok(me.oidc && me.oidc.label);

  const { state, cookie } = await ssoLogin({ code: 'c1', sub: 'sub-1', email: 'sso@example.com', groups: ['er-admins'] });
  const cb = await call('GET', `/api/auth/oidc/callback?code=c1&state=${state}`, null, cookie);
  assert.equal(cb.status, 302);
  assert.equal(cb.headers.get('location'), '/#/');
  const session = cookieOf(cb);
  const who = await (await call('GET', '/api/auth/me', null, session)).json();
  assert.equal(who.user.email, 'sso@example.com');
  assert.equal(who.user.isAdmin, true, 'admin group claim grants admin');

  // second login with the same sub reuses the account; losing the group removes admin
  const second = await ssoLogin({ code: 'c2', sub: 'sub-1', email: 'sso@example.com', groups: [] });
  const cb2 = await call('GET', `/api/auth/oidc/callback?code=c2&state=${second.state}`, null, second.cookie);
  const who2 = await (await call('GET', '/api/auth/me', null, cookieOf(cb2))).json();
  assert.equal(who2.user.isAdmin, false);

  // an existing local account with the same email is linked, not duplicated
  const link = await ssoLogin({ code: 'c3', sub: 'sub-2', email: 'made@example.com', groups: [] });
  const cb3 = await call('GET', `/api/auth/oidc/callback?code=c3&state=${link.state}`, null, link.cookie);
  assert.equal((await (await call('GET', '/api/auth/me', null, cookieOf(cb3))).json()).user.email, 'made@example.com');
});

test('OIDC rejects tampering', async () => {
  const a = await ssoLogin({ code: 'c4', sub: 'sub-3', email: 'x@example.com', groups: [] });
  const wrongState = await call('GET', '/api/auth/oidc/callback?code=c4&state=nope', null, a.cookie);
  assert.match(wrongState.headers.get('location'), /sso_error/);
  const noCookie = await call('GET', `/api/auth/oidc/callback?code=c4&state=${a.state}`);
  assert.match(noCookie.headers.get('location'), /sso_error/);
  const b = await ssoLogin({ code: 'c5', sub: 'sub-4', email: 'y@example.com', groups: [] });
  pending.c5.nonce = 'attacker-nonce'; // ID token with a different nonce
  const badNonce = await call('GET', `/api/auth/oidc/callback?code=c5&state=${b.state}`, null, b.cookie);
  assert.match(badNonce.headers.get('location'), /sso_error/);
  assert.equal(cookieOf(badNonce).startsWith('er_session'), false);
});
