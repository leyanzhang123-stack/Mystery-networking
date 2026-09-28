'use strict';
/*
 * The claimable cast. The characters themselves live in public/assets/pixel.js
 * so the browser and the server always agree on who exists; this module just
 * exposes them to the API.
 */
const PIXEL = require('../public/assets/pixel.js');

const COUNT = 60;
const AVATARS = PIXEL.catalogue(COUNT).map((c) => ({
  id: c.id,
  handle: c.handle,
  spec: c.spec
}));

const BY_ID = new Map(AVATARS.map((a) => [a.id, a]));

module.exports = {
  AVATARS,
  COUNT,
  getAvatar: (id) => BY_ID.get(id) || null
};
