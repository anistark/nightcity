// Registers the service worker so the site can install as an app and open offline.
// Skipped for pages opened straight from disk, where service workers can't run.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
