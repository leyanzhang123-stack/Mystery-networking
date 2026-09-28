/* ------------------------------------------------------------------ *
 * Ink speckle.
 *
 * Irregular black specks scattered over the page, the way printed
 * risograph paper looks. Drawn once onto a canvas from a fixed seed so
 * it never flickers and never repeats as a tile.
 * ------------------------------------------------------------------ */
(function (root) {
  'use strict';

  function rng(seed) {
    var s = seed || 42;
    return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  }

  function speckle(canvas, options) {
    var o = options || {};
    var density = o.density || 1 / 620;      // specks per square pixel
    var colour = o.colour || '#101014';
    var ctx = canvas.getContext('2d');

    function draw() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = colour;

      var r = rng(o.seed || 1337);
      var count = Math.round(w * h * density);
      for (var i = 0; i < count; i++) {
        var x = r() * w, y = r() * h;
        var t = r();
        // mostly tiny specks, a few bigger ones, occasional short flick
        var rad = t > 0.97 ? 1.5 + r() * 1.1 : (t > 0.8 ? 0.8 + r() * 0.5 : 0.35 + r() * 0.4);
        ctx.globalAlpha = 0.45 + r() * 0.5;
        ctx.beginPath();
        if (t > 0.94) {
          ctx.ellipse(x, y, rad * (1 + r()), rad * 0.6, r() * Math.PI, 0, 6.283);
        } else {
          ctx.arc(x, y, rad, 0, 6.283);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    draw();
    var t;
    window.addEventListener('resize', function () {
      clearTimeout(t); t = setTimeout(draw, 180);
    }, { passive: true });
  }

  root.GRAIN = { speckle: speckle };
})(typeof window !== 'undefined' ? window : globalThis);
