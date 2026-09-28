'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const store = require('./db');
const { AVATARS, getAvatar } = require('./avatars');

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DEMO_DIR = path.join(ROOT, 'demo');
const MAX_BODY = 4 * 1024 * 1024; // room for a resized profile photo

/* ------------------------------- sessions ------------------------------ */
const SECRET = (function () {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const file = path.join(store.DATA_DIR, 'session.key');
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  return fs.readFileSync(file, 'utf8').trim();
})();
const SESSION_DAYS = 120;

function signSession(userId) {
  const exp = Date.now() + SESSION_DAYS * 864e5;
  const data = userId + '.' + exp;
  const mac = crypto.createHmac('sha256', SECRET).update(data).digest('hex').slice(0, 32);
  return data + '.' + mac;
}
function readSession(cookieHeader) {
  const raw = parseCookies(cookieHeader).mn_session;
  if (!raw) return null;
  const [id, exp, mac] = raw.split('.');
  if (!id || !exp || !mac) return null;
  const expect = crypto.createHmac('sha256', SECRET).update(id + '.' + exp).digest('hex').slice(0, 32);
  if (mac.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expect))) return null;
  if (Number(exp) < Date.now()) return null;
  return store.getUserById(Number(id));
}
function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
const sessionCookie = (value, maxAge) =>
  `mn_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;

/* -------------------------------- helpers ------------------------------ */
function send(res, status, body, headers) {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, Object.assign(
    { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    headers || {}
  ));
  res.end(payload);
}
const fail = (res, status, message) => send(res, status, { error: message });

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('Payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

const clean = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 200);
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** What another participant is allowed to know about you before the reveal. */
function maskedPeer(user) {
  const avatar = getAvatar(user.avatar_id);
  return {
    id: user.id,
    alias: user.alias,
    avatar: avatar,
    revealed: false
  };
}
function revealedPeer(user) {
  return Object.assign(maskedPeer(user), {
    revealed: true,
    realName: user.real_name,
    realPhoto: user.real_photo
  });
}

const TASK_WEEKS = [3, 5, 7];
function taskDefs(settings) {
  return [
    {
      week: 3,
      key: 'mutual_interests',
      title: 'Find three things you both like',
      intro: 'Talk until you find three things you genuinely have in common. Films, food, terrible taste in music, anything at all, as long as you both mean it. Write the three down here when you get there.',
      kind: 'list',
      count: 3,
      placeholder: 'e.g. We both love live music'
    },
    {
      week: 5,
      key: 'week5',
      title: settings.week5_title,
      intro: settings.week5_intro,
      kind: 'text',
      placeholder: 'Write your answer here'
    },
    {
      week: 7,
      key: 'clues',
      title: 'Three clues so they can find you',
      intro: 'On the night you get about five minutes to spot each other in a room full of people. Be specific: what you will be wearing, how tall you are, where you will be standing. Not useful: I have brown hair.',
      kind: 'list',
      count: 3,
      placeholder: 'e.g. Red scarf, on all evening'
    }
  ];
}

/* --------------------------------- API --------------------------------- */
const api = {};

api['POST /api/register'] = async (req, res) => {
  const body = await readBody(req);
  const email = clean(body.email, 120);
  const password = String(body.password || '');
  if (!isEmail(email)) return fail(res, 400, 'Please enter a valid email address.');
  if (password.length < 6) return fail(res, 400, 'Password must be at least 6 characters.');
  if (store.getUserByEmail(email)) return fail(res, 409, 'That email is already registered — sign in instead.');
  const user = store.createUser(email, password);
  send(res, 200, { ok: true, user: selfView(user) }, { 'Set-Cookie': sessionCookie(signSession(user.id), SESSION_DAYS * 86400) });
};

api['POST /api/login'] = async (req, res) => {
  const body = await readBody(req);
  const user = store.getUserByEmail(clean(body.email, 120));
  if (!user || !store.verifyPassword(String(body.password || ''), user.password)) {
    return fail(res, 401, 'Wrong email or password.');
  }
  send(res, 200, { ok: true, user: selfView(user) }, { 'Set-Cookie': sessionCookie(signSession(user.id), SESSION_DAYS * 86400) });
};

api['POST /api/logout'] = async (req, res) => {
  send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
};

api['GET /api/session'] = async (req, res, user) => {
  const settings = store.getSettings();
  send(res, 200, {
    user: user ? selfView(user) : null,
    settings: publicSettings(settings),
    tasks: taskDefs(settings)
  });
};

api['GET /api/avatars'] = async (req, res, user) => {
  const taken = new Set(store.takenAvatarIds());
  send(res, 200, {
    avatars: AVATARS.map((a) => ({
      ...a,
      taken: taken.has(a.id) && a.id !== (user && user.avatar_id)
    }))
  });
};

api['POST /api/profile'] = async (req, res, user) => {
  if (!user) return fail(res, 401, 'Please sign in first.');
  const body = await readBody(req);
  const avatarId = clean(body.avatarId, 20);
  const alias = clean(body.alias, 24);
  const realName = clean(body.realName, 60);
  const realPhoto = typeof body.realPhoto === 'string' ? body.realPhoto : '';

  if (!getAvatar(avatarId)) return fail(res, 400, 'Please choose a mystery character.');
  if (alias.length < 2) return fail(res, 400, 'Please choose a mystery name (at least 2 characters).');
  if (realName.length < 2) return fail(res, 400, 'Please enter your real name — it is only shown after the reveal.');
  if (realPhoto && !/^data:image\/(png|jpeg|webp);base64,/.test(realPhoto)) {
    return fail(res, 400, 'That photo format is not supported.');
  }
  if (realPhoto.length > 1_500_000) return fail(res, 400, 'That photo is too large.');

  const taken = store.takenAvatarIds();
  if (taken.includes(avatarId) && user.avatar_id !== avatarId) {
    return fail(res, 409, 'Someone just took that character — please pick another one.');
  }
  try {
    const updated = store.completeProfile(user.id, {
      avatarId, alias, realName,
      realPhoto: realPhoto || user.real_photo
    });
    send(res, 200, { ok: true, user: selfView(updated) });
  } catch (err) {
    send(res, 409, { error: 'That character or mystery name is already taken — please try another.' });
  }
};

api['GET /api/pool'] = async (req, res, user) => {
  if (!user) return fail(res, 401, 'Please sign in first.');
  if (!user.profile_done) return fail(res, 400, 'Finish your profile first.');
  const settings = store.getSettings();
  send(res, 200, {
    pickingOpen: settings.picking_open === '1',
    alreadyPicked: store.hasPicked(user.id),
    pool: store.pickableFor(user.id).map((u) => ({
      id: u.id, alias: u.alias, avatar: getAvatar(u.avatar_id)
    }))
  });
};

api['POST /api/pick'] = async (req, res, user) => {
  if (!user) return fail(res, 401, 'Please sign in first.');
  const settings = store.getSettings();
  if (settings.picking_open !== '1') return fail(res, 403, 'Picking is not open yet.');
  const body = await readBody(req);
  const result = store.pick(user.id, Number(body.targetId), 'pick');
  if (!result.ok) return fail(res, 409, result.error);
  send(res, 200, { ok: true, connectionId: result.connection.id });
};

api['GET /api/connections'] = async (req, res, user) => {
  if (!user) return fail(res, 401, 'Please sign in first.');
  const settings = store.getSettings();
  const revealed = settings.reveal_published === '1';
  const list = store.connectionsOf(user.id).map((c) => {
    const peerId = c.chooser_id === user.id ? c.chosen_id : c.chooser_id;
    const peer = store.getUserById(peerId);
    const subs = store.submissionsOf(c.id);
    return {
      id: c.id,
      source: c.source,
      youPicked: c.chooser_id === user.id,
      peer: revealed ? revealedPeer(peer) : maskedPeer(peer),
      tasks: TASK_WEEKS.map((week) => ({
        week,
        mine: (subs.find((s) => s.user_id === user.id && s.week === week) || {}).payload || null,
        peerDone: subs.some((s) => s.user_id === peerId && s.week === week)
      }))
    };
  });
  send(res, 200, { connections: list, settings: publicSettings(settings) });
};

api['GET /api/messages'] = async (req, res, user, url) => {
  if (!user) return fail(res, 401, 'Please sign in first.');
  const conn = ownedConnection(user, Number(url.searchParams.get('connId')));
  if (!conn) return fail(res, 404, 'Conversation not found.');
  const after = Number(url.searchParams.get('after') || 0);
  send(res, 200, {
    messages: store.messagesOf(conn.id, after).map((m) => ({
      id: m.id, mine: m.sender_id === user.id, body: m.body, at: m.created_at
    }))
  });
};

api['POST /api/messages'] = async (req, res, user) => {
  if (!user) return fail(res, 401, 'Please sign in first.');
  const body = await readBody(req);
  const conn = ownedConnection(user, Number(body.connId));
  if (!conn) return fail(res, 404, 'Conversation not found.');
  const text = String(body.body || '').trim().slice(0, 2000);
  if (!text) return fail(res, 400, 'Message is empty.');
  const msg = store.addMessage(conn.id, user.id, text);
  send(res, 200, { ok: true, message: { id: msg.id, mine: true, body: msg.body, at: msg.created_at } });
};

api['POST /api/task'] = async (req, res, user) => {
  if (!user) return fail(res, 401, 'Please sign in first.');
  const body = await readBody(req);
  const conn = ownedConnection(user, Number(body.connId));
  if (!conn) return fail(res, 404, 'Conversation not found.');
  const week = Number(body.week);
  if (!TASK_WEEKS.includes(week)) return fail(res, 400, 'Unknown task.');
  const settings = store.getSettings();
  if (Number(settings.current_week) < week) return fail(res, 403, 'That task is not open yet.');

  const def = taskDefs(settings).find((d) => d.week === week);
  let payload;
  if (def.kind === 'list') {
    const items = (Array.isArray(body.items) ? body.items : []).map((v) => clean(v, 140)).filter(Boolean);
    if (items.length < def.count) return fail(res, 400, `Please give ${def.count} answers.`);
    payload = { items: items.slice(0, def.count) };
  } else {
    const text = String(body.text || '').trim().slice(0, 1200);
    if (text.length < 5) return fail(res, 400, 'Please write a little more.');
    payload = { text };
  }
  store.saveSubmission(conn.id, user.id, week, payload);
  send(res, 200, { ok: true, payload });
};

api['GET /api/reveal'] = async (req, res) => {
  const settings = store.getSettings();
  if (settings.reveal_published !== '1') {
    return send(res, 200, { published: false, eventName: settings.event_name, pairs: [] });
  }
  const users = new Map(store.allUsers().map((u) => [u.id, u]));
  const pairs = [];
  for (const c of store.db.prepare('SELECT * FROM connections ORDER BY id').all()) {
    const a = users.get(c.chooser_id), b = users.get(c.chosen_id);
    if (!a || !b) continue;
    pairs.push({ id: c.id, source: c.source, people: [cardOf(a), cardOf(b)] });
  }
  send(res, 200, { published: true, eventName: settings.event_name, pairs });
};
const cardOf = (u) => ({
  alias: u.alias, avatar: getAvatar(u.avatar_id), realName: u.real_name, realPhoto: u.real_photo
});

/* --------------------------------- admin -------------------------------- */
function requireAdmin(res, user) {
  if (!user || !user.is_admin) { fail(res, 403, 'Organiser access only.'); return false; }
  return true;
}
api['GET /api/admin/overview'] = async (req, res, user) => {
  if (!requireAdmin(res, user)) return;
  const settings = store.getSettings();
  const conns = store.db.prepare('SELECT * FROM connections ORDER BY id').all();
  const byId = new Map(store.allUsers().map((u) => [u.id, u]));
  send(res, 200, {
    settings,
    stats: store.stats(),
    participants: store.allUsers().map((u) => ({
      id: u.id, email: u.email, alias: u.alias, realName: u.real_name,
      avatar: getAvatar(u.avatar_id), profileDone: !!u.profile_done, isAdmin: !!u.is_admin,
      hasPhoto: !!u.real_photo, connections: store.connectionsOf(u.id).length
    })),
    connections: conns.map((c) => ({
      id: c.id, source: c.source,
      chooser: labelOf(byId.get(c.chooser_id)),
      chosen: labelOf(byId.get(c.chosen_id)),
      messages: store.messagesOf(c.id, 0).length,
      submissions: store.submissionsOf(c.id).length
    }))
  });
};
const labelOf = (u) => (u ? `${u.alias || u.email} (${u.real_name || '—'})` : '—');

api['POST /api/admin/setting'] = async (req, res, user) => {
  if (!requireAdmin(res, user)) return;
  const body = await readBody(req);
  const allowed = ['current_week', 'picking_open', 'reveal_published', 'event_name', 'week5_title', 'week5_intro'];
  if (!allowed.includes(body.key)) return fail(res, 400, 'Unknown setting.');
  store.setSetting(body.key, clean(body.value, 400));
  send(res, 200, { ok: true, settings: store.getSettings() });
};

api['POST /api/admin/automatch'] = async (req, res, user) => {
  if (!requireAdmin(res, user)) return;
  send(res, 200, Object.assign({ ok: true }, store.autoMatch()));
};

/* ------------------------------ plumbing -------------------------------- */
function ownedConnection(user, connId) {
  const conn = store.getConnection(connId);
  if (!conn) return null;
  if (conn.chooser_id !== user.id && conn.chosen_id !== user.id) return null;
  return conn;
}
function selfView(user) {
  return {
    id: user.id, email: user.email, alias: user.alias, avatar: getAvatar(user.avatar_id),
    realName: user.real_name, realPhoto: user.real_photo,
    profileDone: !!user.profile_done, isAdmin: !!user.is_admin
  };
}
function publicSettings(s) {
  return {
    eventName: s.event_name,
    currentWeek: Number(s.current_week),
    pickingOpen: s.picking_open === '1',
    revealPublished: s.reveal_published === '1'
  };
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json'
};

function serveStatic(res, baseDir, relPath) {
  const safe = path.normalize(relPath).replace(/^(\.\.[/\\])+/, '');
  let file = path.join(baseDir, safe);
  if (!file.startsWith(baseDir)) return fail(res, 403, 'Forbidden');
  if (!fs.existsSync(file) && fs.existsSync(file + '.html')) file += '.html';
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return send(res, 404, '<h1>404 — not found</h1>', { 'Content-Type': 'text/html; charset=utf-8' });
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const route = req.method + ' ' + url.pathname;
  try {
    if (url.pathname.startsWith('/api/')) {
      const handler = api[route];
      if (!handler) return fail(res, 404, 'Unknown endpoint.');
      const user = readSession(req.headers.cookie);
      return await handler(req, res, user, url);
    }
    if (url.pathname === '/demo' || url.pathname.startsWith('/demo/')) {
      return serveStatic(res, DEMO_DIR, url.pathname.replace(/^\/demo\/?/, '') || 'index.html');
    }
    return serveStatic(res, PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
  } catch (err) {
    if (!res.headersSent) fail(res, 400, err.message || 'Something went wrong.');
    else res.end();
  }
});

server.listen(PORT, () => {
  console.log(`Mystery Networking running on http://localhost:${PORT}`);
  console.log(`  participant site  /`);
  console.log(`  organiser console /admin.html`);
  console.log(`  demo prototype    /demo`);
});
