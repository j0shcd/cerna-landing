import posthog from 'posthog-js/dist/module.no-external';

// One outbound boundary for automatic page events and explicit conversions.
// Decode first so percent-encoded addresses cannot bypass redaction.
function redact(value: string): string {
  // Tolerate malformed escapes elsewhere and collapse nested percent encoding.
  value = value.replace(/%(?:25)*([0-9a-f]{2})/gi, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  return value.replace(/[^\s<>"'/?#&=:@]+@[^\s<>"'/?#&=:@]+/g, '[redacted]');
}
function cleanUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = ''; url.password = ''; url.hash = '';
    url.pathname = url.pathname.split('/').map(segment => encodeURIComponent(redact(segment))).join('/');
    const params = new URLSearchParams();
    for (const [key, item] of url.searchParams) {
      if (/^utm_/i.test(key)) params.append(redact(key), redact(item));
    }
    url.search = params.toString();
    return url.toString();
  } catch { return redact(value.split(/[?#]/)[0]!); }
}
function sanitize(value: unknown, key = ''): unknown {
  if (typeof value === 'string') return /url|referrer|href/i.test(key) ? cleanUrl(value) : redact(value);
  if (Array.isArray(value)) return value.map(item => sanitize(item, key));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([name]) => !/email|form.?values?|\$set/i.test(name))
      .map(([name, item]) => [redact(name), sanitize(item, name)]));
  }
  return value;
}

const key = import.meta.env.PUBLIC_POSTHOG_KEY;
if (key) {
  posthog.init(key, {
    api_host: '/ingest',
    ui_host: 'https://eu.posthog.com',
    cookieless_mode: 'always',
    persistence: 'memory',
    person_profiles: 'never',
    autocapture: false,
    capture_pageview: true,
    capture_pageleave: true,
    disable_session_recording: true,
    disable_surveys: true,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    disable_web_experiments: true,
    advanced_disable_flags: true,
    capture_exceptions: false,
    disable_external_dependency_loading: true,
    respect_dnt: true,
    mask_all_text: true,
    mask_all_element_attributes: true,
    before_send: event => event ? { ...event, event: redact(event.event), properties: sanitize(event.properties) as typeof event.properties } : null,
  });
}

export function track(event: 'waitlist_joined', props: { form: 'hero' | 'closing' }): void {
  if (key) posthog.capture(event, { form: props.form });
}
