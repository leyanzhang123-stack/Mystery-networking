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
const read = (p) => fs.readFileSync(path.join(ROOT, 'demo', p), 'utf8');

// every presentation page: [source, output]
const PAGES = [
  ['src.html', 'index.html'],
  ['team-cafe-src.html', 'team-cafe.html'],
  ['team-cafe-slide-src.html', 'team-cafe-slide.html'],
];

for (const [srcName, outName] of PAGES) build(srcName, outName);

function build(srcName, outName) {
const SRC = path.join(ROOT, 'demo', srcName);
const OUT = path.join(ROOT, 'demo', outName);
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

// audio, as a data URI — the presentation copy must not need a server
html = html.replace(/src="([^"]+\.mp3)"/g, (_, src) => {
  const data = fs.readFileSync(path.join(ROOT, 'demo', src)).toString('base64');
  return 'src="data:audio/mpeg;base64,' + data + '"';
});

html = html.replace('<head>', '<head>\n<!-- Built by tools/build-demo.js — edit demo/'+srcName+', not this file. -->');

fs.writeFileSync(OUT, html);

const left = html.match(/(?:src|href)="(?!data:|#)[^"]+"/g) || [];
console.log('demo/' + outName + ' written:', (html.length / 1024).toFixed(0) + ' KB');
console.log(left.length ? 'external references left: ' + left.join(', ') : 'no external references');
}
