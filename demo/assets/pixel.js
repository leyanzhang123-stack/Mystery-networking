/* ------------------------------------------------------------------ *
 * Pixel people.
 *
 * Every participant gets one 16x16 pixel character, drawn entirely in
 * code, so there are no image assets to lose and every character is
 * unique. The same renderer draws them "unresolved" — downsampled into
 * big colour blocks — which is how a mystery connection appears before
 * the reveal.
 * ------------------------------------------------------------------ */
(function (root) {
  'use strict';

  var G = 16; // grid is 16 x 16

  var SKIN   = ['#FBDCC0', '#F4C9A3', '#E0AC7E', '#C3885B', '#9B663F', '#74492C', '#54341F'];
  var HAIR   = ['#241B14', '#4A2F1C', '#8C5525', '#D39B3C', '#EFE7D8', '#8C3F36', '#2F4E9E',
                '#7A3F8F', '#1F8A78', '#D6457F', '#464B55', '#F3A6C4', '#37B6E8', '#6BBF59'];
  var TOP    = ['#3E9BE9', '#F2C230', '#E86AB4', '#F07C2C', '#5FC9C9', '#7C6BE8',
                '#4CAF6B', '#E4574C', '#2E4A7D', '#F7F3EA', '#9BD45F', '#B98CE8'];
  var PANTS  = ['#2E3A4C', '#3F5A8A', '#6B4F7A', '#37474F', '#7A5B3C', '#525863'];
  var SHOES  = ['#1E2430', '#E4574C', '#F5F1E6', '#3E9BE9', '#F2C230'];
  var ACCENT = ['#1E2430', '#E4574C', '#3E9BE9', '#F2C230', '#E86AB4', '#5FC9C9', '#F07C2C', '#7C6BE8'];

  var HAIR_STYLES = ['short', 'bob', 'long', 'ponytail', 'buzz', 'afro', 'spiky', 'bun'];
  var ACCESSORIES = ['none', 'none', 'glasses', 'shades', 'headphones', 'beanie', 'cap', 'scarf', 'earrings', 'bloom'];

  var ADJECTIVES = ['Turbo', 'Velvet', 'Midnight', 'Neon', 'Rusty', 'Cosmic', 'Quiet', 'Reckless',
                    'Glitchy', 'Polite', 'Sleepy', 'Sudden', 'Humble', 'Electric', 'Wandering', 'Feral',
                    'Golden', 'Crooked', 'Pocket', 'Thunder'];
  var NOUNS = ['Comet', 'Kettle', 'Lighthouse', 'Tram', 'Pinecone', 'Postcard', 'Compass', 'Sockpuppet',
               'Harbour', 'Blizzard', 'Dynamo', 'Lantern', 'Sauna', 'Ferry', 'Anchor', 'Aurora',
               'Cobblestone', 'Windmill', 'Doorbell', 'Paperclip', 'Telescope', 'Jukebox', 'Mitten', 'Sparrow',
               'Cassette', 'Snowplough', 'Bicycle', 'Balcony', 'Postbox', 'Typewriter'];

  /* deterministic small hash so a seed always gives the same character */
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0);
  }
  function picker(seed) {
    var s = hash(String(seed)) || 1;
    return function (list, salt) {
      s = (Math.imul(s ^ hash(salt || ''), 2654435761) >>> 0) || 7;
      return list[s % list.length];
    };
  }

  /** Build the full spec for a character from a seed string. */
  function spec(seed) {
    var p = picker(seed);
    return {
      seed: String(seed),
      skin: p(SKIN, 'skin'),
      hair: p(HAIR, 'hair'),
      hairStyle: p(HAIR_STYLES, 'style'),
      top: p(TOP, 'top'),
      pants: p(PANTS, 'pants'),
      shoes: p(SHOES, 'shoes'),
      accessory: p(ACCESSORIES, 'acc'),
      accent: p(ACCENT, 'accent')
    };
  }

  /* ---------------------------- drawing ---------------------------- */
  function blankGrid() {
    var g = new Array(G);
    for (var y = 0; y < G; y++) { g[y] = new Array(G); for (var x = 0; x < G; x++) g[y][x] = null; }
    return g;
  }
  function box(g, x0, y0, x1, y1, colour) {
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      if (y >= 0 && y < G && x >= 0 && x < G) g[y][x] = colour;
    }
  }
  var EYES = { left: [5, 6], right: [9, 6] }; // top-left corner of each 2x2 eye

  function draw(s) {
    var g = blankGrid();

    // head, neck, torso, arms, legs
    box(g, 4, 3, 11, 9, s.skin);
    box(g, 7, 10, 8, 10, s.skin);
    box(g, 5, 11, 10, 13, s.top);
    box(g, 4, 11, 4, 12, s.top);
    box(g, 11, 11, 11, 12, s.top);
    box(g, 4, 13, 4, 13, s.skin);
    box(g, 11, 13, 11, 13, s.skin);
    box(g, 5, 14, 6, 14, s.pants);
    box(g, 9, 14, 10, 14, s.pants);
    box(g, 5, 15, 6, 15, s.shoes);
    box(g, 9, 15, 10, 15, s.shoes);

    // hair
    var h = s.hair;
    switch (s.hairStyle) {
      case 'buzz':
        box(g, 4, 2, 11, 3, h); break;
      case 'bob':
        box(g, 4, 1, 11, 3, h); box(g, 3, 2, 3, 7, h); box(g, 12, 2, 12, 7, h); break;
      case 'long':
        box(g, 4, 1, 11, 3, h); box(g, 3, 2, 3, 10, h); box(g, 12, 2, 12, 10, h); break;
      case 'ponytail':
        box(g, 4, 1, 11, 3, h); box(g, 12, 2, 13, 3, h); box(g, 13, 3, 13, 8, h); break;
      case 'afro':
        box(g, 3, 1, 12, 3, h); box(g, 2, 2, 2, 5, h); box(g, 13, 2, 13, 5, h); box(g, 4, 0, 11, 0, h); break;
      case 'spiky':
        box(g, 4, 2, 11, 3, h);
        for (var x = 4; x <= 11; x += 2) box(g, x, 1, x, 1, h);
        break;
      case 'bun':
        box(g, 4, 1, 11, 3, h); box(g, 7, 0, 8, 0, h); box(g, 6, 1, 9, 1, h); break;
      default: // short
        box(g, 4, 1, 11, 3, h); box(g, 3, 2, 3, 4, h); box(g, 12, 2, 12, 4, h);
    }

    // face
    box(g, EYES.left[0], EYES.left[1], EYES.left[0] + 1, EYES.left[1] + 1, '#FFFFFF');
    box(g, EYES.right[0], EYES.right[1], EYES.right[0] + 1, EYES.right[1] + 1, '#FFFFFF');
    g[EYES.left[1] + 1][EYES.left[0] + 1] = '#1E2430';
    g[EYES.right[1] + 1][EYES.right[0]] = '#1E2430';
    box(g, 7, 8, 8, 8, '#C9736B'); // mouth

    // accessory
    var a = s.accent;
    switch (s.accessory) {
      case 'glasses':
        box(g, 4, 6, 4, 7, a); box(g, 7, 6, 7, 7, a); box(g, 8, 6, 8, 7, a); box(g, 11, 6, 11, 7, a);
        box(g, 5, 5, 6, 5, a); box(g, 9, 5, 10, 5, a); box(g, 7, 6, 8, 6, a);
        break;
      case 'shades':
        box(g, 4, 6, 11, 7, a); box(g, 5, 5, 6, 5, a); box(g, 9, 5, 10, 5, a); break;
      case 'headphones':
        box(g, 3, 4, 3, 7, a); box(g, 12, 4, 12, 7, a); box(g, 4, 0, 11, 0, a); box(g, 3, 1, 3, 3, a); box(g, 12, 1, 12, 3, a);
        break;
      case 'beanie':
        box(g, 4, 1, 11, 3, a); box(g, 3, 3, 12, 3, a); box(g, 7, 0, 8, 0, a); break;
      case 'cap':
        box(g, 4, 1, 11, 3, a); box(g, 4, 4, 13, 4, a); break;
      case 'scarf':
        box(g, 5, 10, 10, 10, a); box(g, 5, 11, 5, 12, a); break;
      case 'earrings':
        g[7][3] = a; g[7][12] = a; break;
      case 'bloom':
        g[2][3] = a; g[3][3] = a; g[2][2] = a; break;
    }
    return g;
  }

  /* ------------------------- pixel resolution ----------------------- */
  function mix(colours) {
    var r = 0, g = 0, b = 0, n = 0;
    for (var i = 0; i < colours.length; i++) {
      var c = colours[i]; if (!c) continue;
      r += parseInt(c.slice(1, 3), 16); g += parseInt(c.slice(3, 5), 16); b += parseInt(c.slice(5, 7), 16); n++;
    }
    if (!n) return null;
    var hex = function (v) { v = Math.round(v / n).toString(16); return v.length < 2 ? '0' + v : v; };
    return '#' + hex(r) + hex(g) + hex(b);
  }
  /** block = 1 is the sharp character; 8 is four unreadable colour blobs. */
  function downsample(grid, block) {
    if (block <= 1) return grid;
    var out = [];
    for (var y = 0; y < G; y += block) {
      var row = [];
      for (var x = 0; x < G; x += block) {
        var bucket = [];
        for (var dy = 0; dy < block; dy++) for (var dx = 0; dx < block; dx++) bucket.push(grid[y + dy][x + dx]);
        row.push(mix(bucket));
      }
      out.push(row);
    }
    return out;
  }

  var RESOLUTION = [8, 4, 2, 1]; // level 0 .. 3

  /**
   * Render a character as inline SVG.
   *   opts.level   0-3, how resolved the character is (default 3 = sharp)
   *   opts.googly  eyes follow the pointer (only when fully resolved)
   *   opts.size    css size in px
   */
  function svg(s, opts) {
    opts = opts || {};
    var level = opts.level == null ? 3 : Math.max(0, Math.min(3, opts.level));
    var block = RESOLUTION[level];
    var grid = downsample(draw(s), block);
    var n = grid.length;
    var unit = G / n;
    var parts = [];
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var c = grid[y][x];
      if (!c) continue;
      var isEye = block === 1 && c === '#FFFFFF';
      if (isEye && opts.googly) continue; // drawn as a tracking eye below
      var gap = block > 1 ? 0.22 : 0; // low-res blocks sit apart, like a half-loaded image
      parts.push('<rect x="' + (x * unit + gap / 2) + '" y="' + (y * unit + gap / 2) +
                 '" width="' + (unit - gap) + '" height="' + (unit - gap) + '" rx="' + (block > 1 ? 0.25 : 0) +
                 '" fill="' + c + '"/>');
    }
    if (block === 1 && opts.googly) {
      parts.push(eye(EYES.left), eye(EYES.right));
    }
    var size = opts.size ? ('width="' + opts.size + '" height="' + opts.size + '"') : 'width="100%" height="100%"';
    return '<svg class="px" viewBox="0 0 ' + G + ' ' + G + '" ' + size +
           ' shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
           parts.join('') + '</svg>';
  }
  function eye(pos) {
    return '<g class="px-eye">' +
      '<rect x="' + pos[0] + '" y="' + pos[1] + '" width="2" height="2" fill="#FFFFFF"/>' +
      '<rect class="px-pupil" x="' + (pos[0] + 0.5) + '" y="' + (pos[1] + 0.5) + '" width="1" height="1" fill="#1E2430"/>' +
      '</g>';
  }

  /** Make every pupil on the page follow the pointer. Call once. */
  function trackEyes(scope) {
    var host = scope || document;
    function move(clientX, clientY) {
      var pupils = host.querySelectorAll('.px-pupil');
      for (var i = 0; i < pupils.length; i++) {
        var p = pupils[i];
        var r = p.getBoundingClientRect();
        if (!r.width) continue;
        var dx = clientX - (r.left + r.width / 2);
        var dy = clientY - (r.top + r.height / 2);
        var d = Math.sqrt(dx * dx + dy * dy) || 1;
        p.setAttribute('transform', 'translate(' + (dx / d * 0.5).toFixed(2) + ',' + (dy / d * 0.5).toFixed(2) + ')');
      }
    }
    window.addEventListener('mousemove', function (e) { move(e.clientX, e.clientY); }, { passive: true });
    window.addEventListener('touchmove', function (e) {
      if (e.touches[0]) move(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
  }

  /* --------------------------- the cast ---------------------------- */
  function codename(i) {
    var a = ADJECTIVES[i % ADJECTIVES.length];
    var n = NOUNS[(i * 7 + Math.floor(i / NOUNS.length)) % NOUNS.length];
    return a + ' ' + n;
  }
  /** The fixed catalogue every participant claims from. */
  function catalogue(count) {
    var out = [], used = {}, i = 0;
    while (out.length < (count || 60)) {
      var name = codename(i);
      if (!used[name]) {
        used[name] = true;
        out.push({ id: 'px' + (out.length + 1), codename: name, spec: spec('px' + (out.length + 1) + '|' + name) });
      }
      i++;
      if (i > 5000) break;
    }
    return out;
  }

  root.PIXEL = {
    spec: spec, svg: svg, draw: draw, trackEyes: trackEyes,
    catalogue: catalogue, codename: codename, RESOLUTION: RESOLUTION
  };
})(typeof window !== 'undefined' ? window : globalThis);

if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.PIXEL;
