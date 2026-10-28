// Service worker that lets Night City install as an app and open offline.
// Same-origin requests go to the network first and fall back to the cache, so updates show up straight away.
// Fonts from other origins rarely change, so they come from the cache once they have been fetched.
// Bump CACHE when the CORE list changes.
const CACHE = 'nightcity-v6';
const CORE = [
  './', 'index.html', 'license.html', '404.html', 'LICENSE', 'manifest.webmanifest', 'embed.js',
  'assets/css/site.css', 'assets/css/scene-ui.css',
  'assets/js/site.js', 'assets/js/beach.js', 'assets/js/pwa.js', 'assets/js/scene-ui.js',
  'assets/images/logo.png', 'assets/images/favicon.png',
  'assets/images/icons/icon-192.png', 'assets/images/icons/icon-512.png', 'assets/images/icons/icon-maskable-512.png', 'assets/images/icons/apple-touch-icon.png',
  'pixel-city/', 'pixel-city/index.html', 'pixel-city/assets/css/style.css', 'pixel-city/assets/js/main.js', 'pixel-city/assets/images/logo.svg',
  'basketball-court/', 'basketball-court/index.html', 'basketball-court/assets/css/style.css', 'basketball-court/assets/js/main.js', 'basketball-court/assets/images/logo.svg',
];
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
