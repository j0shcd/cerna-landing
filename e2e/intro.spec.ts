import { expect, test } from '@playwright/test';

// A first-session visit plays the intro and the statement sequence (see src/layouts/Base.astro).
const topOf = (selector: string) => (page: import('@playwright/test').Page) =>
  page.$eval(selector, element => element.getBoundingClientRect().top + scrollY);

test('the statement sequence never moves the page below it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/intro-play/);
  const beatsTop = topOf('.beats');
  await expect(page.locator('[data-status]')).toHaveText(/Reading/);
  const before = await beatsTop(page);
  await expect(page.locator('[data-status]')).toHaveText(/Done/, { timeout: 10_000 });
  await page.waitForTimeout(800); // let the collapse transition finish
  expect(Math.abs((await beatsTop(page)) - before)).toBeLessThanOrEqual(1);
});

test('on a phone the sequence waits until the card is in view', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForTimeout(4_000);
  await expect(page.locator('[data-status]')).toHaveText(/Reading/);
  await page.locator('[data-statement]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-status]')).toHaveText(/Done/, { timeout: 10_000 });
});
