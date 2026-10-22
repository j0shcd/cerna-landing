import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('cerna-intro', '1'));
});

test('a token fills the native confirmation form', async ({ page }) => {
  await page.goto('/unsubscribe?token=abc');
  await expect(page.locator('[data-state="confirm"]')).toBeVisible();
  await expect(page.locator('[name="token"]')).toHaveValue('abc');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
});

for (const [query, state] of [['?done=1', 'done'], ['', 'invalid'], ['?token=abc&error=invalid_token', 'invalid']]) {
  test(`${query || 'no token'} shows ${state}`, async ({ page }) => {
    await page.goto(`/unsubscribe${query}`);
    await expect(page.locator(`[data-state="${state}"]`)).toBeVisible();
    await expect(page.locator('[data-state="confirm"]')).toBeHidden();
  });
}

test('confirmation posts the token and follows the done redirect', async ({ page }) => {
  await page.route('**/api/unsubscribe', async route => {
    expect(route.request().method()).toBe('POST');
    expect(new URLSearchParams(route.request().postData()!).get('token')).toBe('abc');
    await route.fulfill({ status: 303, headers: { Location: '/unsubscribe?done=1' } });
  });
  await page.goto('/unsubscribe?token=abc');
  await page.getByRole('button', { name: 'Unsubscribe', exact: true }).click();
  await expect(page).toHaveURL(/\/unsubscribe\?done=1$/);
  await expect(page.locator('[data-state="done"]')).toBeVisible();
});
