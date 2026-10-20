// Refuses to deploy while the privacy notice or impressum still has {{PLACEHOLDERS}}.
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/content/legal.ts', import.meta.url), 'utf8');
const found = [...new Set(source.match(/\{\{[^}]+\}\}/g) ?? [])];
if (found.length > 0) {
  console.error(`Legal pages still have ${found.length} placeholder(s) to fill in src/content/legal.ts:\n  ${found.join('\n  ')}`);
  process.exit(1);
}
console.log('Legal pages have no placeholders.');
