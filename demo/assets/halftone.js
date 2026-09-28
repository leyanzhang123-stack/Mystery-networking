/* ------------------------------------------------------------------ *
 * A slow halftone field for the page background.
 *
 * A grid of dots whose radius is driven by a few layered sine waves, so
 * soft ribbons drift across the page forever without repeating in any
 * way the eye can catch. Cheap enough to leave running on a projector.
 * ------------------------------------------------------------------ */
(function (root) {
  'use strict';

  function mount(canvas, options) {
    var opts = options || {};
    var gap = opts.gap || 15;          // distance between dots
    var maxR = opts.maxR || 3.1;       // biggest dot radius
    var speed = opts.speed || 0.00013;
    var colour = opts.colour || '255,255,255';
    var ctx = canvas.getContext('2d', { alpha: true });
    var w = 0, h = 0, cols = 0, rows = 0, raf = 0, running = true;

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / gap) + 1; rows = Math.ceil(h / gap) + 1;
    }

    function frame(t) {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      var time = t * speed;
      for (var y = 0; y < rows; y++) {
        var py = y * gap;
        for (var x = 0; x < cols; x++) {
          var px = x * gap;
          // three drifting waves at different angles make the ribbons
          var v = Math.sin(px * 0.006 + time * 1.7) +
                  Math.sin((px * 0.0025 - py * 0.004) + time * 2.3) +
                  Math.sin((px * 0.0015 + py * 0.0055) - time * 1.1);
          v = (v + 3) / 6;                         // 0..1
          var r = Math.pow(v, 2.4) * maxR;
          if (r < 0.28) continue;
          ctx.fillStyle = 'rgba(' + colour + ',' + (0.05 + v * 0.30).toFixed(3) + ')';
          ctx.beginPath();
          ctx.arc(px, py, r, 0, 6.283);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      frame(0); running = false; cancelAnimationFrame(raf);   // draw one still frame
    } else {
      raf = requestAnimationFrame(frame);
    }
    return { stop: function () { running = false; cancelAnimationFrame(raf); } };
  }

  /** Reveal elements as they scroll into view, in the order they appear. */
  function reveals(selector) {
    var items = document.querySelectorAll(selector || '[data-reveal]');
    if (!('IntersectionObserver' in window)) {
      for (var i = 0; i < items.length; i++) items[i].classList.add('in');
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var delay = Number(e.target.getAttribute('data-reveal-delay') || 0);
        setTimeout(function () { e.target.classList.add('in'); }, delay);
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    for (var j = 0; j < items.length; j++) io.observe(items[j]);
  }

  root.HALFTONE = { mount: mount, reveals: reveals };
})(typeof window !== 'undefined' ? window : globalThis);
