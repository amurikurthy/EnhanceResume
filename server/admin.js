const express = require('express');
const { db } = require('./db');
const A = require('./auth');
const { cfg } = require('./config');

/* Make the account defined by ADMIN_EMAIL / ADMIN_PASSWORD an administrator (created if missing).
 * The environment is the source of truth: the password is re-applied on every start. */
function ensureEnvAdmin(log = console) {
  const c = cfg();
  if (!c.adminEmail) return;
  const pw = c.adminPassword;
  if (pw && pw.length < 8) { log.error('ADMIN_PASSWORD must be at least 8 characters; admin account not configured'); return; }
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(c.adminEmail);
  if (!u) {
    db.prepare('INSERT INTO users (email, name, pass_hash, created_at, is_admin) VALUES (?,?,?,?,1)')
      .run(c.adminEmail, c.adminName, pw ? A.hashPassword(pw) : '!', Date.now());
    log.log(`Admin account created: ${c.adminEmail}${pw ? '' : ' (no password set: sign in with SSO)'}`);
    return;
  }
  db.prepare('UPDATE users SET is_admin = 1, disabled = 0 WHERE id = ?').run(u.id);
  if (pw && !A.verifyPassword(pw, u.pass_hash)) {
    db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(A.hashPassword(pw), u.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
    log.log(`Admin password updated from environment for ${c.adminEmail}`);
  }
}

const router = express.Router();
router.use(A.requireAuth, A.requireAdmin);

const row = (u, envEmail) => ({
  id: u.id, email: u.email, name: u.name, isAdmin: !!u.is_admin, disabled: !!u.disabled, sso: !!u.oidc_sub,
  resumes: u.resumes, createdAt: u.created_at, lastLogin: u.last_login, locked: u.email.toLowerCase() === envEmail,
});
const list = () => db.prepare(`SELECT u.*, (SELECT COUNT(*) FROM resumes r WHERE r.user_id = u.id) AS resumes FROM users u ORDER BY u.created_at DESC`).all();

router.get('/users', (req, res) => {
  const c = cfg();
  res.json({
    users: list().map((u) => row(u, c.adminEmail)),
    config: { registration: c.allowRegistration, sso: !!c.oidc, ssoAdminGroup: c.oidc ? c.oidc.adminGroup : '', passwordLoginDisabled: c.passwordLoginDisabled, envAdmin: c.adminEmail },
  });
});

router.post('/users', (req, res) => {
  const { email, name, password, isAdmin } = req.body || {};
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return res.status(400).json({ error: 'Enter a valid email' });
  if (typeof password !== 'string' || password.length < 8 || password.length > 200) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'Email already in use' });
  const nm = String(name || '').trim().slice(0, 100) || email.split('@')[0];
  db.prepare('INSERT INTO users (email, name, pass_hash, created_at, is_admin) VALUES (?,?,?,?,?)').run(email.trim(), nm, A.hashPassword(password), Date.now(), isAdmin ? 1 : 0);
  res.json({ ok: true });
});

function target(req, res) {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!u) { res.status(404).json({ error: 'User not found' }); return null; }
  return u;
}
const isLocked = (u) => u.email.toLowerCase() === cfg().adminEmail;

router.patch('/users/:id', (req, res) => {
  const u = target(req, res); if (!u) return;
  const { disabled, isAdmin } = req.body || {};
  if (isLocked(u) || u.id === req.user.id) {
    if (disabled === true || isAdmin === false) return res.status(400).json({ error: 'This account cannot be disabled or demoted (environment admin / yourself)' });
  }
  if (typeof disabled === 'boolean') {
    db.prepare('UPDATE users SET disabled = ? WHERE id = ?').run(disabled ? 1 : 0, u.id);
    if (disabled) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  }
  if (typeof isAdmin === 'boolean') db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(isAdmin ? 1 : 0, u.id);
  res.json({ ok: true });
});

router.post('/users/:id/password', (req, res) => {
  const u = target(req, res); if (!u) return;
  if (isLocked(u)) return res.status(400).json({ error: 'The environment admin password is set with ADMIN_PASSWORD' });
  const { password } = req.body || {};
  if (typeof password !== 'string' || password.length < 8 || password.length > 200) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(A.hashPassword(password), u.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  res.json({ ok: true });
});

router.delete('/users/:id', (req, res) => {
  const u = target(req, res); if (!u) return;
  if (isLocked(u) || u.id === req.user.id) return res.status(400).json({ error: 'This account cannot be deleted' });
  db.prepare('DELETE FROM users WHERE id = ?').run(u.id); // resumes + sessions cascade
  res.json({ ok: true });
});

module.exports = { router, ensureEnvAdmin };
