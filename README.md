# Mystery Networking

Pre-event ice-breaking for **RESTO 2027**. Every participant claims a pixel
character, gets matched one-to-one with a student from another school, and
talks to them for eight weeks through three small missions — without ever
learning who they are. Identities are revealed at the welcome evening in
Helsinki.

Two separate things live here:

| | What it is | Where |
|---|---|---|
| **Demo prototype** | The whole journey in about 90 seconds, for the university presentation. One self-contained file, no accounts, no server. | `demo/index.html` |
| **Live site** | What actually runs the event: accounts, exclusive characters, first-come-first-served matching, permanent chat, weekly missions, organiser console, reveal wall. | `server/` + `public/` |

---

## Quick start

Node **22.5 or newer**. There are no npm dependencies.

```bash
npm start                     # http://localhost:3000
npm run seed                  # optional: fill it with fictional participants
```

| URL | Who it is for |
|---|---|
| `/` | Participants |
| `/admin.html` | Organiser console |
| `/reveal.html` | The reveal wall, for the big screen on the night |
| `/demo` | The presentation prototype |

**The first account to register becomes the organiser.** Register yours
before you send the link to anyone else.

### Configuration

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3000` | |
| `DATA_DIR` | `./data` | Where the SQLite file lives. Point it at a persistent disk when deploying. |
| `SESSION_SECRET` | generated into `DATA_DIR/session.key` | Set it explicitly in production. |

The whole database is one file, `data/mystery.db`. Back it up by copying it.

---

## Presenting the demo

`demo/index.html` is a **single self-contained file**: stylesheet, fonts and
scripts are inlined and every character is drawn in code, so it opens from a
USB stick, an email attachment or a file preview with no network and nothing
beside it.

Right arrow or enter advances, **R** restarts, and the five squares in the top
bar switch the accent colour live.

Edit `demo/src.html` (which references `public/assets/`), then rebuild:

```bash
npm run build:demo
```

---

## How the event runs

The organiser console drives everything; participants only ever see what the
current week allows.

### Week 1 · Sign up
Send the Microsoft Form, collect emails, then email everyone the site link.
Each participant registers, claims a **character** — 60 pixel people, one per
person, gone once taken — chooses a **mystery name**, and enters their **real
name and photo**, which are sealed until the reveal.

### Week 2 · Picking
Switch **Picking** on. Participants see a wall of characters and mystery names
only, and pick one person. The rules are enforced by the database, not the
interface:

* you may pick **one** person,
* you may be picked by **one** person,
* anyone already picked disappears from everyone's wall immediately —
  **first come, first served**,
* you cannot pick the person who picked you, so no pair is wasted.

So most people end up with **two connections**: the one they chose and the one
who chose them. Each has its own chat and its own answers.

When picking closes, press **Auto-match** and everyone left over is paired,
preferring whoever has no connection at all.

### Weeks 3, 5 and 7 · Missions

| Week | Mission | Format |
|---|---|---|
| 3 | **Find three things you both like** — by talking | three short answers |
| 5 | **Two truths and a lie** *(title and text editable in the console)* | free text |
| 7 | **Three clues so they can find you** — what you will wear, how tall you are, where you will stand | three short answers |

A mission appears only once the organiser sets the current week to it or
beyond. Chat is open the whole time and **every message is stored** — sign
out, change device, come back in week 7, and the history is still there. The
no-identity rule sits above every conversation.

### The night · Reveal
Press **Publish reveal**. `reveal.html` then shows every pair side by side:
pixel character and mystery name next to real photo and real name. Until that
moment the server never sends anyone's real name or photo to another
participant's browser — hiding it in the interface would not be enough.

---

## Project layout

```
demo/index.html        Self-contained presentation prototype — built, open directly
demo/src.html          Source for the prototype; references public/assets
tools/build-demo.js    Inlines the assets into demo/index.html
tools/seed.js          Fills a local database with fictional participants

server/index.js        HTTP server, routing, sessions, JSON API, static files
server/db.js           SQLite schema and every data rule (matching, chat, missions)
server/avatars.js      Exposes the 60 characters to the API

public/index.html      Sign up and sign in
public/onboarding.html Claim a character, mystery name, sealed real details
public/hub.html        Connections, missions, progress, stamps
public/pick.html       The picking wall
public/chat.html       One conversation and its current mission
public/admin.html      Organiser console
public/reveal.html     The reveal wall
public/assets/         Design system: pixel.js, ui.css, motion.js, grain.js, app.js, fonts.css

data/                  SQLite database and session key (git-ignored)
```

### The design system

`public/assets` is shared by the site and the demo.

* **pixel.js** draws all 60 characters — 32×32, shaded and outlined in code,
  with expressions and pupils that follow the pointer. No image files exist.
* **ui.css** holds the tokens: paper `#FCFCFB`, ink `#0E0E12`, purple
  `#8B5CF6`, mint for anything completed. Change `--accent` to re-brand.
* **motion.js** is where the polish lives: headlines split into lines that
  rise from behind a mask, screens change behind a curtain, blocks rise on
  scroll, buttons lean towards the pointer, counters and the progress ring
  animate. One easing curve throughout.
* **grain.js** scatters the ink speckle over the page from a fixed seed.
* **app.js** is the shared front-end: API calls, the page shell, photo
  resizing, and the redirect rules that keep everyone on the right page.

### API summary

| Endpoint | Purpose |
|---|---|
| `POST /api/register`, `/api/login`, `/api/logout` | Accounts |
| `GET /api/session` | Current user, event settings, mission definitions |
| `GET /api/avatars` · `POST /api/profile` | Claim a character, set the mystery name and sealed details |
| `GET /api/pool` · `POST /api/pick` | The wall, and picking one person |
| `GET /api/connections` | Your connections, masked peers, mission progress |
| `GET`/`POST /api/messages` | Permanent chat |
| `POST /api/task` | Submit or change a mission answer |
| `GET /api/reveal` | Reveal data — empty until published |
| `GET /api/admin/overview` · `POST /api/admin/setting` · `POST /api/admin/automatch` | Organiser console |

---

## Deployment notes

Any host that runs Node 22 works (Render, Railway, Fly.io, a VPS). Two things
matter:

1. mount a **persistent disk** and point `DATA_DIR` at it, or the database is
   wiped on every redeploy;
2. set `SESSION_SECRET`, or everyone is signed out when the app restarts.

Run it behind HTTPS — session cookies are `HttpOnly` and `SameSite=Lax`.
