import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('./global.css', import.meta.url), 'utf8');
const root = css.match(/^:root\s*\{([^{}]*)\}/m);
const fallback = css.match(/@supports not \(color: light-dark\(#000, #fff\)\)\s*\{\s*:root\s*\{([^{}]*)\}\s*\}/);
assert.ok(root, 'Theme :root block must exist');
assert.ok(fallback, 'Unsupported light-dark() fallback block must exist');

const declarations = block => new Map(
  [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
);
const themed = new Map([...declarations(root[1])].filter(([, value]) => value.includes('light-dark(')));
const fallbacks = declarations(fallback[1]);

test('fallback declares exactly the tokens that use light-dark()', () => {
  assert.deepEqual(new Set(fallbacks.keys()), new Set(themed.keys()));
});

test('fallback values replace light-dark() with its light argument, preserving shadows', () => {
  for (const [name, value] of themed) {
    // Current theme arguments are hex colours, so no nested function parsing is needed.
    const light = value.replace(/light-dark\(\s*([^,()]+),\s*[^()]+\)/g, (_, first) => first.trim());
    assert.ok(!light.includes('light-dark('), `${name} must have parseable light-dark() arguments`);
    assert.equal(fallbacks.get(name), light, `${name} must match its light value`);
  }
});
