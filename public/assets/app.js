/* ------------------------------------------------------------------ *
 * Shared front-end for the participant site and the organiser console.
 * ------------------------------------------------------------------ */
(function (root) {
  'use strict';

  /* ------------------------------- api ------------------------------ */
  async function api(path, body, method) {
    const res = await fetch(path, {
      method: method || (body ? 'POST' : 'GET'),
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin'
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  }

  /* ------------------------------ chrome ---------------------------- */
  /** Page shell: grain canvas, top bar, and the wrapper every page renders into. */
  function shell(opts) {
    const o = opts || {};
    document.body.insertAdjacentHTML('afterbegin',
      '<canvas id="field"></canvas>' +
      '<div class="page">' +
        '<div class="topbar"><div class="inner">' +
          '<a class="brand" href="/" style="text-decoration:none">' +
            '<span class="mark"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>' +
            ' Mystery Networking</a>' +
          '<span class="grow"></span>' +
          '<span class="label" id="shell-right">' + (o.right || '') + '</span>' +
        '</div>' +
        (o.steps ? '<div class="steps" id="shell-steps" style="width:min(480px,100%);margin:0 auto;padding:0 24px 12px">' +
          '<span class="step"><i></i></span><span class="step"><i></i></span><span class="step"><i></i></span></div>' : '') +
        '</div>' +
        '<div class="shell"><div class="wrap" id="view"></div></div>' +
      '</div>' +
      '<div class="confetti" id="confetti"></div>');
    if (root.GRAIN) GRAIN.speckle(document.getElementById('field'), { density: 1 / 620, colour: '#101014', seed: 20270312 });
    if (root.MOTION) MOTION.pointer();
    return document.getElementById('view');
  }

  function steps(done) {
    const el = document.getElementById('shell-steps');
    if (!el) return;
    for (let i = 0; i < 3; i++) {
      el.children[i].className = 'step' + (i < done ? ' done' : (i === done ? ' now' : ''));
    }
  }

  /** Render markup into the page and start its entrance. */
  function render(html, after) {
    const view = document.getElementById('view');
    view.innerHTML = html;
    if (root.MOTION) {
      MOTION.observe(view);
      MOTION.magnetic(view);
      const h = view.querySelector('h1.display');
      if (h) requestAnimationFrame(() => MOTION.playLines(h, 120));
      const ring = view.querySelector('.ring-wrap');
      if (ring) MOTION.ring(ring, Number(ring.dataset.pct || 0));
    }
    if (root.PIXEL) PIXEL.trackEyes(document);
    if (after) after();
  }

  const avatar = (av, opts) => (av && root.PIXEL) ? PIXEL.svg(av.spec, opts || { level: 3, googly: true }) : '';

  /* ------------------------------ helpers --------------------------- */
  function toast(message, kind) {
    document.querySelectorAll('.app-toast').forEach((t) => t.remove());
    const el = document.createElement('div');
    el.className = 'app-toast note ' + (kind === 'ok' ? 'on' : '');
    el.textContent = message;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 400); }, 3600);
  }

  function confetti(n) {
    const host = document.getElementById('confetti');
    if (!host) return;
    const cols = ['#8B5CF6', '#2FBF87', '#F7A8CF', '#0E0E12', '#FFC93C'];
    for (let i = 0; i < (n || 60); i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + '%';
      p.style.top = (-16 - Math.random() * 50) + 'px';
      p.style.background = cols[i % cols.length];
      p.style.animationDuration = (1.6 + Math.random() * 1.5) + 's';
      p.style.animationDelay = (Math.random() * 0.4) + 's';
      host.appendChild(p);
      setTimeout(() => p.remove(), 4200);
    }
  }

  const escape = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Shrink a chosen photo in the browser; the server only ever stores this. */
  function readPhoto(file, maxSide) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('No file chosen.'));
      if (!/^image\//.test(file.type)) return reject(new Error('That is not an image.'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read that file.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Could not read that image.'));
        img.onload = () => {
          const side = maxSide || 640;
          const scale = Math.min(1, side / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.82));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /** Send everyone to the right page for the state they are in. */
  async function guard(page) {
    let s;
    try { s = await api('/api/session'); } catch (e) { s = { user: null }; }
    const user = s.user;
    const path = location.pathname.replace(/\/$/, '') || '/index.html';
    const at = (p) => path === p || path === p.replace('.html', '');

    if (!user && !at('/index.html') && path !== '/' && !at('/reveal.html')) {
      location.replace('/'); return null;
    }
    if (user && !user.profileDone && !at('/onboarding.html') && !at('/reveal.html')) {
      location.replace('/onboarding.html'); return null;
    }
    if (user && user.profileDone && (at('/index.html') || path === '/')) {
      location.replace('/hub.html'); return null;
    }
    if (page === 'admin' && user && !user.isAdmin) { location.replace('/hub.html'); return null; }
    return s;
  }

  root.APP = { api, shell, render, steps, avatar, toast, confetti, escape, readPhoto, guard };
})(window);
