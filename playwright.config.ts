import { defineConfig } from '@playwright/test';

// Browser checks for behaviour that only exists in a real layout engine.
// Serves the static build; never opens a visible browser.
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'node_modules/.playwright.nosync',
  reporter: 'list',
  use: { baseURL: 'http://localhost:4329', headless: true },
  webServer: { command: 'env -u PUBLIC_POSTHOG_KEY npx astro build && node e2e/serve.mjs', url: 'http://localhost:4329', reuseExistingServer: false, timeout: 120_000 },
});
