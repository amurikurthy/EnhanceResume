const express = require('express');
const compression = require('compression');
const crypto = require('crypto');
const path = require('path');
const { db } = require('./db');
const A = require('./auth');
const T = require('../shared/templates');
const { renderPdf } = require('./pdf');
const { cfg } = require('./config');
const admin = require('./admin');
const sso = require('./sso');

const app = express();
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? true : process.env.TRUST_PROXY);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.use(compression());
app.use(express.json({ limit: '4mb' }));
app.use('/api', A.csrfGuard);

const ROOT = path.join(__dirname, '..');
const MAX_RESUMES = Number(process.env.MAX_RESUMES_PER_USER || 50);

/* ---------- auth ---------- */
const emailOk = (e) => typeof e === 'string' && e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

app.post('/api/auth/register', (req, res) => {
  const c = cfg();
  if (!c.allowRegistration || c.passwordLoginDisabled) return res.status(403).json({ error: 'Registration is disabled' });
  if (!A.rateLimit('reg:' + req.ip, 10, 3600e3)) return res.status(429).json({ error: 'Too many attempts, try later' });
  const { email, password, name } = req.body || {};
  if (!emailOk(email)) return res.status(400).json({ error: 'Enter a valid email' });
  if (typeof password !== 'string' || password.length < 8 || password.length > 200) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  const nm = String(name || '').trim().slice(0, 100) || email.split('@')[0];
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'An account with that email already exists' });
  const info = db.prepare('INSERT INTO users (email, name, pass_hash, created_at, last_login) VALUES (?,?,?,?,?)').run(email.trim(), nm, A.hashPassword(password), Date.now(), Date.now());
  const id = Number(info.lastInsertRowid);
  A.startSession(req, res, id);
  res.json({ user: A.userOut(userRow(id)) });
});

app.post('/api/auth/login', (req, res) => {
  const c = cfg();
  const { email, password } = req.body || {};
  if (!A.rateLimit('login:' + req.ip + ':' + String(email).toLowerCase(), 10, 15 * 60e3)) return res.status(429).json({ error: 'Too many attempts, try again later' });
  if (c.passwordLoginDisabled && String(email).trim().toLowerCase() !== c.adminEmail) return res.status(403).json({ error: 'Password sign-in is disabled, use SSO' });
  const u = emailOk(email) && typeof password === 'string' ? db.prepare('SELECT * FROM users WHERE email = ?').get(email) : null;
  if (!u || !A.verifyPassword(password, u.pass_hash)) return res.status(401).json({ error: 'Invalid email or password' });
  if (u.disabled) return res.status(403).json({ error: 'This account is disabled' });
  db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(Date.now(), u.id);
  A.startSession(req, res, u.id);
  res.json({ user: A.userOut(u) });
});

app.post('/api/auth/logout', (req, res) => { A.endSession(req, res); res.json({ ok: true }); });
app.get('/api/auth/me', (req, res) => {
  const c = cfg();
  res.json({
    user: A.loadUser(req), registration: c.allowRegistration && !c.passwordLoginDisabled,
    passwordLogin: !c.passwordLoginDisabled, oidc: c.oidc ? { label: c.oidc.label } : null,
  });
});
app.use('/api/auth/oidc', sso.router);
app.use('/api/admin', A.csrfGuard, admin.router);

/* ---------- resumes (every query is scoped to req.user.id: tenant isolation) ---------- */
const api = express.Router();
api.use(A.requireAuth);

