import { defineConfig } from '@playwright/test';
import { secureChromeUse } from './scripts/browser-security.mjs';

// Browser checks for behaviour that only exists in a real layout engine.
// Serves the static build; never opens a visible browser.
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'node_modules/.playwright.nosync',
  reporter: 'list',
  globalSetup: './e2e/global-setup.ts',
  use: { baseURL: 'http://127.0.0.1:4329', ...secureChromeUse },
  webServer: { command: 'env -u PUBLIC_POSTHOG_KEY npx astro build && node e2e/serve.mjs', url: 'http://127.0.0.1:4329', reuseExistingServer: false, timeout: 120_000 },
});
