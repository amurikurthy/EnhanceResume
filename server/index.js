const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { db } = require('./db');
const A = require('./auth');
const T = require('../shared/templates');
const { renderPdf } = require('./pdf');

const app = express();
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? true : process.env.TRUST_PROXY);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.use(express.json({ limit: '4mb' }));
app.use('/api', A.csrfGuard);

const ROOT = path.join(__dirname, '..');
const ALLOW_REG = process.env.ALLOW_REGISTRATION !== 'false';
const MAX_RESUMES = Number(process.env.MAX_RESUMES_PER_USER || 50);

/* ---------- auth ---------- */
const emailOk = (e) => typeof e === 'string' && e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

app.post('/api/auth/register', (req, res) => {
  if (!ALLOW_REG) return res.status(403).json({ error: 'Registration is disabled' });
  if (!A.rateLimit('reg:' + req.ip, 10, 3600e3)) return res.status(429).json({ error: 'Too many attempts, try later' });
  const { email, password, name } = req.body || {};
  if (!emailOk(email)) return res.status(400).json({ error: 'Enter a valid email' });
  if (typeof password !== 'string' || password.length < 8 || password.length > 200) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  const nm = String(name || '').trim().slice(0, 100) || email.split('@')[0];
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'An account with that email already exists' });
  const info = db.prepare('INSERT INTO users (email, name, pass_hash, created_at) VALUES (?,?,?,?)').run(email.trim(), nm, A.hashPassword(password), Date.now());
  const id = Number(info.lastInsertRowid);
  A.startSession(req, res, id);
  res.json({ user: { id, email: email.trim(), name: nm } });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!A.rateLimit('login:' + req.ip + ':' + String(email).toLowerCase(), 10, 15 * 60e3)) return res.status(429).json({ error: 'Too many attempts, try again later' });
  const u = emailOk(email) && typeof password === 'string' ? db.prepare('SELECT * FROM users WHERE email = ?').get(email) : null;
  if (!u || !A.verifyPassword(password, u.pass_hash)) return res.status(401).json({ error: 'Invalid email or password' });
  A.startSession(req, res, u.id);
  res.json({ user: { id: u.id, email: u.email, name: u.name } });
});

app.post('/api/auth/logout', (req, res) => { A.endSession(req, res); res.json({ ok: true }); });
app.get('/api/auth/me', (req, res) => res.json({ user: A.loadUser(req), registration: ALLOW_REG }));

/* ---------- resumes (every query is scoped to req.user.id: tenant isolation) ---------- */
const api = express.Router();
api.use(A.requireAuth);

const rowOut = (r, withData = true) => ({ id: r.id, title: r.title, created_at: r.created_at, updated_at: r.updated_at, ...(withData ? { data: JSON.parse(r.data) } : {}) });
const own = (req) => db.prepare('SELECT * FROM resumes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
const cleanTitle = (t, d = 'Untitled resume') => String(t || '').trim().slice(0, 100) || d;

api.get('/resumes', (req, res) => {
  res.json(db.prepare('SELECT * FROM resumes WHERE user_id = ? ORDER BY updated_at DESC').all(req.user.id).map((r) => rowOut(r)));
});

api.post('/resumes', (req, res) => {
  if (db.prepare('SELECT COUNT(*) c FROM resumes WHERE user_id = ?').get(req.user.id).c >= MAX_RESUMES) return res.status(400).json({ error: 'Resume limit reached' });
  const { title, template, blank, data } = req.body || {};
  let doc;
  if (data) doc = T.normalizeDoc(data);
  else doc = blank ? T.blankDoc(template) : T.sampleDoc(template);
  if (!data && !blank) { doc.header.name = req.user.name || doc.header.name; }
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
    const doc = JSON.parse(r.data);
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

const PORT = Number(process.env.PORT || 3000);
if (require.main === module) app.listen(PORT, '0.0.0.0', () => console.log(`EnhanceResume listening on :${PORT}`));
module.exports = app;
