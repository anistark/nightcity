// Eleventy builds the site into _site/. Scene code, styles and images are copied as they are.
export default function (eleventyConfig) {
  for (const path of ['assets', '*/assets', '*/index.html', 'sw.js', 'embed.js', 'manifest.webmanifest', 'LICENSE']) {
    eleventyConfig.addPassthroughCopy(path);
  }
  // The relative path from a page back to the site root, so links work at /nightcity/, on a custom domain or anywhere else.
  eleventyConfig.addFilter('root', url => {
    const depth = url.split('/').length - 2;
    return depth > 0 ? '../'.repeat(depth) : '';
  });
  return {
    dir: { input: '.', includes: '_includes', data: '_data', output: '_site' },
    templateFormats: ['njk'],
    htmlTemplateEngine: 'njk',
  };
}
