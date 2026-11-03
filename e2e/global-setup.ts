import { chromium } from '@playwright/test';
import { launchCheckedChrome } from '../scripts/browser-security.mjs';

export default async function globalSetup() {
  const browser = await launchCheckedChrome(chromium);
  await browser.close();
}
