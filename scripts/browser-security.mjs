// Browser engines are outside npm/OSV's dependency coverage. Check the actual
// Stable Chrome before opening any page, including the route warmup.
export const secureChromeUse = Object.freeze({
  channel: 'chrome',
  headless: true,
  launchOptions: Object.freeze({ chromiumSandbox: true }),
});

function versionParts(version) {
  if (typeof version !== 'string' || !/^\d{1,6}(\.\d{1,6}){3}$/.test(version)) {
    throw new Error(`Invalid Chrome version: ${version}`);
  }
  return version.split('.').map(Number);
}

export function compareVersions(left, right) {
  const other = versionParts(right);
  for (const [index, part] of versionParts(left).entries()) {
    if (part !== other[index]) return Math.sign(part - other[index]);
  }
  return 0;
}

export async function launchCheckedChrome(chromium, fetchRelease = fetch, platform = process.platform) {
  const googlePlatform = { darwin: 'Mac', linux: 'Linux', win32: 'Windows' }[platform];
  if (!googlePlatform) throw new Error(`Unsupported Chrome platform: ${platform}`);
  const response = await fetchRelease(
    `https://chromiumdash.appspot.com/fetch_releases?channel=Stable&platform=${googlePlatform}&num=1`,
    { signal: AbortSignal.timeout(15_000), redirect: 'error' },
  );
  if (!response.ok) throw new Error(`Chrome release check failed: HTTP ${response.status}`);
  const releases = await response.json();
  const release = Array.isArray(releases) && releases.length === 1 ? releases[0] : null;
  if (release?.channel !== 'Stable' || release?.platform !== googlePlatform) {
    throw new Error('Invalid Chrome Stable release metadata');
  }
  // October 29's security fixes are the minimum even if metadata regresses.
  const floor = platform === 'linux' ? '156.0.8078.79' : '156.0.8078.80';
  if (compareVersions(release.version, floor) < 0) throw new Error('Chrome release metadata predates the security floor');
  const browser = await chromium.launch({
    channel: secureChromeUse.channel,
    headless: secureChromeUse.headless,
    ...secureChromeUse.launchOptions,
  });
  try {
    const actual = browser.version();
    if (compareVersions(actual, release.version) < 0) {
      throw new Error(`Chrome ${actual} is outdated; update Stable Chrome to >=${release.version} before testing`);
    }
    console.log(`Browser security: sandbox enabled; Chrome ${actual}; Stable ${release.version}`);
    return browser;
  } catch (error) {
    await browser.close();
    throw error;
  }
}
