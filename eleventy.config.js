// Eleventy builds the site into _site/. Scene code, styles and images are copied as they are.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { createHash } from 'node:crypto';

export default function (eleventyConfig) {
  for (const path of ['assets', '*/assets', 'embed.js', 'manifest.webmanifest']) {
    eleventyConfig.addPassthroughCopy(path);
  }
  // In `just serve`, copy changed files into _site/ too, so edits to scene code show up on reload.
  eleventyConfig.setServerPassthroughCopyBehavior('copy');
  // The private plan/ tools, like the share preview composer, are served locally but never deployed.
  if (process.env.ELEVENTY_RUN_MODE === 'serve') eleventyConfig.addPassthroughCopy('plan');
  // The relative path from a page back to the site root, so links work at /nightcity/, on a custom domain or anywhere else.
  eleventyConfig.addFilter('root', url => {
    const depth = url.split('/').length - 2;
    return depth > 0 ? '../'.repeat(depth) : '';
  });
  // Scenes for the landing page, in the order their data files give.
  eleventyConfig.addCollection('scenes', api => api.getFilteredByTag('scene').sort((a, b) => a.data.order - b.data.order));
  // A file's text, for llms-full.txt, which gathers the READMEs into one file for agents.
  eleventyConfig.addFilter('readText', path => readFileSync(path, 'utf8').trim());
  eleventyConfig.addFilter('readmeOf', path => readFileSync(join(dirname(path), 'README.md'), 'utf8').trim());
  // Structured data (schema.org JSON-LD) for search engines and agents: the site and its scenes on the landing page,
  // each scene as a creative work by its author, with a breadcrumb back to the landing page.
  eleventyConfig.addShortcode('structuredData', function () {
    const d = this.ctx, site = d.site;
    const owner = { '@type': 'Person', name: site.author, url: site.authorUrl, sameAs: site.sameAs };
    const website = { '@type': 'WebSite', '@id': site.url + '#site', name: site.name, url: site.url, description: site.description, inLanguage: 'en', author: owner };
    const scene = s => {
      const folder = s.ogPath.replace(/\/$/, '');
      return { '@type': 'CreativeWork', '@id': site.url + s.ogPath + '#scene', name: s.title, url: site.url + s.ogPath, description: s.description, abstract: s.card,
        image: site.url + s.ogImage, genre: 'Generative art', inLanguage: 'en', isAccessibleForFree: true,
        keywords: 'generative art, procedural animation, never repeats, ambient scene, live background, canvas, night',
        author: 'https://github.com/' + s.author === site.authorUrl ? owner : { '@type': 'Person', name: s.author, url: 'https://github.com/' + s.author },
        license: site.repo + '/blob/main/LICENSE', isBasedOn: site.repo + '/tree/main/' + folder, isPartOf: { '@id': site.url + '#site' } };
    };
    let graph;
    if (this.page.url === '/') {
      const scenes = d.collections.scenes.map((s, i) => ({ '@type': 'ListItem', position: i + 1, item: scene(s.data) }));
      graph = [website, { '@type': 'CollectionPage', name: site.name, url: site.url, description: d.description, isPartOf: { '@id': site.url + '#site' }, mainEntity: { '@type': 'ItemList', itemListElement: scenes } }];
    } else if ([].concat(d.tags || []).includes('scene')) {
      graph = [website, scene(d), { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: site.name, item: site.url },
        { '@type': 'ListItem', position: 2, name: d.title, item: site.url + d.ogPath }] }];
    } else return '';
    return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')}</script>`;
  });
  // After each build, write sw.js with the list of files to keep offline.
  eleventyConfig.on('eleventy.after', ({ dir }) => writeServiceWorker(dir.output));
  return {
    dir: { input: '.', includes: '_includes', data: '_data', output: '_site' },
    templateFormats: ['njk'],
    htmlTemplateEngine: 'njk',
  };
}

// Fills CORE in sw.js with every built file as a site-relative URL (folders for index pages), and CACHE with a hash of their contents.
// Share images aren't needed offline, forwarding pages only point elsewhere, the sitemap and llms.txt files are for
// crawlers and agents, and plan/ is only there locally.
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
  const keep = files.filter(f => f !== 'sw.js' && !f.startsWith('plan/') && !f.endsWith('/og.jpg') && f !== 'assets/images/og.jpg' && !skip.has(f) && !f.endsWith('.DS_Store') && !/^(sitemap\.xml|llms(-full)?\.txt)$/.test(f));
  const hash = createHash('sha256');
  for (const f of keep) hash.update(f).update(readFileSync(join(out, f)));
  const urls = keep.map(f => f === 'index.html' ? './' : f.endsWith('/index.html') ? f.slice(0, -'index.html'.length) : f);
  const sw = readFileSync('sw.js', 'utf8')
    .replace("'__CACHE__'", `'nightcity-${hash.digest('hex').slice(0, 10)}'`)
    .replace('__CORE__', JSON.stringify(urls, null, 2).replace(/"/g, "'"));
  writeFileSync(join(out, 'sw.js'), sw);
}
