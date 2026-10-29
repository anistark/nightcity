// The LICENSE file, read at build time for the license page. It is hard-wrapped plain text,
// so lines inside a paragraph are joined back together and the first paragraph becomes the heading.
import { readFileSync } from 'node:fs';

export default function () {
  const [title, ...paragraphs] = readFileSync('LICENSE', 'utf8').trim().split(/\n\s*\n/).map(p => p.replace(/\s*\n\s*/g, ' ').trim());
  return { title, paragraphs };
}
