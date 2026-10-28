// Eleventy builds the site into _site/. Scene code, styles and images are copied as they are.
export default function (eleventyConfig) {
  for (const path of ['assets', '*/assets', 'index.html', 'license.html', '404.html', '*/index.html', 'sw.js', 'embed.js', 'manifest.webmanifest', 'LICENSE']) {
    eleventyConfig.addPassthroughCopy(path);
  }
  return {
    dir: { input: '.', includes: '_includes', data: '_data', output: '_site' },
    templateFormats: ['njk'],
    htmlTemplateEngine: 'njk',
  };
}
