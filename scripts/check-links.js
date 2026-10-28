// Checks the built site in _site/: every internal link, script, stylesheet, image and frame must resolve to a file.
// Run after a build with `just check`. Exits with an error listing every broken link.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, extname } from 'node:path';

const SITE = '_site';
// Pages link to folders, never to .html files. The 404 page and forwarding pages are the only .html URLs.
const CLEAN_URLS = true;

const pages = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    // plan/ is only copied in by the local dev server, never deployed.
    if (statSync(p).isDirectory()) { if (relative(SITE, p) !== 'plan') walk(p); }
    else if (extname(name) === '.html') pages.push(p);
  }
})(SITE);

const ATTR = /\s(?:href|src|data-src)=["']([^"']+)["']|http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"']+)["']/gi;
const external = u => /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(u);
const problems = [];
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  // Skip anything inside scripts: those build their own URLs at runtime.
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, m => m.slice(0, m.indexOf('>') + 1));
  for (const m of markup.matchAll(ATTR)) {
    const url = (m[1] || m[2]).trim();
    if (external(url) || url.includes('{{')) continue;
    const path = url.split(/[?#]/)[0];
    if (!path) continue;
    const target = path.startsWith('/') ? join(SITE, path) : join(dirname(page), path);
    const ok = existsSync(target) && (statSync(target).isFile() || existsSync(join(target, 'index.html')));
    if (!ok) problems.push(`${relative(SITE, page)}: broken link ${url}`);
    else if (CLEAN_URLS && path.endsWith('.html') && !path.endsWith('404.html')) problems.push(`${relative(SITE, page)}: links to ${url}, use the folder URL`);
  }
}
if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} problem${problems.length > 1 ? 's' : ''} in ${pages.length} pages`);
  process.exit(1);
}
console.log(`Checked ${pages.length} pages, all links resolve`);
