'use strict';
const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'mystery.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL,
  password      TEXT NOT NULL,
  alias         TEXT,
  avatar_id     TEXT,
  real_name     TEXT,
  real_photo    TEXT,
  is_admin      INTEGER NOT NULL DEFAULT 0,
  profile_done  INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email  ON users (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_alias  ON users (lower(alias)) WHERE alias IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_avatar ON users (avatar_id)    WHERE avatar_id IS NOT NULL;

-- One row per mystery link. chooser_id picked chosen_id.
-- The two unique indexes are what guarantee the rules: everybody picks at most
-- one person, and everybody is picked at most once.
CREATE TABLE IF NOT EXISTS connections (
  id         INTEGER PRIMARY KEY,
  chooser_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chosen_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source     TEXT NOT NULL DEFAULT 'pick',
  created_at TEXT NOT NULL,
  CHECK (chooser_id <> chosen_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS conn_chooser ON connections (chooser_id);
CREATE UNIQUE INDEX IF NOT EXISTS conn_chosen  ON connections (chosen_id);

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY,
  conn_id    INTEGER NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  sender_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_conn ON messages (conn_id, id);

CREATE TABLE IF NOT EXISTS submissions (
  id         INTEGER PRIMARY KEY,
  conn_id    INTEGER NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week       INTEGER NOT NULL,
  payload    TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS submissions_key ON submissions (conn_id, user_id, week);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

const DEFAULT_SETTINGS = {
  current_week: '1',
  picking_open: '0',
  reveal_published: '0',
  event_name: 'RESTO 2027',
  week5_title: 'Two Truths & a Lie',
  week5_intro: 'Send your connection three statements about yourself: two true, one invented. Guess theirs. Still no names, no universities, no photos.'
};
const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insertSetting.run(k, v);

/* ------------------------------ settings ------------------------------ */
function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = Object.assign({}, DEFAULT_SETTINGS);
  for (const r of rows) out[r.key] = r.value;
  return out;
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, String(value));
}

/* ------------------------------ passwords ----------------------------- */
function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(plain, salt, 64);
  return 's1$' + salt.toString('hex') + '$' + hash.toString('hex');
}
function verifyPassword(plain, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 's1') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const actual = crypto.scryptSync(plain, salt, expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

/* -------------------------------- users ------------------------------- */
const now = () => new Date().toISOString();

function createUser(email, password) {
  const isFirst = db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0;
  const info = db.prepare(
    'INSERT INTO users (email, password, is_admin, created_at) VALUES (?, ?, ?, ?)'
  ).run(email.trim(), hashPassword(password), isFirst ? 1 : 0, now());
  return getUserById(Number(info.lastInsertRowid));
}
const getUserById = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
const getUserByEmail = (email) =>
  db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(String(email).trim()) || null;

function completeProfile(userId, { avatarId, alias, realName, realPhoto }) {
  db.prepare(
    `UPDATE users SET avatar_id = ?, alias = ?, real_name = ?, real_photo = ?, profile_done = 1 WHERE id = ?`
  ).run(avatarId, alias, realName, realPhoto || null, userId);
  return getUserById(userId);
}

const takenAvatarIds = () =>
  db.prepare('SELECT avatar_id FROM users WHERE avatar_id IS NOT NULL').all().map((r) => r.avatar_id);

const allUsers = () => db.prepare('SELECT * FROM users ORDER BY id').all();

/* ----------------------------- connections ---------------------------- */
const connectionsOf = (userId) =>
  db.prepare('SELECT * FROM connections WHERE chooser_id = ? OR chosen_id = ? ORDER BY id').all(userId, userId);

const getConnection = (id) => db.prepare('SELECT * FROM connections WHERE id = ?').get(id) || null;

const hasPicked = (userId) =>
  !!db.prepare('SELECT 1 FROM connections WHERE chooser_id = ?').get(userId);
const wasPicked = (userId) =>
  !!db.prepare('SELECT 1 FROM connections WHERE chosen_id = ?').get(userId);
const linkExists = (a, b) =>
  !!db.prepare(
    'SELECT 1 FROM connections WHERE (chooser_id = ? AND chosen_id = ?) OR (chooser_id = ? AND chosen_id = ?)'
  ).get(a, b, b, a);

/** Pickable = finished profile, not me, not already picked by someone, no link with me yet. */
function pickableFor(userId) {
  return db.prepare(`
    SELECT u.id, u.alias, u.avatar_id
    FROM users u
    WHERE u.profile_done = 1
      AND u.id <> ?
      AND u.id NOT IN (SELECT chosen_id FROM connections)
      AND u.id NOT IN (SELECT chooser_id FROM connections WHERE chosen_id = ?)
    ORDER BY u.alias COLLATE NOCASE
  `).all(userId, userId);
}

/**
 * First come, first served. The unique indexes make concurrent picks safe:
 * whoever commits first wins, the loser gets a clean error.
 */
function pick(chooserId, chosenId, source) {
  if (chooserId === chosenId) return { ok: false, error: 'You cannot pick yourself.' };
  const target = getUserById(chosenId);
  if (!target || !target.profile_done) return { ok: false, error: 'That participant is not available.' };
  if (hasPicked(chooserId)) return { ok: false, error: 'You have already picked someone.' };
  if (wasPicked(chosenId)) return { ok: false, error: 'Too late — someone already picked them.' };
  if (linkExists(chooserId, chosenId)) return { ok: false, error: 'You are already connected to them.' };
  try {
    const info = db.prepare(
      'INSERT INTO connections (chooser_id, chosen_id, source, created_at) VALUES (?, ?, ?, ?)'
    ).run(chooserId, chosenId, source || 'pick', now());
    return { ok: true, connection: getConnection(Number(info.lastInsertRowid)) };
  } catch (err) {
    return { ok: false, error: 'Too late — someone just took that slot.' };
  }
}

/** Fill every empty slot left over once picking closes. */
function autoMatch() {
  const done = db.prepare('SELECT id FROM users WHERE profile_done = 1').all().map((r) => r.id);
  const needsOut = done.filter((id) => !hasPicked(id));
  const needsIn = done.filter((id) => !wasPicked(id));
  shuffle(needsOut); shuffle(needsIn);

  let made = 0;
  for (const a of needsOut) {
    if (hasPicked(a)) continue;
    // Prefer someone with no connection at all, so nobody is left out.
    const candidates = needsIn.filter(
      (b) => b !== a && !wasPicked(b) && !linkExists(a, b)
    );
    candidates.sort((x, y) => connectionsOf(x).length - connectionsOf(y).length);
    const target = candidates[0];
    if (target === undefined) continue;
    const res = pick(a, target, 'auto');
    if (res.ok) made++;
  }
  return { made, unmatched: done.filter((id) => connectionsOf(id).length === 0).length };
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ------------------------------- messages ----------------------------- */
function addMessage(connId, senderId, body) {
  const info = db.prepare(
    'INSERT INTO messages (conn_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)'
  ).run(connId, senderId, body, now());
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(Number(info.lastInsertRowid));
}
const messagesOf = (connId, afterId) =>
  db.prepare('SELECT * FROM messages WHERE conn_id = ? AND id > ? ORDER BY id').all(connId, afterId || 0);

/* ----------------------------- submissions ---------------------------- */
function saveSubmission(connId, userId, week, payload) {
  db.prepare(`
    INSERT INTO submissions (conn_id, user_id, week, payload, created_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(conn_id, user_id, week) DO UPDATE SET payload = excluded.payload, created_at = excluded.created_at
  `).run(connId, userId, week, JSON.stringify(payload), now());
}
const submissionsOf = (connId) =>
  db.prepare('SELECT * FROM submissions WHERE conn_id = ?').all(connId).map((r) => ({
    ...r,
    payload: safeParse(r.payload)
  }));
function safeParse(s) { try { return JSON.parse(s); } catch { return {}; } }

/* --------------------------------- stats ------------------------------ */
function stats() {
  const q = (sql) => db.prepare(sql).get().n;
  return {
    users: q('SELECT COUNT(*) AS n FROM users'),
    profilesDone: q('SELECT COUNT(*) AS n FROM users WHERE profile_done = 1'),
    connections: q('SELECT COUNT(*) AS n FROM connections'),
    picked: q(`SELECT COUNT(*) AS n FROM connections WHERE source = 'pick'`),
    auto: q(`SELECT COUNT(*) AS n FROM connections WHERE source = 'auto'`),
    messages: q('SELECT COUNT(*) AS n FROM messages'),
    waitingToPick: q(
      'SELECT COUNT(*) AS n FROM users WHERE profile_done = 1 AND id NOT IN (SELECT chooser_id FROM connections)'
    ),
    notYetPicked: q(
      'SELECT COUNT(*) AS n FROM users WHERE profile_done = 1 AND id NOT IN (SELECT chosen_id FROM connections)'
    )
  };
}

module.exports = {
  db, DATA_DIR,
  getSettings, setSetting,
  hashPassword, verifyPassword,
  createUser, getUserById, getUserByEmail, completeProfile, takenAvatarIds, allUsers,
  connectionsOf, getConnection, pickableFor, pick, autoMatch, hasPicked, wasPicked,
  addMessage, messagesOf,
  saveSubmission, submissionsOf,
  stats
};
