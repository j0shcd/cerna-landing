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
  const googlePlatform = {
    darwin: process.arch === 'arm64' ? 'mac_arm64' : 'mac',
    linux: 'linux', win32: process.arch === 'ia32' ? 'win' : 'win64',
  }[platform];
  if (!googlePlatform) throw new Error(`Unsupported Chrome platform: ${platform}`);
  const response = await fetchRelease(
    `https://versionhistory.googleapis.com/v1/chrome/platforms/${googlePlatform}/channels/stable/versions/all/releases?filter=endtime=none&order_by=version%20desc`,
    { signal: AbortSignal.timeout(15_000), redirect: 'error' },
  );
  if (!response.ok) throw new Error(`Chrome release check failed: HTTP ${response.status}`);
  const payload = await response.json();
  const releases = payload?.releases;
  if (!Array.isArray(releases) || !releases.length || releases.length > 200 ||
      (payload.nextPageToken !== undefined && payload.nextPageToken !== '')) {
    throw new Error('Invalid Chrome Stable release metadata');
  }
  for (const release of releases) {
    versionParts(release.version);
    const prefix = `chrome/platforms/${googlePlatform}/channels/stable/versions/${release.version}/releases/`;
    if (typeof release.name !== 'string' || !release.name.startsWith(prefix) ||
        !release.name.slice(prefix.length) || release.name.slice(prefix.length).includes('/') ||
        !Number.isFinite(release.fraction) || release.fraction < 0 || release.fraction > 1 ||
        !Number.isFinite(Date.parse(release.serving?.startTime)) ||
        Date.parse(release.serving.startTime) > Date.now() ||
        Object.hasOwn(release.serving, 'endTime')) {
      throw new Error('Invalid Chrome Stable release metadata');
    }
  }
  // VersionHistory documents fraction=1 as a full rollout. Early Stable can
  // name next month's milestone before the normal Mac installer delivers it.
  // Keep requiring every active security patch within the released milestone.
  const full = releases.filter((release) => release.fraction === 1);
  if (!full.length) throw new Error('No fully released Chrome Stable milestone');
  const milestone = Math.max(...full.map((release) => versionParts(release.version)[0]));
  const required = releases.filter((release) => release.fraction > 0 &&
    versionParts(release.version)[0] === milestone)
    .map((release) => release.version).sort(compareVersions).at(-1);
  // November 3's security fixes are the minimum even if metadata regresses.
  const floor = platform === 'linux' ? '157.0.8103.38' : '157.0.8103.39';
  if (compareVersions(required, floor) < 0) throw new Error('Chrome release metadata predates the security floor');
  const browser = await chromium.launch({
    channel: secureChromeUse.channel,
    headless: secureChromeUse.headless,
    ...secureChromeUse.launchOptions,
  });
  try {
    const actual = browser.version();
    if (compareVersions(actual, required) < 0) {
      throw new Error(`Chrome ${actual} is outdated; update Stable Chrome to >=${required} before testing`);
    }
    console.log(`Browser security: sandbox enabled; Chrome ${actual}; Stable ${required}`);
    return browser;
  } catch (error) {
    await browser.close();
    throw error;
  }
}
