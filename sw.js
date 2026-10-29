// Service worker that lets Night City install as an app and open offline.
// Same-origin requests go to the network first and fall back to the cache, so updates show up straight away.
// Fonts from other origins rarely change, so they come from the cache once they have been fetched.
// The build fills in CACHE and CORE: every page and file of the site, except share images and forwarding pages.
// CACHE is a hash of their contents, so any change makes a fresh cache.
const CACHE = '__CACHE__';
const CORE = __CORE__;
const FONT_HOSTS = /^(fonts\.googleapis\.com|fonts\.gstatic\.com|pixelspace\.anirudha\.dev)$/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const keep = (req, res) => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; };

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(fetch(req)
      .then(res => res.ok ? keep(req, res) : res)
      .catch(async () => (await caches.match(req, { ignoreSearch: true }))
        || (req.mode === 'navigate' ? caches.match('404.html') : Response.error())));
  } else if (FONT_HOSTS.test(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => keep(req, res))));
  }
});
