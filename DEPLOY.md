# Putting this online

There are two different things to host, and they have different needs.

| | What it needs | Where to put it |
|---|---|---|
| **Demo** (`demo/index.html`) | Nothing. One static file. | Netlify, GitHub Pages, anywhere |
| **Live site** (`server/` + `public/`) | A Node process that stays running, and a **disk** that survives restarts | Railway, Render (paid), Fly.io, a VPS |

**Netlify cannot host the live site.** It serves static files and short-lived
functions; it has no always-on process and no disk, so accounts, chat history
and matches would vanish. Use it for the demo, and one of the hosts below for
the real thing.

---

## The demo, on Netlify — two minutes

**Drag and drop (no account setup):** open <https://app.netlify.com/drop> and
drag the `demo` folder onto the page. You get a URL immediately.

**From GitHub (updates itself on every push):**
1. Netlify → *Add new site* → *Import an existing project* → pick this repo.
2. Build command `npm run build:demo`, publish directory `demo`.
3. Deploy. `netlify.toml` in the repo already sets both.

---

## The live site, on Railway — about ten minutes

Railway is the least fiddly host with a real disk.

1. <https://railway.app> → *New Project* → *Deploy from GitHub repo* → this repo.
2. It detects Node and runs `npm start`. No build step, no dependencies.
3. **Add a volume** (this is the important part): service → *Variables/Settings*
   → *Add Volume*, mount path `/data`.
4. Add environment variables:

   | Name | Value |
   |---|---|
   | `DATA_DIR` | `/data` |
   | `SESSION_SECRET` | any long random string |
   | `SECURE_COOKIES` | `1` |

5. *Settings* → *Networking* → *Generate Domain*. That URL is the site.
6. **Open it and register your own account first** — the first account becomes
   the organiser. Then send the link to participants.

### On Render instead

`render.yaml` is in the repo: Render → *New* → *Blueprint* → pick this repo.
It sets the disk, the mount path and the variables. Note that Render's **free**
plan cannot mount a disk, so the paid instance is required if the data has to
survive a redeploy.

### On Fly.io instead

```bash
fly launch --no-deploy            # answer no to databases
fly volumes create data --size 1
fly secrets set SESSION_SECRET=$(openssl rand -hex 32) SECURE_COOKIES=1
```
Then in `fly.toml` add a mount for `data` at `/data`, set `DATA_DIR=/data`
under `[env]`, and `fly deploy`.

---

## Before you send the link out

- Register your organiser account first.
- Open `/admin.html` and check the week is 1 and picking is off.
- Back up `DATA_DIR/mystery.db` before the welcome evening. It is one file;
  copying it is the whole backup.
- The reveal stays sealed until you press *Publish reveal*, so nobody's real
  name or photo can leak early even if they read the page source.
