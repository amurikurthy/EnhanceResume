/* OpenID Connect (Authentik or any OIDC provider): authorization code flow with PKCE. */
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jose = require('jose');
const { db, DATA_DIR } = require('./db');
const A = require('./auth');
const { cfg } = require('./config');

const COOKIE = 'er_oidc';
const b64 = (b) => Buffer.from(b).toString('base64url');

function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const f = path.join(DATA_DIR, 'session.key');
  try { return fs.readFileSync(f, 'utf8'); } catch { /* first run */ }
  const k = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(f, k, { mode: 0o600 });
  return k;
}
const sign = (obj) => { const p = b64(JSON.stringify(obj)); return p + '.' + crypto.createHmac('sha256', secret()).update(p).digest('base64url'); };
function unsign(v) {
  const [p, sig] = String(v || '').split('.');
  if (!p || !sig) return null;
  const good = crypto.createHmac('sha256', secret()).update(p).digest('base64url');
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try { return JSON.parse(Buffer.from(p, 'base64url').toString()); } catch { return null; }
}

let disc = null, jwks = null, discFor = '';
async function discovery() {
  const c = cfg().oidc;
  if (disc && discFor === c.issuer) return disc;
  const r = await fetch(c.issuer.replace(/\/+$/, '') + '/.well-known/openid-configuration', { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error('OIDC discovery failed (' + r.status + ')');
  const d = await r.json();
  if (!d.authorization_endpoint || !d.token_endpoint || !d.issuer) throw new Error('Incomplete OIDC discovery document');
  disc = d; discFor = c.issuer;
  jwks = d.jwks_uri ? jose.createRemoteJWKSet(new URL(d.jwks_uri)) : null;
  return d;
}

const redirectUri = (req) => cfg().oidc.redirectUri || `${req.protocol}://${req.get('host')}/api/auth/oidc/callback`;
const fail = (res, msg) => res.redirect('/?sso_error=' + encodeURIComponent(msg) + '#/login');

const router = express.Router();

router.get('/login', async (req, res) => {
  const c = cfg().oidc;
  if (!c) return fail(res, 'SSO is not configured');
  try {
    const d = await discovery();
    const state = crypto.randomBytes(16).toString('base64url'), nonce = crypto.randomBytes(16).toString('base64url');
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const ru = redirectUri(req);
    const url = new URL(d.authorization_endpoint);
    url.search = new URLSearchParams({ response_type: 'code', client_id: c.clientId, redirect_uri: ru, scope: c.scopes, state, nonce, code_challenge: challenge, code_challenge_method: 'S256' }).toString();
    const secure = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.COOKIE_SECURE === 'true';
    res.setHeader('Set-Cookie', `${COOKIE}=${sign({ state, nonce, verifier, ru, exp: Date.now() + 600000 })}; Path=/api/auth/oidc; HttpOnly; SameSite=Lax; Max-Age=600${secure ? '; Secure' : ''}`);
    res.redirect(url.toString());
  } catch (e) { console.error('OIDC login failed:', e.message); fail(res, 'Could not reach the SSO provider'); }
});

async function exchange(req, pending, code) {
  const c = cfg().oidc, d = await discovery();
  const r = await fetch(d.token_endpoint, {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: pending.ru, client_id: c.clientId, client_secret: c.clientSecret, code_verifier: pending.verifier }),
  });
  const tok = await r.json().catch(() => ({}));
  if (!r.ok || !tok.id_token) throw new Error('Token exchange failed: ' + (tok.error || r.status));
  const alg = jose.decodeProtectedHeader(tok.id_token).alg || '';
  // providers without a signing key (Authentik default) sign with the client secret (HS256)
  const key = alg.startsWith('HS') ? new TextEncoder().encode(c.clientSecret) : jwks;
  if (!key) throw new Error('No key to verify the ID token');
  const { payload } = await jose.jwtVerify(tok.id_token, key, { issuer: d.issuer, audience: c.clientId, algorithms: [alg] });
  if (payload.nonce !== pending.nonce) throw new Error('Nonce mismatch');
  let claims = { ...payload };
  if (tok.access_token && d.userinfo_endpoint) {
    try {
      const ui = await fetch(d.userinfo_endpoint, { headers: { Authorization: 'Bearer ' + tok.access_token }, signal: AbortSignal.timeout(10000) });
      if (ui.ok) { const u = await ui.json(); if (u.sub === payload.sub) claims = { ...claims, ...u }; }
    } catch { /* ID token claims are enough */ }
  }
  return claims;
}

function resolveUser(claims) {
  const c = cfg(), o = c.oidc;
  const sub = String(claims.sub);
  const email = String(claims.email || '').trim().toLowerCase();
  const name = String(claims.name || claims.preferred_username || email.split('@')[0] || 'User').slice(0, 100);
  let u = db.prepare('SELECT * FROM users WHERE oidc_sub = ?').get(sub);
  if (!u && email && (o.trustEmail || claims.email_verified === true)) {
    u = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (u) db.prepare('UPDATE users SET oidc_sub = ? WHERE id = ?').run(sub, u.id);
  }
  if (!u) {
    if (!o.autoCreate) throw new Error('No account exists for this SSO user');
    if (!email) throw new Error('Your SSO profile has no email address');
    const info = db.prepare('INSERT INTO users (email, name, pass_hash, created_at, oidc_sub) VALUES (?,?,?,?,?)').run(email, name, '!', Date.now(), sub);
    u = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(info.lastInsertRowid));
  }
  if (u.disabled) throw new Error('This account is disabled');
  // group-based admin: only when OIDC_ADMIN_GROUP is set; the ADMIN_EMAIL account is always admin
  if (o.adminGroup) {
    const groups = Array.isArray(claims.groups) ? claims.groups : [];
    const admin = groups.includes(o.adminGroup) || u.email.toLowerCase() === c.adminEmail ? 1 : 0;
    if (admin !== u.is_admin) db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(admin, u.id);
  }
  db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(Date.now(), u.id);
  return u;
}

router.get('/callback', async (req, res) => {
  if (!cfg().oidc) return fail(res, 'SSO is not configured');
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/api/auth/oidc; HttpOnly; SameSite=Lax; Max-Age=0`);
  if (req.query.error) return fail(res, 'SSO provider returned: ' + String(req.query.error).slice(0, 100));
  const cookies = Object.fromEntries(String(req.headers.cookie || '').split(';').map((p) => p.trim().split('=')).filter((x) => x[0]));
  const pending = unsign(cookies[COOKIE]);
  if (!pending || pending.exp < Date.now() || pending.state !== req.query.state || typeof req.query.code !== 'string') return fail(res, 'Sign-in expired, please try again');
  try {
    const claims = await exchange(req, pending, req.query.code);
    const u = resolveUser(claims);
    A.startSession(req, res, u.id);
    // startSession overwrote Set-Cookie; the pending-login cookie expires on its own within 10 minutes
    res.redirect('/#/');
  } catch (e) { console.error('OIDC callback failed:', e.message); fail(res, e.message.startsWith('No account') || e.message.startsWith('This account') || e.message.startsWith('Your SSO') ? e.message : 'SSO sign-in failed'); }
});

module.exports = { router };
