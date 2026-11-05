import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compareVersions, launchCheckedChrome } from '../scripts/browser-security.mjs';
import config from '../playwright.config.ts';

const current = '157.0.8103.39';
const apiPlatform = { Mac: process.arch === 'arm64' ? 'mac_arm64' : 'mac', Linux: 'linux', Windows: process.arch === 'ia32' ? 'win' : 'win64' };
const served = (version = current, fraction = 1, platform = 'Mac') => ({
  name: `chrome/platforms/${apiPlatform[platform]}/channels/stable/versions/${version}/releases/123`,
  version, fraction, serving: { startTime: '2020-01-01T00:00:00Z' },
});
const feed = (releases, latest = releases[0]?.version, platform = 'Mac') => async (url) => ({
  ok: true, json: async () => url.startsWith('https://versionhistory.googleapis.com/')
    ? { releases }
    : [{ channel: 'Stable', platform, version: latest }],
});
const release = (version = current, platform = 'Mac') => feed([served(version, 1, platform)], version, platform);
function probe(version = current) {
  const calls = [];
  return { calls, chromium: { launch: async (options) => {
    calls.push(options);
    return { version: () => version, close: async () => calls.push('closed') };
  } } };
}

test('actual runner selects Stable Chrome with the sandbox and a preflight', async () => {
  assert.equal(config.use.channel, 'chrome');
  assert.equal(config.use.headless, true);
  assert.equal(config.use.launchOptions.chromiumSandbox, true);
  for (const project of config.projects ?? []) {
    assert.ok(!project.use?.channel || project.use.channel === 'chrome');
    assert.notEqual(project.use?.launchOptions?.chromiumSandbox, false);
  }
  assert.ok(config.globalSetup);
  const setup = await readFile(new URL('../e2e/global-setup.ts', import.meta.url), 'utf8');
  assert.match(setup, /launchCheckedChrome\(chromium\)/);
  assert.doesNotMatch(setup, /chromium\.launch\(/);
});

test('numeric comparison checks patch versions and major versions', () => {
  assert.equal(compareVersions('157.0.8103.9', current), -1);
  assert.equal(compareVersions('158.0.1.0', current), 1);
  assert.throws(() => compareVersions('156.bad', current));
});

test('preflight verifies the actual browser and uses sandboxed headless Chrome', async () => {
  const { calls, chromium } = probe();
  const browser = await launchCheckedChrome(chromium, release(), 'darwin');
  assert.deepEqual(calls, [{ channel: 'chrome', headless: true, chromiumSandbox: true }]);
  await browser.close();
});

test('old bundled engines and missing security patches are refused and closed', async () => {
  for (const version of ['148.0.7778.96', '156.0.8078.4', '156.0.8078.79', 'invalid']) {
    const { calls, chromium } = probe(version);
    await assert.rejects(launchCheckedChrome(chromium, release(), 'darwin'));
    assert.equal(calls.at(-1), 'closed');
  }
});

test('Linux uses its own patch release rather than the Mac patch number', async () => {
  const { chromium } = probe('157.0.8103.38');
  await (await launchCheckedChrome(chromium, release('157.0.8103.38', 'Linux'), 'linux')).close();
});

test('new upstream security releases immediately block an older installation', async () => {
  await assert.rejects(launchCheckedChrome(probe().chromium, release('157.0.8103.100'), 'darwin'), /outdated/);
});

test('an Early Stable milestone does not replace the fully released Stable milestone', async () => {
  const { chromium } = probe();
  const fetchRelease = feed([served('158.0.8127.18', 0.005), served(current)], '158.0.8127.18');
  await (await launchCheckedChrome(chromium, fetchRelease, 'darwin')).close();
});

test('a staged security patch within the released milestone blocks the old patch immediately', async () => {
  await assert.rejects(launchCheckedChrome(probe().chromium,
    feed([served('157.0.8103.40', 0.01), served(current)], '157.0.8103.40'), 'darwin'), /outdated/);
  await assert.rejects(launchCheckedChrome(probe().chromium,
    feed([served('158.0.8127.18')], '158.0.8127.18'), 'darwin'), /outdated/);
});

test('incomplete, ended or invalid rollout evidence prevents browser launch', async () => {
  const payloads = [
    { releases: [served('158.0.8127.18', 0.005)] },
    { releases: [served(current, -1)] },
    { releases: [served(current, 1.01)] },
    { releases: [{ ...served(), serving: { startTime: '2020-01-01T00:00:00Z', endTime: '2021-01-01T00:00:00Z' } }] },
    { releases: [served()], nextPageToken: 'more' },
  ];
  for (const payload of payloads) {
    const { calls, chromium } = probe();
    await assert.rejects(launchCheckedChrome(chromium, async () => ({ ok: true, json: async () => payload }), 'darwin'));
    assert.deepEqual(calls, []);
  }
});

test('unavailable, malformed or regressed metadata prevents browser launch', async () => {
  const responses = [
    async () => { throw new Error('offline'); },
    async () => ({ ok: false, status: 503 }),
    async () => ({ ok: true, json: async () => [] }),
    release('148.0.7778.96'), release('156.0.8078.80'), release(current, 'Linux'), release('invalid'),
  ];
  for (const fetchRelease of responses) {
    const { calls, chromium } = probe();
    await assert.rejects(launchCheckedChrome(chromium, fetchRelease, 'darwin'));
    assert.deepEqual(calls, []);
  }
});
