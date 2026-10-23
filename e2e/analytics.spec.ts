import { expect, test } from '@playwright/test';

test('analytics stays off without a public build key', async ({ page }) => {
  const ingest: string[] = [], external: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname === '/ingest' || url.pathname.startsWith('/ingest/')) ingest.push(url.href);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) external.push(url.href);
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.goto('/privacy'); // Also exercise pageleave on the landing page.
  await page.waitForLoadState('networkidle');
  expect(ingest).toEqual([]);
  expect(external).toEqual([]);
});
