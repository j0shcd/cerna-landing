import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('cerna-intro', '1'));
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('the header calls the hero form once and updates the hash', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.locator('[data-call-waitlist]').click();
  await expect(page.locator('#join-email')).toBeFocused();
  await expect(page.locator('#join')).toHaveClass(/\bis-called\b/);
  await expect(page).toHaveURL(/\/#join$/);
  await page.clock.runFor(2_200);
  await expect(page.locator('#join')).not.toHaveClass(/\bis-called\b/);
});

test('the header calls the visible closing form without moving the page', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.locator('#join-closing').evaluate(element => element.scrollIntoView({ behavior: 'instant', block: 'center' }));
  await expect.poll(() => page.locator('#join-closing').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= innerHeight;
  })).toBe(true);
  const before = await page.evaluate(() => {
    const y = scrollY;
    document.querySelector<HTMLAnchorElement>('[data-call-waitlist]')!.click();
    return y;
  });
  await expect(page.locator('#join-closing-email')).toBeFocused();
  await expect(page.locator('#join-closing')).toHaveClass(/\bis-called\b/);
  await expect(page.locator('#join')).not.toHaveClass(/\bis-called\b/);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThanOrEqual(before - 2);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThanOrEqual(before + 2);
});

test('reduced motion focuses the input without ever calling the animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto('/');
  await page.evaluate(() => {
    // oldValue catches even a class added and removed in a single task.
    (window as any).called = false;
    const box = document.querySelector('#join')!;
    new MutationObserver(records => {
      if (box.classList.contains('is-called') || records.some(record => /\bis-called\b/.test(record.oldValue ?? ''))) {
        (window as any).called = true;
      }
    }).observe(box, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  });
  await page.locator('[data-call-waitlist]').click();
  await expect(page.locator('#join-email')).toBeFocused();
  await page.clock.runFor(2_200);
  await expect(page.locator('#join')).not.toHaveClass(/\bis-called\b/);
  expect(await page.evaluate(() => (window as any).called)).toBe(false);
});

