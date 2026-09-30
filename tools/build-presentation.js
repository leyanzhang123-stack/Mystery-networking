#!/usr/bin/env node
/*
 * Builds presentation/index.html: the RESTO 2027 deck as one file.
 *
 * The deck is sent to a teacher as a single attachment and opened from
 * their disk, so everything it needs travels inside it: the fonts, the
 * images, and full copies of both prototypes (the Team Online Café wheel
 * and the Mystery Networking demo), which open in an overlay without a
 * network connection.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'presentation', 'src.html');
const OUT = path.join(ROOT, 'presentation', 'index.html');
const readRoot = (p) => fs.readFileSync(path.join(ROOT, p));

let html = fs.readFileSync(SRC, 'utf8');

// Fonts: reuse the self-hosted faces the prototypes already carry, so the
// deck and the prototypes share one typeface family.
const cafe = readRoot('demo/team-cafe.html').toString('utf8');
const WANT = ['Archivo', 'Inter', 'Instrument Serif'];
const faces = (cafe.match(/@font-face\s*\{[^}]*\}/g) || [])
  .filter((f) => WANT.some((name) => f.includes(`'${name}'`)));
if (faces.length < WANT.length) throw new Error('fonts not found in demo/team-cafe.html');
html = html.replace('/*@FONTS@*/', faces.join('\n'));

// Images, as data URIs.
html = html.replace(/(["(])assets\/([\w.-]+\.(jpg|png|svg))/g, (_, q, file, ext) => {
  const type = { jpg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml' }[ext];
  const data = readRoot(path.join('presentation', 'assets', file)).toString('base64');
  return `${q}data:${type};base64,${data}`;
});

// Prototypes, base64-encoded so no byte of them can close the host's tags.
html = html.replace(/<!--@EMBED ([\w-]+) ([\w/.-]+)@-->/g, (_, id, file) =>
  `<script type="text/plain" id="proto-${id}">${readRoot(file).toString('base64')}</script>`);

html = html.replace('<head>', '<head>\n<!-- Built by tools/build-presentation.js — edit presentation/src.html, not this file. -->');

fs.writeFileSync(OUT, html);

const left = html.match(/(?:src|href)="(?!data:|#|https?:)[^"]+"/g) || [];
console.log('presentation/index.html written:', (html.length / 1024).toFixed(0) + ' KB');
console.log(left.length ? 'local references left: ' + left.join(', ') : 'no local references');
