#!/usr/bin/env node
/*
 * Builds demo/index.html: one file with the stylesheet, the fonts and every
 * script inlined. The presentation copy has to survive being emailed, dropped
 * on a USB stick or opened from a file viewer that will not serve siblings,
 * so it cannot depend on anything next to it.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'demo', 'src.html');
const OUT = path.join(ROOT, 'demo', 'index.html');
const read = (p) => fs.readFileSync(path.join(ROOT, 'demo', p), 'utf8');

let html = fs.readFileSync(SRC, 'utf8');

// stylesheet, with its @import of the fonts resolved first
html = html.replace(/<link rel="stylesheet" href="([^"]+)" \/>/, (_, href) => {
  let css = read(href);
  css = css.replace(/@import url\('([^']+)'\);/g, (__, rel) =>
    read(path.join(path.dirname(href), rel)));
  return '<style>\n' + css + '\n</style>';
});

// scripts
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) =>
  '<script>\n' + read(src) + '\n</script>');

html = html.replace('<head>', '<head>\n<!-- Built by tools/build-demo.js — edit demo/src.html, not this file. -->');

fs.writeFileSync(OUT, html);

const left = html.match(/(?:src|href)="(?!data:|#)[^"]+"/g) || [];
console.log('demo/index.html written:', (html.length / 1024).toFixed(0) + ' KB');
console.log(left.length ? 'external references left: ' + left.join(', ') : 'no external references');