test('the legal-page header navigates home and focuses the hero input', async ({ page }) => {
  await page.goto('/privacy');
  await page.locator('[data-call-waitlist]').click();
  await expect(page).toHaveURL(/\/#join$/);
  await expect(page.locator('#join-email')).toBeFocused();
});

test('the review queue approves only the two decided rows', async ({ page }) => {
  await page.goto('/');
  const demo = page.locator('[data-categorize]');
  await expect(demo.locator('[data-confirm]')).toHaveText('Approve 2');
  await expect(demo.locator('[data-meta]')).toHaveText('Worth checking');
  await demo.locator('[data-confirm]').click();
  await expect(demo.getByRole('status')).toHaveText('✓ 2 approved · TWINT waits for you');
  await expect(demo.getByRole('status')).toBeFocused();
  await expect(demo.locator('.unsure .check')).toHaveCSS('opacity', '0');
});

for (const keyboard of [false, true]) {
  test(`the review queue resolves the unsure row using ${keyboard ? 'the keyboard' : 'the pointer'}`, async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-confirm]').click();
    await page.reload();
    const toggle = page.locator('[data-category-toggle]');
    if (keyboard) {
      await toggle.focus();
      await toggle.press('ArrowDown');
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByRole('option', { name: 'Restaurants', exact: true })).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect(page.getByRole('option', { name: 'Groceries', exact: true })).toBeFocused();
      await page.keyboard.press('Enter');
    } else {
      await toggle.click();
      await page.getByRole('option', { name: 'Groceries', exact: true }).click();
    }
    await expect(page.locator('[data-field-text]')).toHaveText('Groceries');
    await expect(page.locator('[data-meta]')).not.toHaveText('Worth checking');
    await expect(page.locator('[data-needs-text]')).toHaveText('All clear');
    await expect(page.locator('[data-confirm]')).toHaveText('Approve 3');
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('listbox')).toBeHidden();
    await toggle.click();
    await expect(page.getByRole('option', { name: 'Groceries', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Escape');
    await expect(toggle).toBeFocused();
    await page.locator('[data-confirm]').click();
    await expect(page.locator('[data-status-line]')).toHaveText('✓ 3 approved');
  });
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`${colorScheme} theme text meets WCAG AA contrast`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    const selectors = ['h1', '.lede', '[data-status]', '[data-status] b', '.review .meta', '.review .needs', '.brief .usual', '.note', 'footer .privacy', '[data-waitlist] .btn'];
    if (await page.locator('[data-statement] .caption').count()) selectors.push('[data-statement] .caption');
    for (const selector of selectors) {
      const elements = page.locator(selector);
      expect(await elements.count(), selector).toBeGreaterThan(0);
      for (const element of await elements.all()) {
        const ratio = await element.evaluate(node => {
          const rgb = (color: string) => {
            const values = color.match(/[\d.]+/g)!.map(Number);
            return { channels: values.slice(0, 3), alpha: values[3] ?? 1 };
          };
          const luminance = (channels: number[]) => channels.map(value => {
            const c = value / 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
          let background: number[] | undefined;
          for (let parent: Element | null = node; parent; parent = parent.parentElement) {
            const color = rgb(getComputedStyle(parent).backgroundColor);
            if (color.alpha === 0) continue;
            if (color.alpha !== 1) throw new Error('Contrast helper requires an opaque effective background');
            background = color.channels;
            break;
          }
          if (!background) throw new Error('No effective background found');
          const foreground = rgb(getComputedStyle(node).color);
          const text = foreground.channels.map((value, i) => value * foreground.alpha + background![i] * (1 - foreground.alpha));
          const a = luminance(text), b = luminance(background);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        });
        expect(ratio, `${colorScheme}: ${selector}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    if (colorScheme === 'dark') await expect(page.locator('body')).not.toHaveCSS('background-color', 'rgb(250, 250, 247)');
  });
}

test('modified header clicks preserve native link handling', async ({ page }) => {
  await page.goto('/');
  for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
    const prevented = await page.locator('[data-call-waitlist]').evaluate((link, key) => {
      let prevented = false;
      // Cancel navigation only after recording whether the enhancement intercepted it.
      document.addEventListener('click', event => { prevented = event.defaultPrevented; event.preventDefault(); }, { once: true });
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, [key]: true }));
      return prevented;
    }, modifier);
    expect(prevented, modifier).toBe(false);
  }
  await expect(page).toHaveURL(/\/$/);
});

test('the header focuses visible confirmation after signup', async ({ page }) => {
  await page.route('**/api/waitlist', route => route.fulfill({ json: { ok: true } }));
  await page.goto('/');
  await page.locator('#join-email').fill('person@example.com');
  await page.locator('#join button').click();
  await expect(page.locator('#join')).toHaveClass(/\bis-done\b/);
  await page.locator('[data-call-waitlist]').click();
  await expect(page.locator('#join-status')).toBeFocused();
  await expect(page.locator('#join')).not.toHaveClass(/\bis-called\b/);
});

test('without JavaScript the header is a link and both forms POST natively', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    await page.goto('/privacy');
    await expect(page.locator('[data-call-waitlist]')).toHaveAttribute('href', '/#join');
    await page.locator('[data-call-waitlist]').click();
    await expect(page).toHaveURL(/\/#join$/);
    await page.route('**/api/waitlist', route => route.fulfill({ contentType: 'text/html', body: '<p>Native POST received</p>' }));
    for (const id of ['join', 'join-closing']) {
      await page.goto('/');
      const form = page.locator(`#${id}-form`);
      await expect(form).toHaveAttribute('method', 'post');
      await expect(form).toHaveAttribute('action', '/api/waitlist');
      await page.locator(`#${id}-email`).fill('person@example.com');
      const request = page.waitForRequest(request => new URL(request.url()).pathname === '/api/waitlist');
      await form.locator('button').click();
      const posted = await request;
      expect(posted.method()).toBe('POST');
      expect(new URLSearchParams(posted.postData()!).get('email')).toBe('person@example.com');
      await expect(page.getByText('Native POST received')).toBeVisible();
    }
  } finally { await context.close(); }
});
