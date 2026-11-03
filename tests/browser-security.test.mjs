import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compareVersions, launchCheckedChrome } from '../scripts/browser-security.mjs';
import config from '../playwright.config.ts';

const current = '156.0.8078.80';
const release = (version = current, platform = 'Mac') => async () => ({
  ok: true, json: async () => [{ channel: 'Stable', platform, version }],
});
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
  assert.equal(compareVersions('156.0.8078.9', current), -1);
  assert.equal(compareVersions('157.0.1.0', current), 1);
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
  const { chromium } = probe('156.0.8078.79');
  await (await launchCheckedChrome(chromium, release('156.0.8078.79', 'Linux'), 'linux')).close();
});

test('new upstream security releases immediately block an older installation', async () => {
  await assert.rejects(launchCheckedChrome(probe().chromium, release('156.0.8078.100'), 'darwin'), /outdated/);
});

test('unavailable, malformed or regressed metadata prevents browser launch', async () => {
  const responses = [
    async () => { throw new Error('offline'); },
    async () => ({ ok: false, status: 503 }),
    async () => ({ ok: true, json: async () => [] }),
    release('148.0.7778.96'), release(current, 'Linux'), release('invalid'),
  ];
  for (const fetchRelease of responses) {
    const { calls, chromium } = probe();
    await assert.rejects(launchCheckedChrome(chromium, fetchRelease, 'darwin'));
    assert.deepEqual(calls, []);
  }
});
