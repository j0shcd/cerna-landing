import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

test('serves the canonical build bytes rather than a stale legacy output', async ({ request }) => {
  const expected = readFileSync(new URL('../dist.nosync/index.html', import.meta.url), 'utf8');
  const response = await request.get('/');
  expect(response.status()).toBe(200);
  expect(await response.text()).toBe(expected);
});
