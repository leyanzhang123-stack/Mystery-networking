#!/usr/bin/env node
/*
 * Fills a local database with fictional participants so the site can be
 * clicked through without waiting eight weeks. Never point this at the real
 * event database.
 *
 *   DATA_DIR=./tmp-data node server/index.js &
 *   BASE=http://localhost:3000 node tools/seed.js
 */
'use strict';
const BASE = process.env.BASE || 'http://localhost:3000';

const PEOPLE = [
  ['organiser@resto.fi', 'Emma Virtanen'],
  ['alex@metropolia.fi', 'Alex Laine'],
  ['noor@haaga.fi', 'Noor Haddad'],
  ['toni@laurea.fi', 'Toni Mäkelä'],
  ['sara@xamk.fi', 'Sara Lindholm'],
  ['juho@jamk.fi', 'Juho Karvonen'],
  ['lea@savonia.fi', 'Lea Ahonen'],
  ['mika@seamk.fi', 'Mika Koskinen']
];

function client() {
  let cookie = '';
  return async function call(path, body, method) {
    const res = await fetch(BASE + path, {
      method: method || (body ? 'POST' : 'GET'),
      headers: Object.assign({}, body ? { 'Content-Type': 'application/json' } : {}, cookie ? { cookie } : {}),
      body: body ? JSON.stringify(body) : undefined
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(path + ': ' + (data.error || res.status));
    return data;
  };
}

(async () => {
  const sessions = [];
  for (let i = 0; i < PEOPLE.length; i++) {
    const [email, realName] = PEOPLE[i];
    const call = client();
    try { await call('/api/register', { email, password: 'password' }); }
    catch (e) { await call('/api/login', { email, password: 'password' }); }
    const avatars = (await call('/api/avatars')).avatars;
    const free = avatars.find((a) => !a.taken);
    await call('/api/profile', { avatarId: free.id, alias: free.handle, realName });
    sessions.push({ call, email, realName, alias: free.handle });
    console.log('ready:', realName, '·', free.handle);
  }

  const admin = sessions[0].call;
  await admin('/api/admin/setting', { key: 'picking_open', value: '1' });
  await admin('/api/admin/setting', { key: 'current_week', value: '3' });

  // a few people pick early, so the wall still has someone on it
  const pool = (await sessions[1].call('/api/pool')).pool;
  const idOf = (alias) => (pool.find((p) => p.alias === alias) || {}).id;
  for (let i = 1; i <= 3; i++) {
    const target = idOf(sessions[i + 1].alias);
    if (!target) continue;
    try { await sessions[i].call('/api/pick', { targetId: target }); }
    catch (e) { console.log('pick skipped:', e.message); }
  }
  if (process.env.AUTOMATCH === '1') {
    const auto = await admin('/api/admin/automatch', {});
    console.log('auto-matched:', auto.made, 'still unmatched:', auto.unmatched);
  } else {
    console.log('left unmatched on purpose — press Auto-match in the console to finish');
  }

  // a conversation and a completed first mission
  const alex = sessions[1];
  const conns = (await alex.call('/api/connections')).connections;
  if (conns.length) {
    const c = conns[0].id;
    for (const line of [
      'eight weeks of this and i cannot even ask your name',
      'worst airport coffee you have ever paid actual money for',
      'Helsinki T2, gate 24. I would defend it in court'
    ]) await alex.call('/api/messages', { connId: c, body: line });
    await alex.call('/api/task', {
      connId: c, week: 3,
      items: ['Coffee, defended badly', 'Both interrailed last summer', 'Flow Festival, both calendars']
    });
    console.log('seeded a conversation on connection', c);
  }

  console.log('\nSign in with any of these, password "password":');
  PEOPLE.forEach(([e, n]) => console.log('  ' + e.padEnd(24), n));
  console.log('\n' + PEOPLE[0][0] + ' is the organiser.');
})().catch((e) => { console.error(e); process.exit(1); });
