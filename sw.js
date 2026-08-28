/* ── the service worker ─────────────────────────────────────────────────
   What makes the page install and open with nothing to fetch. Every file
   the loader in index.html names is put in the cache on install, with the
   two pages and the icon; a request is answered from the network first,
   so a deploy shows up on the next load, and from the cache when there is
   no network. The cache-buster's query (`?cb=BUILD.now`) is ignored when
   the cache is asked, because that query is different on every load and
   the cache holds one copy of the file.

   VERSION is bumped by hand with BUILD when the list below changes — a
   worker that does not change is a worker the browser does not replace.
   Registered by index.html only over http(s); a file:// page cannot.  */
const VERSION = 'mq-203';
const FILES = [
  './', './index.html', './platformer.html', './manifest.json', './assets/icon.png',
  './src/store.js', './src/stock.js', './assets/map.js', './src/render.js', './src/lattice.js',
  './src/glyphs.js', './src/kinds.js', './src/panel.js', './src/type.js', './src/title.js',
  './src/frame.js', './src/build.js', './src/markers.js', './src/history.js', './src/loci.js',
  './src/index.js', './src/palace.js', './src/doors.js', './src/interior.js', './src/trace.js',
  './src/basemap.js', './src/hud.js', './src/atlas.js', './src/survey.js', './src/found.js', './src/region.js', './src/distract.js',
  './src/country.js', './src/towns.js', './src/bag.js', './src/missions.js', './src/journal.js',
  './src/focus.js', './src/quest.js', './src/compass-art.js', './src/compass.js', './src/game.js',
  './src/snapshot.js', './src/touch.js', './assets/australia.js'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== 'GET') return;   // fonts, tiles, the geocoder: not ours
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok){ const copy = r.clone(); caches.open(VERSION).then(c => c.put(new Request(u.pathname), copy)); }
      return r;
    }).catch(() => caches.match(e.request, {ignoreSearch: true}))
  );
});
