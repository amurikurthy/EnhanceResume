const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'enhanceresume.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    pass_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS resumes (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id, updated_at DESC);
  CREATE TABLE IF NOT EXISTS revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    auto INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_revisions_resume ON revisions(resume_id, created_at DESC);
`);

// lightweight migrations for columns added after the first release
const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
for (const [name, ddl] of [
  ['is_admin', 'INTEGER NOT NULL DEFAULT 0'], ['disabled', 'INTEGER NOT NULL DEFAULT 0'],
  ['oidc_sub', 'TEXT'], ['last_login', 'INTEGER'], ['photo', 'TEXT'], ['profile', "TEXT NOT NULL DEFAULT '{}'"],
]) if (!cols.includes(name)) db.exec(`ALTER TABLE users ADD COLUMN ${name} ${ddl}`);
db.exec('CREATE INDEX IF NOT EXISTS idx_users_oidc ON users(oidc_sub)');

module.exports = { db, DATA_DIR };
