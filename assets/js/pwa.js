// Registers the service worker so the site can install as an app and open offline.
// sw.js sits at the site root, two folders up from this script, whatever folder the page is in.
// Skipped for pages opened straight from disk, where service workers can't run.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const sw = new URL('../../sw.js', document.currentScript.src);
  addEventListener('load', () => navigator.serviceWorker.register(sw).catch(() => {}));
}
