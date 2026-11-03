import type { Browser, BrowserType } from 'playwright-core';

export declare const secureChromeUse: {
  readonly channel: 'chrome';
  readonly headless: true;
  readonly launchOptions: { readonly chromiumSandbox: true };
};
export declare function compareVersions(left: string, right: string): number;
export declare function launchCheckedChrome(
  chromium: BrowserType,
  fetchRelease?: typeof fetch,
  platform?: NodeJS.Platform,
): Promise<Browser>;