const rowOut = (r, withData = true) => ({ id: r.id, title: r.title, created_at: r.created_at, updated_at: r.updated_at, ...(withData ? { data: JSON.parse(r.data) } : {}) });
const own = (req) => db.prepare('SELECT * FROM resumes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
const cleanTitle = (t, d = 'Untitled resume') => String(t || '').trim().slice(0, 100) || d;

const AUTO_REV_MS = Number(process.env.AUTO_REVISION_MINUTES || 10) * 60e3;
const MAX_AUTO_REVS = 60, MAX_REVS = 120;
function addRevision(resumeId, data, label, auto, at = Date.now()) {
  const info = db.prepare('INSERT INTO revisions (resume_id, created_at, label, auto, data) VALUES (?,?,?,?,?)').run(resumeId, at, label, auto ? 1 : 0, data);
  // prune: oldest automatic restore points first, then oldest of all
  const autos = db.prepare('SELECT id FROM revisions WHERE resume_id = ? AND auto = 1 ORDER BY created_at DESC').all(resumeId);
  autos.slice(MAX_AUTO_REVS).forEach((x) => db.prepare('DELETE FROM revisions WHERE id = ?').run(x.id));
  const all = db.prepare('SELECT id FROM revisions WHERE resume_id = ? ORDER BY created_at DESC').all(resumeId);
  all.slice(MAX_REVS).forEach((x) => db.prepare('DELETE FROM revisions WHERE id = ?').run(x.id));
  return Number(info.lastInsertRowid);
}
const revOut = (v) => ({ id: v.id, created_at: v.created_at, label: v.label, auto: !!v.auto });
const ownRev = (req) => (own(req) ? db.prepare('SELECT * FROM revisions WHERE id = ? AND resume_id = ?').get(Number(req.params.rid), req.params.id) : null);


/* ---------- profile (account-level photo and details, used to start new resumes) ---------- */
const PROFILE_FIELDS = ['headline', 'phone', 'location', 'linkedin', 'website', 'github'];
const PHOTO_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const userRow = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);
api.get('/profile', (req, res) => res.json({ user: A.userOut(userRow(req.user.id)) }));
api.put('/profile', (req, res) => {
  const b = req.body || {}, u = userRow(req.user.id);
  const name = b.name !== undefined ? String(b.name).trim().slice(0, 100) : u.name;
  if (!name) return res.status(400).json({ error: 'Name cannot be empty' });
  const prev = JSON.parse(u.profile || '{}'), profile = {};
  PROFILE_FIELDS.forEach((k) => { profile[k] = String(b.profile && b.profile[k] !== undefined ? b.profile[k] : prev[k] || '').trim().slice(0, 200); });
  let photo = u.photo || '';
  if (b.photo !== undefined) {
    if (b.photo === '' || b.photo === null) photo = '';
    else if (typeof b.photo === 'string' && b.photo.length <= 600000 && PHOTO_RE.test(b.photo)) photo = b.photo;
    else return res.status(400).json({ error: 'Photo must be a PNG, JPEG or WebP image under 400 KB' });
  }
  db.prepare('UPDATE users SET name = ?, profile = ?, photo = ? WHERE id = ?').run(name, JSON.stringify(profile), photo, u.id);
  res.json({ user: A.userOut(userRow(u.id)) });
});
api.post('/profile/password', (req, res) => {
  const u = userRow(req.user.id), { current, password } = req.body || {};
  if (typeof password !== 'string' || password.length < 8 || password.length > 200) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  const has = u.pass_hash && u.pass_hash !== '!';
  if (has && !(typeof current === 'string' && A.verifyPassword(current, u.pass_hash))) return res.status(403).json({ error: 'Current password is incorrect' });
  db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(A.hashPassword(password), u.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(u.id, A.currentTokenHash(req)); // sign out other devices
  res.json({ ok: true });
});

/* a new resume starts from the account profile: name, title, contact details; the photo stays linked (photoMode: 'profile') */
function applyProfile(doc, u) {
  const p = JSON.parse(u.profile || '{}'), h = doc.header, cid = () => Math.random().toString(36).slice(2, 10);
  const url = (v) => (/^https?:\/\//i.test(v) ? v : 'https://' + v);
  h.name = u.name || h.name;
  if (p.headline) h.title = p.headline;
  const contacts = [];
  if (p.phone) contacts.push({ id: cid(), icon: 'phone', text: p.phone, link: '' });
  contacts.push({ id: cid(), icon: 'mail', text: u.email, link: '' });
  if (p.linkedin) contacts.push({ id: cid(), icon: 'linkedin', text: p.linkedin.replace(/^https?:\/\//i, ''), link: url(p.linkedin) });
  if (p.github) contacts.push({ id: cid(), icon: 'github', text: p.github.replace(/^https?:\/\//i, ''), link: url(p.github) });
  if (p.website) contacts.push({ id: cid(), icon: 'globe', text: p.website.replace(/^https?:\/\//i, ''), link: url(p.website) });
  if (p.location) contacts.push({ id: cid(), icon: 'pin', text: p.location, link: '' });
  h.contacts = contacts.slice(0, 10);
  h.photo = ''; h.photoMode = 'profile';
}

api.get('/resumes', (req, res) => {
  res.json(db.prepare('SELECT * FROM resumes WHERE user_id = ? ORDER BY updated_at DESC').all(req.user.id).map((r) => rowOut(r)));
});

api.post('/resumes', (req, res) => {
  if (db.prepare('SELECT COUNT(*) c FROM resumes WHERE user_id = ?').get(req.user.id).c >= MAX_RESUMES) return res.status(400).json({ error: 'Resume limit reached' });
  const { title, template, blank, data } = req.body || {};
  let doc;
  if (data) doc = T.normalizeDoc(data);
  else doc = blank ? T.blankDoc(template) : T.sampleDoc(template);
  if (!data) applyProfile(doc, userRow(req.user.id));
  const id = crypto.randomBytes(9).toString('base64url');
  const now = Date.now();
  db.prepare('INSERT INTO resumes (id, user_id, title, data, created_at, updated_at) VALUES (?,?,?,?,?,?)').run(id, req.user.id, cleanTitle(title), JSON.stringify(doc), now, now);
  res.json(rowOut(own({ params: { id }, user: req.user })));
});

api.get('/resumes/:id', (req, res) => {
  const r = own(req);
  if (!r) return res.status(404).json({ error: 'Not found' });
  res.json(rowOut(r));
});

api.put('/resumes/:id', (req, res) => {
  const r = own(req);
  if (!r) return res.status(404).json({ error: 'Not found' });
  const title = req.body.title !== undefined ? cleanTitle(req.body.title) : r.title;
  const data = req.body.data ? JSON.stringify(T.normalizeDoc(req.body.data)) : r.data;
  const now = Date.now();
  // keep a restore point of the previous state when editing resumes after a pause (at most one per AUTO_REV_MINUTES)
  if (data !== r.data) {
    const last = db.prepare('SELECT created_at FROM revisions WHERE resume_id = ? ORDER BY created_at DESC LIMIT 1').get(r.id);
    if (!last || now - last.created_at > AUTO_REV_MS) addRevision(r.id, r.data, '', 1, r.updated_at);
  }
  db.prepare('UPDATE resumes SET title = ?, data = ?, updated_at = ? WHERE id = ? AND user_id = ?').run(title, data, now, r.id, req.user.id);
  res.json({ ok: true, updated_at: now });
});

api.post('/resumes/:id/duplicate', (req, res) => {
  const r = own(req);
  if (!r) return res.status(404).json({ error: 'Not found' });
  if (db.prepare('SELECT COUNT(*) c FROM resumes WHERE user_id = ?').get(req.user.id).c >= MAX_RESUMES) return res.status(400).json({ error: 'Resume limit reached' });
  const id = crypto.randomBytes(9).toString('base64url');
  const now = Date.now();
  db.prepare('INSERT INTO resumes (id, user_id, title, data, created_at, updated_at) VALUES (?,?,?,?,?,?)').run(id, req.user.id, cleanTitle(r.title + ' (copy)'), r.data, now, now);
  res.json(rowOut(own({ params: { id }, user: req.user })));
});

api.delete('/resumes/:id', (req, res) => {
  const info = db.prepare('DELETE FROM resumes WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (!info.changes) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

api.get('/resumes/:id/pdf', async (req, res) => {
  const r = own(req);
  if (!r) return res.status(404).json({ error: 'Not found' });
  try {
    const doc = T.resolveProfile(JSON.parse(r.data), { photo: (userRow(req.user.id) || {}).photo });
    const buf = await renderPdf(doc);
    const fname = (r.title || 'resume').replace(/[^\w.\- ]+/g, '').trim().replace(/\s+/g, '_') || 'resume';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${req.query.inline ? 'inline' : 'attachment'}; filename="${fname}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buf);
  } catch (e) {
    console.error('PDF failed', e);
    res.status(500).json({ error: 'PDF generation failed' });
  }
});

/* ---------- revision history (versions of one resume; always scoped through ownership of the resume) ---------- */
api.get('/resumes/:id/revisions', (req, res) => {
  if (!own(req)) return res.status(404).json({ error: 'Not found' });
  res.json(db.prepare('SELECT id, created_at, label, auto FROM revisions WHERE resume_id = ? ORDER BY created_at DESC').all(req.params.id).map(revOut));
});
api.post('/resumes/:id/revisions', (req, res) => {
  const r = own(req);
  if (!r) return res.status(404).json({ error: 'Not found' });
  const label = String((req.body || {}).label || '').trim().slice(0, 80) || 'Saved version';
  const id = addRevision(r.id, r.data, label, 0);
  res.json(revOut(db.prepare('SELECT * FROM revisions WHERE id = ?').get(id)));
});
api.get('/resumes/:id/revisions/:rid', (req, res) => {
  const v = ownRev(req);
  if (!v) return res.status(404).json({ error: 'Not found' });
  res.json({ ...revOut(v), data: JSON.parse(v.data) });
});
api.patch('/resumes/:id/revisions/:rid', (req, res) => {
  const v = ownRev(req);
  if (!v) return res.status(404).json({ error: 'Not found' });
  const label = String((req.body || {}).label || '').trim().slice(0, 80);
  db.prepare('UPDATE revisions SET label = ?, auto = 0 WHERE id = ?').run(label || 'Saved version', v.id); // naming a restore point keeps it
  res.json({ ok: true });
});
api.delete('/resumes/:id/revisions/:rid', (req, res) => {
  const v = ownRev(req);
  if (!v) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM revisions WHERE id = ?').run(v.id);
  res.json({ ok: true });
});
api.post('/resumes/:id/revisions/:rid/restore', (req, res) => {
  const r = own(req), v = ownRev(req);
  if (!r || !v) return res.status(404).json({ error: 'Not found' });
  if (r.data !== v.data) addRevision(r.id, r.data, 'Before restoring a version', 1, r.updated_at);
  const now = Date.now();
  db.prepare('UPDATE resumes SET data = ?, updated_at = ? WHERE id = ? AND user_id = ?').run(v.data, now, r.id, req.user.id);
  res.json({ ok: true, updated_at: now, data: JSON.parse(v.data) });
});
app.use('/api', api);

/* ---------- static ---------- */
app.get('/shared/fontlist.js', (req, res) => {
  res.type('js').send('window.ER_FONTLIST=' + JSON.stringify(require('../shared/fontlist.json')) + ';');
});
app.use('/shared', express.static(path.join(ROOT, 'shared'), { index: false }));
app.get('/vendor/sortable.js', (req, res) => res.sendFile(path.join(ROOT, 'node_modules/sortablejs/Sortable.min.js')));
app.use('/fonts', express.static(path.join(ROOT, 'public/fonts'), { maxAge: '30d', immutable: true }));
app.use(express.static(path.join(ROOT, 'public'), { index: 'index.html' }));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.get('*', (req, res) => res.sendFile(path.join(ROOT, 'public/index.html')));

app.use((err, req, res, next) => { // eslint-disable-line
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Payload too large' });
  if (err instanceof SyntaxError) return res.status(400).json({ error: 'Bad JSON' });
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

admin.ensureEnvAdmin();
const PORT = Number(process.env.PORT || 3000);
if (require.main === module) app.listen(PORT, '0.0.0.0', () => console.log(`EnhanceResume listening on :${PORT}`));
module.exports = app;
