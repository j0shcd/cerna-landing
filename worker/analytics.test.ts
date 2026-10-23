import { afterEach, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn() }));
vi.mock('posthog-js/dist/module.no-external', () => ({ default: sdk }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); vi.resetModules(); });

it.each([undefined, ''])('does nothing with an unset or empty key (%s)', async key => {
  vi.stubEnv('PUBLIC_POSTHOG_KEY', key);
  const { track } = await import('../src/scripts/analytics');
  track('waitlist_joined', { form: 'hero' });
  expect(sdk.init).not.toHaveBeenCalled(); expect(sdk.capture).not.toHaveBeenCalled();
});

it('initializes only the privacy configuration and sanitizes every outbound event', async () => {
  vi.stubEnv('PUBLIC_POSTHOG_KEY', 'phc_test');
  const { track } = await import('../src/scripts/analytics');
  expect(sdk.init).toHaveBeenCalledTimes(1);
  const [key, config] = sdk.init.mock.calls[0]!;
  expect(key).toBe('phc_test');
  expect(config).toEqual({
    api_host: '/ingest', ui_host: 'https://eu.posthog.com', cookieless_mode: 'always', persistence: 'memory', person_profiles: 'never',
    autocapture: false, capture_pageview: true, capture_pageleave: true, disable_session_recording: true, disable_surveys: true,
    capture_heatmaps: false, capture_dead_clicks: false, disable_web_experiments: true, advanced_disable_flags: true,
    capture_exceptions: false, disable_external_dependency_loading: true, respect_dnt: true, mask_all_text: true,
    mask_all_element_attributes: true, before_send: expect.any(Function),
  });
  const event = { event: '$pageview', properties: {
    $current_url: 'https://cerna.example/person%40example.com?email=person@example.com&token=secret&utm_source=news&utm_campaign=person%40example.com#person@example.com',
    $referrer: 'https://example.com/path?email=person@example.com#private',
    email: 'person@example.com', form_values: { input: 'typed private text' }, $set: { name: 'private' },
    nested: [{ text: 'person%2540example.com', 'person@example.com': 'person@example.com' }],
  } };
  const cleaned = config.before_send(event);
  expect(cleaned.properties.$current_url).toBe('https://cerna.example/%5Bredacted%5D?utm_source=news&utm_campaign=%5Bredacted%5D');
  expect(cleaned.properties.$referrer).toBe('https://example.com/path');
  for (const forbidden of ['person', 'example.com?email', 'secret', 'typed private text', '$set', 'form_values']) expect(JSON.stringify(cleaned)).not.toContain(forbidden);
  expect(event.properties.email).toBe('person@example.com');
  expect(config.before_send(null)).toBeNull();
  track('waitlist_joined', { form: 'closing', email: 'person@example.com' } as { form: 'closing' });
  expect(sdk.capture).toHaveBeenCalledExactlyOnceWith('waitlist_joined', { form: 'closing' });
});

it('redacts malformed and multiply encoded emails without introducing URL structure', async () => {
  vi.stubEnv('PUBLIC_POSTHOG_KEY', 'phc_test');
  await import('../src/scripts/analytics');
  const config = sdk.init.mock.calls[0]![1];
  const clean = (url: string) => config.before_send({ event: '$pageview', properties: { $current_url: url } }).properties.$current_url;
  for (const url of [
    'https://cerna.example/?utm_campaign=person%40example.com%ZZ',
    'https://cerna.example/person%25252540example.com?utm_campaign=person%25252540example.com',
  ]) {
    const cleaned = clean(url);
    expect(cleaned).not.toContain('person'); expect(cleaned).not.toContain('example.com');
  }
  const cleaned = new URL(clean('https://cerna.example/private%3Ftoken%3Dsecret?utm_campaign=summer%26email%3Dsecret#private'));
  expect([...cleaned.searchParams.keys()]).toEqual(['utm_campaign']);
  expect(cleaned.searchParams.get('utm_campaign')).toBe('summer&email=secret');
  expect(cleaned.hash).toBe('');
  expect(cleaned.pathname).toBe('/private%3Ftoken%3Dsecret');
});
