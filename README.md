# Mystery Networking

Pre-event ice-breaking for **RESTO 2027**. Participants register, claim a secret
character, get matched one-to-one with someone from another university, and chat
through three mystery tasks — without ever learning who the other person is.
Identities are revealed only at the live Welcome Event.

This repository contains two separate things:

| | What it is | Where |
|---|---|---|
| **Demo prototype** | A clickable, fictional walkthrough of the whole journey in about 90 seconds, for the university final presentation. Mobile-first, with a desktop layout, and no accounts or server needed — open the file directly. | `demo/index.html` |
| **Live website** | The real product used to run the event: accounts, exclusive avatars, first-come-first-served matching, persistent chat, weekly tasks, organiser console, public reveal page. | `server/` + `public/` |

---

## Quick start

Requires **Node.js 22.5 or newer** — nothing else. There are no npm dependencies.

```bash
npm start          # or: node server/index.js
```

Then open:

| URL | Who it is for |
|---|---|
| `http://localhost:3000/` | Participants |
| `http://localhost:3000/admin.html` | Organiser console |
| `http://localhost:3000/reveal.html` | Public reveal page (live event) |
| `http://localhost:3000/demo` | Presentation prototype |

**The first account that registers becomes the organiser (admin).** Register
yours before sending the link to participants.

### Configuration

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3000` | |
| `DATA_DIR` | `./data` | Where the SQLite database lives. Point this at a persistent volume when deploying. |
| `SESSION_SECRET` | auto-generated into `DATA_DIR/session.key` | Set it explicitly in production. |

The database is a single SQLite file (`data/mystery.db`). Back it up by copying
that file. `data/` is git-ignored.

---

## How the event runs

The organiser console drives everything — participants only ever see what the
current week allows.

### Presenting the demo

Open `demo/index.html` in any browser, from anywhere — it carries its own
fonts and draws every character in code, so it works with no network.
Right arrow or enter advances, **R** restarts, and the five squares in the
top bar switch the accent colour live.

### Week 1 · Sign up
You send the Microsoft Form, collect emails, then email participants the site
link. Each participant:

1. registers with email + password,
2. claims a **mystery character** — 72 Nordic animals, each one can be taken by
   exactly one person, so it doubles as their anonymous identity,
3. chooses a **mystery name**,
4. uploads their **real name and real photo** — stored but locked; nobody sees
   them until the reveal.

### Week 2 · Matching
Organiser switches **Picking** on. Participants see a wall of characters and
codenames only, and pick one person.

The rules are enforced by the database, not by the interface:

* you may pick **one** person,
* you may be picked by **one** person,
* a person who has already been picked disappears from everyone's list
  immediately — **first come, first served**,
* you cannot pick the person who picked you, so a pair is never wasted.

So each participant ends up with up to **two independent connections**: the one
they chose, and the one who chose them. Each connection has its own chat and its
own task answers.

When picking closes, the organiser presses **Auto-match** and everyone left over
(nobody picked them, or they never picked) is paired automatically, preferring
whoever has no connection at all.

### Weeks 3, 5 and 7 · Mystery tasks

| Week | Task | Format |
|---|---|---|
| 3 | **Three things in common** | three short answers |
| 5 | **Two Truths & a Lie** *(title and text editable in the console)* | free text |
| 7 | **Three clues to find me** — appearance, height, what they will wear, where they will stand | three short answers |

A task only becomes visible once the organiser sets the current week to that
number or beyond.

Chat is open the whole time and **every message is stored permanently** — sign
out, change device, come back in week 7, and the full history is still there.

### Live event · Reveal
Organiser presses **Publish reveal**. `reveal.html` then shows every pair side by
side: mystery character + codename next to real photo + real name. Until that
moment the server never sends a participant's real name or photo to anyone
else's browser — hiding it in the interface would not be enough.

---

## Project layout

```
demo/index.html      Self-contained presentation prototype (open directly in a browser)
server/index.js      HTTP server, routing, sessions, JSON API, static files
server/db.js         SQLite schema and all data rules (matching, chat, tasks)
server/avatars.js    The 72 claimable mystery characters
public/              Participant site, organiser console, reveal page
data/                SQLite database + session key (git-ignored, created on first run)
```

### API summary

| Endpoint | Purpose |
|---|---|
| `POST /api/register`, `/api/login`, `/api/logout` | Accounts |
| `GET /api/session` | Current user, event settings, task definitions |
| `GET /api/avatars` · `POST /api/profile` | Claim a character, set mystery name, real name, photo |
| `GET /api/pool` · `POST /api/pick` | See pickable participants, pick one |
| `GET /api/connections` | Your connections, masked peer, task progress |
| `GET`/`POST /api/messages` | Persistent chat |
| `POST /api/task` | Submit or update a weekly task answer |
| `GET /api/reveal` | Public reveal data (empty until published) |
| `GET /api/admin/overview` · `POST /api/admin/setting` · `POST /api/admin/automatch` | Organiser console |

---

## Deployment notes

Any host that runs Node 22 works (Render, Railway, Fly.io, a VPS). Two things
matter:

1. mount a **persistent disk** and point `DATA_DIR` at it, otherwise the database
   is wiped on every redeploy;
2. set `SESSION_SECRET` so participants are not signed out when the app restarts.

Run it behind HTTPS — session cookies are `HttpOnly` and `SameSite=Lax`.
