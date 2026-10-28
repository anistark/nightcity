// Eleventy builds the site into _site/. Scene code, styles and images are copied as they are.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

export default function (eleventyConfig) {
  for (const path of ['assets', '*/assets', 'embed.js', 'manifest.webmanifest']) {
    eleventyConfig.addPassthroughCopy(path);
  }
  // The relative path from a page back to the site root, so links work at /nightcity/, on a custom domain or anywhere else.
  eleventyConfig.addFilter('root', url => {
    const depth = url.split('/').length - 2;
    return depth > 0 ? '../'.repeat(depth) : '';
  });
  // Scenes for the landing page, in the order their data files give.
  eleventyConfig.addCollection('scenes', api => api.getFilteredByTag('scene').sort((a, b) => a.data.order - b.data.order));
  // After each build, write sw.js with the list of files to keep offline.
  eleventyConfig.on('eleventy.after', ({ dir }) => writeServiceWorker(dir.output));
  return {
    dir: { input: '.', includes: '_includes', data: '_data', output: '_site' },
    templateFormats: ['njk'],
    htmlTemplateEngine: 'njk',
  };
}

// Fills CORE in sw.js with every built file as a site-relative URL (folders for index pages), and CACHE with a hash of their contents.
// Share images aren't needed offline, and forwarding pages only point elsewhere.
function writeServiceWorker(out) {
  const skip = new Set(JSON.parse(readFileSync('_data/redirects.json', 'utf8')).map(r => r.from));
  const files = [];
  (function walk(d) {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else files.push(relative(out, p).split('\\').join('/'));
    }
  })(out);
  const keep = files.filter(f => f !== 'sw.js' && !f.endsWith('/og.jpg') && f !== 'assets/images/og.jpg' && !skip.has(f) && !f.endsWith('.DS_Store'));
  const hash = createHash('sha256');
  for (const f of keep) hash.update(f).update(readFileSync(join(out, f)));
  const urls = keep.map(f => f === 'index.html' ? './' : f.endsWith('/index.html') ? f.slice(0, -'index.html'.length) : f);
  const sw = readFileSync('sw.js', 'utf8')
    .replace("'__CACHE__'", `'nightcity-${hash.digest('hex').slice(0, 10)}'`)
    .replace('__CORE__', JSON.stringify(urls, null, 2).replace(/"/g, "'"));
  writeFileSync(join(out, 'sw.js'), sw);
}
