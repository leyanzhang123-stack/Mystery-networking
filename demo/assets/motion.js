/* ------------------------------------------------------------------ *
 * Motion.
 *
 * The polish in a site like this is almost entirely in how things
 * arrive: headlines rise line by line from behind a mask, blocks wipe
 * in rather than fade, screens change behind a curtain, and the pointer
 * is acknowledged. All of it runs on one easing curve.
 * ------------------------------------------------------------------ */
(function (root) {
  'use strict';

  var EASE = 'cubic-bezier(.22,1,.36,1)';
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --------------------------- line masks --------------------------- */
  /** Split a heading into lines and let each one rise from behind a mask. */
  function splitLines(el) {
    if (!el || el.dataset.split === '1') return;
    var html = el.innerHTML;
    var words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map(function (w) { return '<span class="w">' + w + '</span>'; }).join(' ');
    var spans = [].slice.call(el.querySelectorAll('.w'));
    var lines = [], current = null, top = null;
    spans.forEach(function (s) {
      var t = s.offsetTop;
      if (top === null || Math.abs(t - top) > 4) { current = []; lines.push(current); top = t; }
      current.push(s.textContent);
    });
    if (!lines.length) { el.innerHTML = html; return; }
    el.innerHTML = lines.map(function (l) {
      return '<span class="line"><span class="line-i">' + l.join(' ') + '</span></span>';
    }).join('');
    el.dataset.split = '1';
  }

  function playLines(el, delay) {
    if (!el) return;
    splitLines(el);
    var inners = el.querySelectorAll('.line-i');
    for (var i = 0; i < inners.length; i++) {
      var s = inners[i].style;
      s.transitionDelay = ((delay || 0) + i * 85) + 'ms';
      inners[i].classList.add('in');
    }
  }

  /* --------------------------- reveals ------------------------------ */
  function observe(scope) {
    var host = scope || document;
    var items = host.querySelectorAll('[data-rise]');
    if (reduced || !('IntersectionObserver' in window)) {
      for (var i = 0; i < items.length; i++) items[i].classList.add('in');
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var d = Number(e.target.getAttribute('data-rise') || 0);
        e.target.style.transitionDelay = d + 'ms';
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    for (var j = 0; j < items.length; j++) io.observe(items[j]);
  }

  /* --------------------------- curtain ------------------------------ */
  var curtain;
  function transition(render) {
    if (reduced) { render(); return; }
    if (!curtain) {
      curtain = document.createElement('div');
      curtain.className = 'curtain';
      document.body.appendChild(curtain);
    }
    curtain.classList.remove('out');
    curtain.classList.add('in');
    setTimeout(function () {
      render();
      window.scrollTo(0, 0);
      curtain.classList.remove('in');
      curtain.classList.add('out');
    }, 460);
  }

  /* ------------------------ pointer behaviour ----------------------- */
  function pointer() {
    if (reduced || window.matchMedia('(pointer: coarse)').matches) return;
    var ring = document.createElement('div');
    ring.className = 'cursor';
    document.body.appendChild(ring);
    var x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y;
    document.addEventListener('mousemove', function (e) { tx = e.clientX; ty = e.clientY; }, { passive: true });
    (function loop() {
      x += (tx - x) * 0.18; y += (ty - y) * 0.18;
      ring.style.transform = 'translate3d(' + (x - 16) + 'px,' + (y - 16) + 'px,0)';
      requestAnimationFrame(loop);
    })();
    document.addEventListener('mouseover', function (e) {
      var hit = e.target.closest && e.target.closest('button, a, .card, input, textarea');
      ring.classList.toggle('big', !!hit);
    });
  }

  /** Buttons lean towards the pointer. Small move, large effect. */
  function magnetic(scope) {
    if (reduced || window.matchMedia('(pointer: coarse)').matches) return;
    var els = (scope || document).querySelectorAll('[data-magnetic], .btn');
    els.forEach(function (el) {
      if (el.dataset.mag === '1') return;
      el.dataset.mag = '1';
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = 'translate(' + dx * 0.18 + 'px,' + dy * 0.3 + 'px)';
      });
      el.addEventListener('mouseleave', function () { el.style.transform = ''; });
    });
  }

  /* --------------------------- counters ----------------------------- */
  function countUp(el, to, ms) {
    var from = 0, start = null, dur = ms || 1100;
    function step(t) {
      if (!start) start = t;
      var p = Math.min(1, (t - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /** Circular progress meter used by the gamification panel. */
  function ring(el, pct) {
    var c = el.querySelector('.ring-fill');
    if (!c) return;
    var len = 2 * Math.PI * 26;
    c.style.strokeDasharray = len;
    c.style.strokeDashoffset = len;
    requestAnimationFrame(function () {
      c.style.transition = 'stroke-dashoffset 1.1s ' + EASE;
      c.style.strokeDashoffset = len * (1 - pct);
    });
  }

  root.MOTION = {
    playLines: playLines, observe: observe, transition: transition,
    pointer: pointer, magnetic: magnetic, countUp: countUp, ring: ring, reduced: reduced
  };
})(typeof window !== 'undefined' ? window : globalThis);
