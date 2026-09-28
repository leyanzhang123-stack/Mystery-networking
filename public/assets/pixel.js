/* ------------------------------------------------------------------ *
 * Pixel portraits.
 *
 * Each participant gets one 32x32 character, drawn in code: no image
 * assets, and no two people look the same. Shading and the outline are
 * derived automatically from the silhouette, which is what keeps them
 * looking drawn rather than blocky.
 *
 * The same renderer can draw a character at a lower resolution, which
 * is how a mystery connection appears before the reveal.
 * ------------------------------------------------------------------ */
(function (root) {
  'use strict';

  var G = 32;
  var OUTLINE = '#2A2A33';

  // Weighted: the lighter and mid tones repeat, so a wall of 60 characters
  // reads varied instead of being split evenly across seven extremes.
  var SKIN  = ['#FBE3CC', '#FBE3CC', '#F6D7BE', '#F6D7BE', '#F6D7BE', '#EDC5A4', '#EDC5A4',
               '#E0AC7E', '#E0AC7E', '#C08B5E', '#9C6B44', '#7A4F31'];

  // Natural tones, weighted the way a room of students actually looks,
  // with two dyed heads at the end for variety.
  var HAIR  = ['#1F1913', '#1F1913', '#2B2118', '#2B2118', '#3E2C1E', '#3E2C1E',
               '#54381F', '#54381F', '#6F4526', '#6F4526', '#8A5A2B', '#A9743A',
               '#C79A4F', '#D9B677', '#E6D3A8', '#B5563A', '#9A9187', '#C98BA6'];

  // Whole outfits rather than three independent random colours — this is what
  // stops the cast looking like a paint chart.
  var OUTFITS = [
    { wear: '#E9E4DA', legs: '#2E3550', shoe: '#EFECE4' },
    { wear: '#3A3F4A', legs: '#2A2E36', shoe: '#1E2027' },
    { wear: '#8FA68C', legs: '#2F3338', shoe: '#E9E6DE' },
    { wear: '#B5603F', legs: '#2E3550', shoe: '#4A3A2E' },
    { wear: '#39506B', legs: '#C4B79E', shoe: '#2A2E36' },
    { wear: '#B9A7D6', legs: '#33363D', shoe: '#EDEAE2' },
    { wear: '#6E7A55', legs: '#4A4036', shoe: '#2A2620' },
    { wear: '#F2F0EA', legs: '#23252B', shoe: '#B5523F' },
    { wear: '#D8C9A8', legs: '#3E4550', shoe: '#2A2E36' },
    { wear: '#5E6E8C', legs: '#33363D', shoe: '#E9E6DE' },
    { wear: '#C98B8B', legs: '#33363D', shoe: '#EDEAE2' },
    { wear: '#2F5D52', legs: '#37332C', shoe: '#20242A' },
    { wear: '#1F2430', legs: '#4A5266', shoe: '#EFECE4' },
    { wear: '#E3B04B', legs: '#2E3550', shoe: '#2A2E36' },
    { wear: '#7D6B8F', legs: '#2A2E36', shoe: '#E9E6DE' },
    { wear: '#A8B8C4', legs: '#3A3F4A', shoe: '#2A2E36' }
  ];

  var NEUTRAL_TRIM = ['#2A2A33', '#3E3A34', '#E8E4DC', '#C4BDB1', '#6E6A60'];

  var HAIR_STYLES = ['short', 'bob', 'long', 'ponytail', 'curls', 'crop', 'wave', 'bun', 'braids'];
  var EXTRAS = ['none', 'none', 'none', 'none', 'glasses', 'roundGlasses', 'headphones',
                'beanie', 'cap', 'scarf', 'earrings', 'collar'];
  var FACES  = ['smile', 'smile', 'grin', 'soft', 'neutral', 'happy', 'wink'];

  /* 60 quiet one-word handles. Placeholder set — easy to swap. */
  var HANDLES = ['Aurora','Atlas','Harbour','Lantern','Compass','Ember','Meridian','Cove','Beacon','Cinder',
                 'Drift','Fable','Halo','Indigo','Juniper','Kestrel','Lumen','Marlow','Nocturne','Onyx',
                 'Pebble','Quill','Rune','Solstice','Tide','Umber','Vesper','Willow','Zephyr','Alder',
                 'Birch','Cobalt','Dune','Echo','Fjord','Glimmer','Hollow','Isle','Jetty','Kite',
                 'Loom','Mistral','Nimbus','Orbit','Prism','Quartz','Ridge','Sable','Thicket','Tundra',
                 'Verdant','Wharf','Xenon','Yarrow','Zinc','Aster','Bramble','Cairn','Delta','Fathom'];

  /* ------------------------------ colour ---------------------------- */
  function hex2rgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function rgb2hex(c) {
    return '#' + c.map(function (v) {
      v = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return v.length < 2 ? '0' + v : v;
    }).join('');
  }
  function scale(h, f) { return rgb2hex(hex2rgb(h).map(function (v) { return f > 1 ? v + (255 - v) * (f - 1) : v * f; })); }

  /* --------------------------- randomness --------------------------- */
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function picker(seed) {
    var s = hash(String(seed)) || 1;
    return function (list, salt) {
      s = (Math.imul(s ^ hash(salt), 2654435761) >>> 0) || 7;
      return list[s % list.length];
    };
  }
  function spec(seed) {
    var p = picker(seed);
    var outfit = p(OUTFITS, 'outfit');
    var s = {
      seed: String(seed),
      skin: p(SKIN, 'skin'),
      hair: p(HAIR, 'hair'),
      hairStyle: p(HAIR_STYLES, 'style'),
      wear: outfit.wear,
      legs: outfit.legs,
      shoe: outfit.shoe,
      extra: p(EXTRAS, 'extra'),
      face: p(FACES, 'face'),
      trim: p([0, 1, 2], 'trimpick') === 0 ? p(NEUTRAL_TRIM, 'trimn') : null
    };
    if (!s.trim) s.trim = scale(s.wear, 0.62);
    return s;
  }

  /* ----------------------------- drawing ---------------------------- */
  function blank() {
    var g = new Array(G);
    for (var y = 0; y < G; y++) { g[y] = new Array(G); for (var x = 0; x < G; x++) g[y][x] = null; }
    return g;
  }
  function box(g, x0, y0, x1, y1, c) {
    for (var y = Math.max(0, y0); y <= Math.min(G - 1, y1); y++)
      for (var x = Math.max(0, x0); x <= Math.min(G - 1, x1); x++) g[y][x] = c;
  }

  var EYE = { l: [11, 10], r: [18, 10] }; // top-left of each 3x3 eye

  function body(s) {
    var g = blank();
    var hairDark = scale(s.hair, 0.78);
    var hairLight = scale(s.hair, 1.22);
    var skinShade = scale(s.skin, 0.9);

    // long hair sits behind the head
    if (s.hairStyle === 'long' || s.hairStyle === 'wave' || s.hairStyle === 'braids') {
      box(g, 7, 6, 8, 22, s.hair); box(g, 23, 6, 24, 22, s.hair);
      if (s.hairStyle === 'braids') { box(g, 6, 14, 8, 22, s.hair); box(g, 23, 14, 25, 22, s.hair); }
    }

    // legs and shoes
    box(g, 11, 26, 14, 29, s.legs);
    box(g, 17, 26, 20, 29, s.legs);
    box(g, 10, 30, 14, 31, s.shoe);
    box(g, 17, 30, 21, 31, s.shoe);

    // torso and arms
    box(g, 12, 19, 19, 19, s.wear);          // sloped shoulders read better than a slab
    box(g, 10, 20, 21, 26, s.wear);
    box(g, 8, 21, 9, 26, s.wear);
    box(g, 22, 21, 23, 26, s.wear);
    box(g, 8, 27, 9, 28, s.skin);
    box(g, 22, 27, 23, 28, s.skin);

    // neck and head
    box(g, 14, 17, 17, 19, skinShade);
    box(g, 9, 4, 22, 17, s.skin);
    box(g, 8, 10, 8, 13, s.skin);   // ears
    box(g, 23, 10, 23, 13, s.skin);

    // hair on top
    switch (s.hairStyle) {
      case 'crop':
        box(g, 9, 3, 22, 6, s.hair); break;
      case 'bob':
        box(g, 9, 2, 22, 6, s.hair); box(g, 8, 4, 8, 12, s.hair); box(g, 23, 4, 23, 12, s.hair); break;
      case 'long':
        box(g, 9, 2, 22, 6, s.hair); box(g, 8, 4, 8, 14, s.hair); box(g, 23, 4, 23, 14, s.hair); break;
      case 'ponytail':
        box(g, 9, 2, 22, 6, s.hair); box(g, 23, 4, 25, 7, s.hair); box(g, 24, 7, 25, 15, s.hair); break;
      case 'curls':
        box(g, 8, 1, 23, 6, s.hair); box(g, 7, 3, 7, 9, s.hair); box(g, 24, 3, 24, 9, s.hair);
        box(g, 10, 0, 21, 1, s.hair); break;
      case 'wave':
        box(g, 9, 2, 22, 6, s.hair); box(g, 8, 3, 8, 13, s.hair); box(g, 23, 3, 23, 13, s.hair);
        box(g, 10, 1, 17, 2, s.hair); break;
      case 'bun':
        box(g, 9, 3, 22, 6, s.hair); box(g, 13, 0, 18, 2, s.hair); break;
      case 'braids':
        box(g, 9, 2, 22, 6, s.hair); box(g, 8, 4, 8, 13, s.hair); box(g, 23, 4, 23, 13, s.hair); break;
      default: // short
        box(g, 9, 2, 22, 6, s.hair); box(g, 8, 4, 8, 9, s.hair); box(g, 23, 4, 23, 9, s.hair);
    }
    box(g, 11, 2, 15, 3, hairLight); // a soft highlight so hair is not a flat block
    box(g, 9, 6, 22, 6, hairDark);

    // face — expression varies per character so nobody looks embalmed
    var lip = scale(s.skin, 0.62);
    var blush = scale(s.skin, 0.9);
    var f = s.face;

    if (f === 'happy') {                       // closed, smiling eyes
      box(g, 11, 11, 11, 11, OUTLINE); box(g, 12, 10, 12, 10, OUTLINE); box(g, 13, 11, 13, 11, OUTLINE);
      box(g, 18, 11, 18, 11, OUTLINE); box(g, 19, 10, 19, 10, OUTLINE); box(g, 20, 11, 20, 11, OUTLINE);
    } else {
      box(g, EYE.l[0], EYE.l[1], EYE.l[0] + 2, EYE.l[1] + 2, '#FFFFFF');
      box(g, EYE.l[0] + 1, EYE.l[1] + 1, EYE.l[0] + 2, EYE.l[1] + 2, OUTLINE);
      if (f === 'wink') {
        box(g, 18, 11, 20, 11, OUTLINE);       // one eye shut
      } else {
        box(g, EYE.r[0], EYE.r[1], EYE.r[0] + 2, EYE.r[1] + 2, '#FFFFFF');
        box(g, EYE.r[0], EYE.r[1] + 1, EYE.r[0] + 1, EYE.r[1] + 2, OUTLINE);
      }
    }

    // brows sit a little differently depending on the expression
    if (f === 'grin' || f === 'happy') {
      box(g, 11, 7, 13, 7, hairDark); box(g, 18, 7, 20, 7, hairDark);
    } else if (f === 'wink') {
      box(g, 11, 8, 13, 8, hairDark); box(g, 18, 7, 20, 7, hairDark);
    } else {
      box(g, 11, 8, 13, 8, hairDark); box(g, 18, 8, 20, 8, hairDark);
    }

    box(g, 15, 13, 16, 13, scale(s.skin, 0.88));           // nose

    switch (f) {
      case 'grin':
        box(g, 14, 15, 17, 15, lip); box(g, 15, 16, 16, 16, lip);
        box(g, 15, 15, 16, 15, '#FFFFFF');
        break;
      case 'smile':
      case 'happy':
        box(g, 14, 15, 14, 15, lip); box(g, 17, 15, 17, 15, lip); box(g, 15, 16, 16, 16, lip);
        break;
      case 'wink':
        box(g, 15, 15, 17, 15, lip); box(g, 17, 16, 17, 16, lip);
        break;
      case 'soft':
        box(g, 15, 15, 16, 15, lip); box(g, 17, 14, 17, 14, lip);
        break;
      default:
        box(g, 15, 15, 16, 15, lip);
    }

    if (f === 'smile' || f === 'grin' || f === 'happy') {
      box(g, 10, 13, 11, 13, blush); box(g, 20, 13, 21, 13, blush);
    }

    // extras
    var t = s.trim;
    switch (s.extra) {
      case 'glasses':
        box(g, 10, 9, 14, 9, t); box(g, 17, 9, 21, 9, t);
        box(g, 10, 9, 10, 13, t); box(g, 14, 9, 14, 13, t);
        box(g, 17, 9, 17, 13, t); box(g, 21, 9, 21, 13, t);
        box(g, 10, 13, 14, 13, t); box(g, 17, 13, 21, 13, t); box(g, 15, 10, 16, 10, t);
        break;
      case 'roundGlasses':
        box(g, 11, 9, 13, 9, t); box(g, 18, 9, 20, 9, t);
        box(g, 10, 10, 10, 12, t); box(g, 14, 10, 14, 12, t);
        box(g, 17, 10, 17, 12, t); box(g, 21, 10, 21, 12, t);
        box(g, 11, 13, 13, 13, t); box(g, 18, 13, 20, 13, t); box(g, 15, 11, 16, 11, t);
        break;
      case 'headphones':
        box(g, 6, 8, 8, 13, t); box(g, 23, 8, 25, 13, t);
        box(g, 7, 1, 7, 7, t); box(g, 24, 1, 24, 7, t); box(g, 8, 0, 23, 1, t);
        break;
      case 'beanie':
        box(g, 9, 1, 22, 5, t); box(g, 8, 4, 23, 5, scale(t, 0.85)); box(g, 14, 0, 17, 1, t); break;
      case 'cap':
        box(g, 9, 1, 22, 5, t); box(g, 9, 6, 26, 7, scale(t, 0.85)); break;
      case 'scarf':
        box(g, 11, 17, 20, 19, t); box(g, 12, 20, 14, 24, scale(t, 0.9)); break;
      case 'earrings':
        box(g, 8, 14, 8, 15, t); box(g, 23, 14, 23, 15, t); break;
      case 'collar':
        box(g, 12, 19, 19, 20, scale(s.wear, 1.3)); box(g, 15, 20, 16, 22, t); break;
    }
    return g;
  }

  /** Volume without hand-painting it: edges facing away from the light go darker. */
  function shade(g) {
    var out = blank();
    for (var y = 0; y < G; y++) for (var x = 0; x < G; x++) {
      var c = g[y][x];
      if (!c) continue;
      if (c === OUTLINE || c === '#FFFFFF') { out[y][x] = c; continue; }
      var rightEmpty = x === G - 1 || !g[y][x + 1];
      var belowEmpty = y === G - 1 || !g[y + 1][x];
      var leftEmpty = x === 0 || !g[y][x - 1];
      if (rightEmpty) out[y][x] = scale(c, 0.82);
      else if (belowEmpty) out[y][x] = scale(c, 0.88);
      else if (leftEmpty) out[y][x] = scale(c, 1.1);
      else out[y][x] = c;
    }
    return out;
  }

  /** One-pixel outline around the silhouette. */
  function outline(g) {
    var out = g.map(function (r) { return r.slice(); });
    for (var y = 0; y < G; y++) for (var x = 0; x < G; x++) {
      if (g[y][x]) continue;
      var near = (y > 0 && g[y - 1][x]) || (y < G - 1 && g[y + 1][x]) ||
                 (x > 0 && g[y][x - 1]) || (x < G - 1 && g[y][x + 1]);
      if (near) out[y][x] = OUTLINE;
    }
    return out;
  }

  function draw(s) { return outline(shade(body(s))); }

  /* ------------------------ resolution levels ----------------------- */
  function mix(list) {
    var r = 0, g = 0, b = 0, n = 0;
    for (var i = 0; i < list.length; i++) {
      if (!list[i]) continue;
      var c = hex2rgb(list[i]); r += c[0]; g += c[1]; b += c[2]; n++;
    }
    return n ? rgb2hex([r / n, g / n, b / n]) : null;
  }
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
  var RESOLUTION = [8, 4, 2, 1]; // 4x4 blocks -> full portrait

  /**
   * Inline SVG for a character.
   *   opts.level  0-3, how resolved it is (3 = sharp)
   *   opts.googly pupils follow the pointer (sharp only)
   *   opts.size   css pixel size
   */
  function svg(s, opts) {
    opts = opts || {};
    var level = opts.level == null ? 3 : Math.max(0, Math.min(3, opts.level));
    var block = RESOLUTION[level];
    var grid = downsample(draw(s), block);
    var n = grid.length, unit = G / n, parts = [];
    var gap = block > 1 ? 0.35 : 0;

    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var c = grid[y][x];
      if (!c) continue;
      if (block === 1 && opts.googly && c === '#FFFFFF') continue;
      parts.push('<rect x="' + (x * unit + gap / 2) + '" y="' + (y * unit + gap / 2) +
                 '" width="' + (unit - gap) + '" height="' + (unit - gap) + '" fill="' + c + '"/>');
    }
    if (block === 1 && opts.googly) parts.push(eyeMarkup(EYE.l), eyeMarkup(EYE.r));

    var size = opts.size ? 'width="' + opts.size + '" height="' + opts.size + '"' : 'width="100%" height="100%"';
    return '<svg class="px" viewBox="0 0 ' + G + ' ' + G + '" ' + size +
           ' shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
           parts.join('') + '</svg>';
  }
  function eyeMarkup(p) {
    return '<g><rect x="' + p[0] + '" y="' + p[1] + '" width="3" height="3" fill="#FFFFFF"/>' +
      '<rect class="px-pupil" x="' + (p[0] + 0.6) + '" y="' + (p[1] + 1) + '" width="2" height="2" fill="' + OUTLINE + '"/></g>';
  }

  function trackEyes(scope) {
    var host = scope || document;
    if (host.__pxEyes) return; host.__pxEyes = true;
    function move(cx, cy) {
      var pupils = document.querySelectorAll('.px-pupil');
      for (var i = 0; i < pupils.length; i++) {
        var r = pupils[i].getBoundingClientRect();
        if (!r.width) continue;
        var dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
        var d = Math.sqrt(dx * dx + dy * dy) || 1;
        pupils[i].setAttribute('transform',
          'translate(' + (dx / d * 0.55).toFixed(2) + ',' + (dy / d * 0.45).toFixed(2) + ')');
      }
    }
    window.addEventListener('mousemove', function (e) { move(e.clientX, e.clientY); }, { passive: true });
    window.addEventListener('touchmove', function (e) {
      if (e.touches[0]) move(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
  }

  /** The fixed cast every participant claims from — an even, designed spread. */
  function catalogue(count) {
    count = count || 60;
    var out = [];
    for (var i = 0; i < count; i++) {
      var handle = HANDLES[i % HANDLES.length] + (i >= HANDLES.length ? ' ' + (Math.floor(i / HANDLES.length) + 1) : '');
      var outfit = OUTFITS[(i * 7) % OUTFITS.length];
      var character = {
        seed: 'px' + (i + 1),
        skin: SKIN[(i * 5) % SKIN.length],
        hair: HAIR[(i * 11) % HAIR.length],
        hairStyle: HAIR_STYLES[(i * 4 + Math.floor(i / 9)) % HAIR_STYLES.length],
        wear: outfit.wear,
        legs: outfit.legs,
        shoe: outfit.shoe,
        extra: EXTRAS[(i * 5 + 3) % EXTRAS.length],
        face: FACES[(i * 3 + 1) % FACES.length],
        trim: null
      };
      character.trim = (i % 4 === 0) ? NEUTRAL_TRIM[(i / 4) % NEUTRAL_TRIM.length] : scale(character.wear, 0.62);
      out.push({ id: 'px' + (i + 1), handle: handle, spec: character });
    }
    return out;
  }

  root.PIXEL = { spec: spec, draw: draw, svg: svg, trackEyes: trackEyes, catalogue: catalogue, RESOLUTION: RESOLUTION };
})(typeof window !== 'undefined' ? window : globalThis);

if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.PIXEL;
