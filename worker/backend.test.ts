import { readFileSync } from 'node:fs';
import { unsubscribeToken, verifyUnsubscribeToken } from './unsubscribe';
import { welcomeEmail } from './emails/welcome';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './index';
import { database } from './test-support/d1';
import type { Env } from './env';
import { normalizeEmail } from './validate';
import { processOutbox } from './outbox';
import { ipDigest, rateLimited } from './ratelimit';

let store: ReturnType<typeof database>;
let env: Env;
let tasks: Promise<unknown>[];
let ctx: ExecutionContext;
const start = Date.parse('2026-10-20T12:00:00.000Z');
const rows = (table: string) => store.sqlite.prepare(`SELECT * FROM ${table}`).all();
async function post(email: unknown = 'user@example.eu', company = '', form = false, headers: Record<string, string> = {}) {
  return worker.fetch(new Request('https://cerna.example/api/waitlist', {
    method: 'POST', headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json', 'CF-Connecting-IP': '203.0.113.42', ...headers },
    body: form ? new URLSearchParams({ email: String(email), company }).toString() : JSON.stringify({ email, company }),
  }), env, ctx);
}
async function drain() { await Promise.all(tasks); tasks = []; }
beforeEach(() => {
  store = database(); tasks = [];
  env = { WAITLIST_DB: store.db, SITE_ORIGIN: 'https://cerna.example', MAIL_FROM: 'waitlist@cerna.example', MAIL_FROM_NAME: 'Cerna', ADMIN_NOTIFY_TO: 'owner@example.eu', CONSENT_VERSION: '2026-10-22', EMAIL_ENABLED: 'false', BREVO_API_KEY: 'secret-test-key', RATE_LIMIT_HMAC_KEY: 'test-hmac-key', UNSUBSCRIBE_HMAC_KEY: 'unsubscribe-test-secret' };
  ctx = { waitUntil(task: Promise<unknown>) { tasks.push(task); } } as ExecutionContext;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(Date, 'now').mockReturnValue(start);
});
afterEach(async () => { await drain(); store.sqlite.close(); vi.restoreAllMocks(); });

describe('waitlist', () => {
  it('saves consent and queues owner notification and welcome', async () => {
    const response = await post();
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ ok: true });
    expect(rows('waitlist_signups')).toEqual([expect.objectContaining({ email: 'user@example.eu', consent_text: 'Get notified when we launch.', consent_version: '2026-10-22', source: 'landing' })]);
    expect(rows('outbox')).toHaveLength(2);
  });
  it('duplicates and case/whitespace/NFKC variants have identical success and queue nothing extra', async () => {
    for (const email of ['User@Example.eu', ' user@example.eu ', 'ｕｓｅｒ@example.eu']) {
      const response = await post(email); expect(await response.json()).toEqual({ ok: true });
    }
    expect(rows('waitlist_signups')).toHaveLength(1); expect(rows('outbox')).toHaveLength(2);
  });
  it.each(['', 'a', 'a@b', '@example.eu', 'a@@example.eu', 'a@.eu', 'a@example.', 'a@ex..eu', 'a b@example.eu', 'a\u0000@example.eu', 'a\u200b@example.eu', `${'a'.repeat(250)}@x.eu`, null, 42])('rejects invalid email %s', async email => {
    expect(normalizeEmail(email)).toBeNull();
    const response = await post(email); expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: 'invalid_email' });
    expect(rows('waitlist_signups')).toHaveLength(0);
  });
  it.each([
    'a..b@example.eu', 'a@b.c/d', 'a@-example.eu', `${'a'.repeat(65)}@example.eu`,
    '.a@example.eu', 'a.@example.eu', 'a@example-.eu', `a@${'b'.repeat(64)}.eu`,
    'a@example.c', 'a@example.12', 'a@example.xn--', 'a@example.c1',
    'é@example.eu', 'a@éxample.eu', '😀@example.eu', '"a"@example.eu',
    `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(62)}`,
  ])('rejects unsupported syntax or exceeded boundary: %s', async email => {
    expect(normalizeEmail(email)).toBeNull();
    const response = await post(email);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: 'invalid_email' });
    expect(rows('waitlist_signups')).toHaveLength(0);
  });
  it.each([
    ['a@b.eu', 'a@b.eu'],
    ["a!#$%&'*+/=?^_`{|}~.-z@example.eu", "a!#$%&'*+/=?^_`{|}~.-z@example.eu"],
    [' A.B@EXAMPLE.EU ', 'a.b@example.eu'],
    ['ａ@ｅｘａｍｐｌｅ.eu', 'a@example.eu'],
    ['a@1-b.example.xn--p1ai', 'a@1-b.example.xn--p1ai'],
    [`${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`,
      `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`],
  ])('accepts supported syntax and boundaries: %s', async (email, normalized) => {
    expect(normalizeEmail(email)).toBe(normalized);
    expect((await post(email)).status).toBe(200);
    expect(rows('waitlist_signups')[0]!.email).toBe(normalized);
  });
  it('silently accepts honeypots without storing any rows', async () => {
    expect((await post('invalid', 'bot')).status).toBe(200);
    for (const table of ['waitlist_signups', 'outbox', 'rate_limits']) expect(rows(table)).toHaveLength(0);
  });
  it('limits attempt six and resets the short window', async () => {
    for (let i = 0; i < 5; i++) expect((await post()).status).toBe(200);
    const response = await post(); expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ ok: false, error: 'rate_limited' });
    vi.mocked(Date.now).mockReturnValue(start + 600_000);
    expect((await post()).status).toBe(200);
  });
  it('limits attempt 21 across short windows; resets the UTC day', async () => {
    const digest = await ipDigest('203.0.113.42', env.RATE_LIMIT_HMAC_KEY);
    for (let i = 0; i < 20; i++) expect(await rateLimited(store.db, digest, start + Math.floor(i / 5) * 600_000)).toBe(false);
    expect(await rateLimited(store.db, digest, start + 4 * 600_000)).toBe(true);
    expect(await rateLimited(store.db, digest, start + 86_400_000)).toBe(false);
  });
  it('checks origins, referer fallback and local development exception', async () => {
    expect((await post(undefined, '', false, { Origin: env.SITE_ORIGIN })).status).toBe(200);
    expect((await post(undefined, '', false, { Origin: 'https://attacker.eu' })).status).toBe(403);
    expect((await post(undefined, '', false, { Referer: 'https://attacker.eu/page' })).status).toBe(403);
    expect((await post(undefined, '', false, { Origin: 'null' })).status).toBe(403);
    expect((await post(undefined, '', false, { Origin: 'http://localhost:4321' })).status).toBe(403);
    env.SITE_ORIGIN = 'http://localhost:4321';
    expect((await post(undefined, '', false, { Origin: 'http://127.0.0.1:9876' })).status).toBe(200);
    expect((await post(undefined, '', false, { Origin: 'http://localhost.attacker.eu:4321' })).status).toBe(403);
  });
  it('redirects form success and every contracted error', async () => {
    const check = (response: Response, location: string) => { expect(response.status).toBe(303); expect(response.headers.get('Location')).toBe(location); };
    check(await post(undefined, '', true), '/?joined=1#join');
    check(await post('bad', '', true), '/?error=invalid_email#join');
    for (let i = 0; i < 3; i++) await post();
    check(await post(undefined, '', true), '/?error=rate_limited#join');
    vi.mocked(Date.now).mockReturnValue(start + 600_000);
    vi.spyOn(store.db, 'batch').mockRejectedValue(new Error('database unavailable'));
    check(await post(undefined, '', true), '/?error=save_failed#join');
    const response = await post(); expect(response.status).toBe(500); expect(await response.json()).toEqual({ ok: false, error: 'save_failed' });
  });
  it('caps streamed body bytes and handles malformed JSON', async () => {
    for (const body of ['{', JSON.stringify({ email: 'a@b.eu', company: 'x'.repeat(2048) })]) {
      const response = await worker.fetch(new Request('https://cerna.example/api/waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }), env, ctx);
      expect(response.status).toBe(400);
    }
    expect(rows('waitlist_signups')).toHaveLength(0);
  });
  it('rolls back the signup if the outbox insert fails', async () => {
    store.sqlite.exec("CREATE TRIGGER reject_outbox BEFORE INSERT ON outbox BEGIN SELECT RAISE(ABORT, 'test'); END");
    expect((await post()).status).toBe(500);
    expect(rows('waitlist_signups')).toHaveLength(0);
  });
  it('rolls back signup and owner row if the welcome insert fails', async () => {
    store.sqlite.exec("CREATE TRIGGER reject_welcome BEFORE INSERT ON outbox WHEN NEW.kind='welcome' BEGIN SELECT RAISE(ABORT, 'test'); END");
    expect((await post()).status).toBe(500);
    expect(rows('waitlist_signups')).toHaveLength(0); expect(rows('outbox')).toHaveLength(0);
  });
  it('routes health, 404 and method errors with Allow', async () => {
    for (const [path, method, status, allow] of [['/api/health', 'GET', 200, null], ['/api/health', 'POST', 405, 'GET'], ['/api/waitlist', 'GET', 405, 'POST'], ['/api/missing', 'GET', 404, null]] as const) {
      const response = await worker.fetch(new Request(`https://cerna.example${path}`, { method }), env, ctx);
      expect(response.status).toBe(status); expect(response.headers.get('Allow')).toBe(allow);
    }
  });
  it('stores no raw IP and logs no emails, IPs or secrets', async () => {
    await post(); await drain();
    expect(JSON.stringify(rows('rate_limits'))).not.toContain('203.0.113.42');
    expect(rows('rate_limits')[0]!.ip_hash).toMatch(/^[0-9a-f]{64}$/);
    const logs = JSON.stringify([vi.mocked(console.log).mock.calls, vi.mocked(console.error).mock.calls]);
    for (const forbidden of ['user@example.eu', '203.0.113.42', env.BREVO_API_KEY, env.RATE_LIMIT_HMAC_KEY]) expect(logs).not.toContain(forbidden);
  });
});

describe('outbox', () => {
  async function seed() { await post(); await drain(); store.sqlite.exec("DELETE FROM outbox WHERE kind='welcome'"); env.EMAIL_ENABLED = 'true'; }
  it('sends with the owned sender and marks sent', async () => {
    await seed(); const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 201 }));
    await processOutbox(env, { now: () => start, send });
    expect(rows('outbox')[0]).toMatchObject({ status: 'sent', attempts: 1, sent_at: new Date(start).toISOString(), locked_until: null });
    const [url, options] = send.mock.calls[0]!;
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(options!.headers).toEqual({ 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY });
    const body = JSON.parse(options!.body as string);
    expect(body.sender).toEqual({ name: 'Cerna', email: env.MAIL_FROM });
    expect(body.to).toEqual([{ email: env.ADMIN_NOTIFY_TO }]);
    expect(body.replyTo).toBeUndefined(); expect(body.textContent.split('\n')).toEqual(['user@example.eu', rows('waitlist_signups')[0]!.created_at, '1']);
    await processOutbox(env, { now: () => start, send }); expect(send).toHaveBeenCalledTimes(1);
  });
  it('retains signup on Brevo 500 and doubles retry delay', async () => {
    await seed(); const send = vi.fn<typeof fetch>().mockResolvedValue(new Response('secret-test-key user@example.eu', { status: 500 }));
    await processOutbox(env, { now: () => start, send });
    expect(rows('waitlist_signups')).toHaveLength(1);
    expect(rows('outbox')[0]).toMatchObject({ status: 'pending', attempts: 1, next_attempt_at: new Date(start + 60_000).toISOString(), last_error: 'notification_send_failed' });
    await processOutbox(env, { now: () => start + 59_999, send }); expect(send).toHaveBeenCalledTimes(1);
    await processOutbox(env, { now: () => start + 60_000, send });
    expect(rows('outbox')[0]!.next_attempt_at).toBe(new Date(start + 180_000).toISOString());
    expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain('user@example.eu');
  });
  it('fails permanently after attempt ten', async () => {
    await seed(); store.sqlite.exec('UPDATE outbox SET attempts=9');
    const send = vi.fn<typeof fetch>().mockRejectedValue(new Error('secret-test-key user@example.eu'));
    await processOutbox(env, { now: () => start, send });
    expect(rows('outbox')[0]).toMatchObject({ status: 'failed', attempts: 10, locked_until: null });
    expect(console.error).toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('secret-test-key');
  });
  it('caps backoff at six hours and exhausts interrupted final claims', async () => {
    await seed(); store.sqlite.exec('UPDATE outbox SET attempts=9');
    const send = vi.fn<typeof fetch>().mockRejectedValue(new Error('failure'));
    await processOutbox(env, { now: () => start, send });
    expect(rows('outbox')[0]!.next_attempt_at).toBe(new Date(start + 21_600_000).toISOString());
    store.sqlite.exec("UPDATE outbox SET status='pending', next_attempt_at='2020-01-01', attempts=10");
    await processOutbox(env, { now: () => start, send }); expect(send).toHaveBeenCalledTimes(1);
    expect(rows('outbox')[0]!.status).toBe('failed');
  });
  it('disabled logs once per run, leaves pending and later delivers backlog', async () => {
    await post(); await drain(); vi.mocked(console.log).mockClear();
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 201 }));
    await processOutbox(env, { now: () => start, send });
    expect(console.log).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ event: 'email disabled' }));
    expect(rows('outbox')[0]).toMatchObject({ status: 'pending', attempts: 0 }); expect(send).not.toHaveBeenCalled();
    env.EMAIL_ENABLED = 'true'; await processOutbox(env, { now: () => start, send }); expect(send).toHaveBeenCalledTimes(2);
  });
  it('cleans expired counters with email disabled without touching pending rows', async () => {
    await post(); await drain();
    const pending = rows('outbox');
    const cutoff = Math.floor(start / 86_400_000) * 86_400_000 - 86_400_000;
    for (const windowStart of [cutoff - 1, cutoff]) {
      store.sqlite.prepare("INSERT INTO rate_limits VALUES (?, 'day', ?, 1)").run('a'.repeat(64), windowStart);
    }
    const send = vi.fn<typeof fetch>();
    await processOutbox(env, { now: () => start, send });
    expect(rows('rate_limits').filter(row => row.ip_hash === 'a'.repeat(64))).toEqual([
      expect.objectContaining({ window_start: cutoff }),
    ]);
    expect(rows('outbox')).toEqual(pending);
    expect(send).not.toHaveBeenCalled();
  });
  it('concurrent processors claim the same row only once', async () => {
    await seed(); const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 201 }));
    await Promise.all([processOutbox(env, { now: () => start, send }), processOutbox(env, { now: () => start, send })]);
    expect(send).toHaveBeenCalledTimes(1); expect(rows('outbox')[0]!.status).toBe('sent');
  });
  it('a failed background send cannot change the signup success response', async () => {
    env.EMAIL_ENABLED = 'true';
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 500 }));
    vi.stubGlobal('fetch', send);
    try {
      const response = await post();
      expect(response.status).toBe(200); expect(await response.json()).toEqual({ ok: true });
      await drain();
      expect(rows('waitlist_signups')).toHaveLength(1);
      expect(rows('outbox')[0]).toMatchObject({ status: 'pending', attempts: 1 });
      expect(send).toHaveBeenCalledTimes(2);
    } finally { vi.unstubAllGlobals(); }
  });
  it('the scheduled entry point drains a due retry through waitUntil', async () => {
    await seed();
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', send);
    try {
      await worker.scheduled({} as ScheduledController, env, ctx);
      await drain();
      expect(send).toHaveBeenCalledTimes(1); expect(rows('outbox')[0]!.status).toBe('sent');
    } finally { vi.unstubAllGlobals(); }
  });
  it('processes at most twenty rows', async () => {
    for (let i = 0; i < 21; i++) {
      const id = `signup-${i}`;
      store.sqlite.prepare("INSERT INTO waitlist_signups VALUES (?,?,?,'v1','One email when Cerna opens, nothing else.','landing')").run(id, `${i}@example.eu`, new Date(start).toISOString());
      store.sqlite.prepare("INSERT INTO outbox(id,signup_id,kind,next_attempt_at) VALUES (?,?,'owner_notification',?)").run(`outbox-${i}`, id, new Date(start).toISOString());
    }
    env.EMAIL_ENABLED = 'true'; const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 201 }));
    await processOutbox(env, { now: () => start, send }); expect(send).toHaveBeenCalledTimes(20);
    expect(rows('outbox').filter(row => row.status === 'pending')).toHaveLength(1);
  });
});

describe('welcome and unsubscribe', () => {
  async function seed() {
    await post(); await drain();
    const id = rows('waitlist_signups')[0]!.id as string;
    return unsubscribeToken(id, env.UNSUBSCRIBE_HMAC_KEY);
  }
  function remove(token: string, encoding = 'query', headers: Record<string, string> = {}) {
    const query = ['query', 'one-click'].includes(encoding) ? `?token=${token}` : '';
    const type = encoding === 'json' ? 'application/json' : 'application/x-www-form-urlencoded';
    const body = encoding === 'json' ? JSON.stringify({ token }) : encoding === 'one-click' ? 'List-Unsubscribe=One-Click' : encoding === 'form' ? new URLSearchParams({ token }).toString() : '';
    return worker.fetch(new Request(`https://cerna.example/api/unsubscribe${query}`, {
      method: 'POST', headers: { 'Content-Type': encoding === 'query' ? 'text/plain' : type, 'CF-Connecting-IP': '203.0.113.43', ...headers }, body,
    }), env, ctx);
  }
  it('migrates old consent and delivery state without losing rows or indexes', () => {
    const old = database(false);
    try {
      old.sqlite.exec("INSERT INTO waitlist_signups VALUES ('old','old@example.eu','2026-10-20','old-version','One email when Cerna opens, nothing else.','landing')");
      old.sqlite.exec("INSERT INTO outbox VALUES ('delivery','old','owner_notification','sent',3,'2026-10-20',NULL,NULL,'2026-10-20')");
      const signup = old.sqlite.prepare('SELECT * FROM waitlist_signups').all();
      const outbox = old.sqlite.prepare('SELECT * FROM outbox').all();
      old.sqlite.exec('BEGIN');
      old.sqlite.exec(readFileSync(new URL('../migrations/0002_welcome_unsubscribe.sql', import.meta.url), 'utf8'));
      old.sqlite.exec('COMMIT');
      expect(old.sqlite.prepare('SELECT * FROM waitlist_signups').all()).toEqual(signup);
      expect(old.sqlite.prepare('SELECT * FROM outbox').all()).toEqual(outbox);
      expect(old.sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      for (const name of ['outbox_due', 'signups_created', 'rate_limits_expiry']) {
        expect(old.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name=?").all(name)).toHaveLength(1);
      }
      old.sqlite.exec("INSERT INTO outbox(id,signup_id,kind,next_attempt_at) VALUES ('welcome','old','welcome','2026-10-22')");
      expect(() => old.sqlite.exec("INSERT INTO outbox(id,signup_id,kind,next_attempt_at) VALUES ('duplicate','old','welcome','2026-10-22')")).toThrow();
      old.sqlite.exec("DELETE FROM waitlist_signups WHERE id='old'");
      expect(old.sqlite.prepare('SELECT * FROM outbox').all()).toEqual([]);
    } finally { old.sqlite.close(); }
  });
  it('sends the unchanged welcome template and signed unsubscribe headers to the signup', async () => {
    const token = await seed();
    expect(rows('outbox').map(row => row.kind).sort()).toEqual(['owner_notification', 'welcome']);
    env.EMAIL_ENABLED = 'true';
    const send = vi.fn<typeof fetch>().mockImplementation(async () => new Response(null, { status: 201 }));
    await processOutbox(env, { now: () => start, send });
    const bodies = send.mock.calls.map(([, options]) => JSON.parse(options!.body as string));
    expect(bodies).toHaveLength(2);
    const body = bodies.find(body => body.to[0].email === 'user@example.eu');
    const message = welcomeEmail(`${env.SITE_ORIGIN}/unsubscribe?token=${token}`);
    expect(body).toMatchObject({ sender: { name: env.MAIL_FROM_NAME, email: env.MAIL_FROM }, subject: message.subject, textContent: message.text, htmlContent: message.html,
      headers: { 'List-Unsubscribe': `<${env.SITE_ORIGIN}/api/unsubscribe?token=${token}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } });
    const sentToken = new URL(body.headers['List-Unsubscribe'].slice(1, -1)).searchParams.get('token');
    expect(await verifyUnsubscribeToken(sentToken, env.UNSUBSCRIBE_HMAC_KEY)).toBe(rows('waitlist_signups')[0]!.id);
    expect(bodies.find(body => body.to[0].email === env.ADMIN_NOTIFY_TO).subject).toBe('New Cerna waitlist signup');
    expect(rows('outbox').every(row => row.status === 'sent')).toBe(true);
    const logs = JSON.stringify([vi.mocked(console.log).mock.calls, vi.mocked(console.error).mock.calls]);
    for (const value of ['user@example.eu', env.UNSUBSCRIBE_HMAC_KEY, token]) expect(logs).not.toContain(value);
  });
  it.each(['query', 'json', 'one-click', 'form'])('deletes signup and both outbox rows via %s, idempotently', async encoding => {
    const token = await seed();
    for (let i = 0; i < 2; i++) {
      const response = await remove(token, encoding);
      expect(response.status).toBe(encoding === 'form' ? 303 : 200);
      if (encoding === 'form') expect(response.headers.get('Location')).toBe('/unsubscribe?done=1');
      else expect(await response.json()).toEqual({ ok: true });
      expect(rows('waitlist_signups')).toHaveLength(0);
      expect(rows('outbox')).toHaveLength(0);
    }
  });
  it('rejects tampered, wrong-key and malformed tokens without deleting', async () => {
    const token = await seed();
    const tampered = token.slice(0, -1) + (token.endsWith('0') ? '1' : '0');
    const wrongKey = await unsubscribeToken(token.split('.')[0]!, 'wrong-key');
    for (const value of [tampered, wrongKey, 'abc', '']) {
      const response = await remove(value);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ ok: false, error: 'invalid_token' });
      expect(rows('waitlist_signups')).toHaveLength(1);
      expect(rows('outbox')).toHaveLength(2);
    }
    const response = await remove(tampered, 'form');
    expect(response.status).toBe(303); expect(response.headers.get('Location')).toBe('/unsubscribe?error=invalid_token');
  });
  it('GET preserves query and never deletes; other methods return Allow', async () => {
    const token = await seed();
    const response = await worker.fetch(new Request(`https://cerna.example/api/unsubscribe?token=${token}&extra=1`), env, ctx);
    expect(response.status).toBe(303); expect(response.headers.get('Location')).toBe(`/unsubscribe?token=${token}&extra=1`);
    expect(rows('waitlist_signups')).toHaveLength(1); expect(rows('outbox')).toHaveLength(2);
    const rejected = await worker.fetch(new Request('https://cerna.example/api/unsubscribe', { method: 'PUT' }), env, ctx);
    expect(rejected.status).toBe(405); expect(rejected.headers.get('Allow')).toBe('GET, POST');
  });
  it('shares the waitlist limiter and checks origins', async () => {
    const token = await seed();
    expect((await remove(token, 'query', { Origin: 'https://attacker.eu' })).status).toBe(403);
    expect((await remove(token, 'query', { Referer: 'https://attacker.eu/page' })).status).toBe(403);
    for (let i = 0; i < 4; i++) await post();
    const response = await remove(token, 'query', { 'CF-Connecting-IP': '203.0.113.42' });
    expect(response.status).toBe(429); expect(await response.json()).toEqual({ ok: false, error: 'rate_limited' });
    const oneClick = await remove(token, 'one-click', { 'CF-Connecting-IP': '203.0.113.42' });
    expect(oneClick.status).toBe(429); expect(await oneClick.json()).toEqual({ ok: false, error: 'rate_limited' });
    expect(rows('waitlist_signups')).toHaveLength(1);
  });
  it.each(['{', JSON.stringify({ token: 'x'.repeat(2048) })])('rejects malformed or oversized bodies', async body => {
    await seed();
    const response = await worker.fetch(new Request('https://cerna.example/api/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }), env, ctx);
    expect(response.status).toBe(400); expect(await response.json()).toEqual({ ok: false, error: 'invalid_token' });
    expect(rows('waitlist_signups')).toHaveLength(1);
  });
});

describe('analytics proxy', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  const proxy = (path = '/ingest/e/?v=1', init: RequestInit = {}) => worker.fetch(new Request(`https://cerna.example${path}`, init), env, ctx);
  it('forwards EU path, query, body and browser headers without credentials or cached responses', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response('accepted', { status: 202, headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'bad=1' } }));
    vi.stubGlobal('fetch', send);
    const response = await proxy('/ingest/e/?v=1&x=two', { method: 'POST', body: '{"event":"$pageview"}', headers: {
      Referer: 'https://cerna.example/?email=private@example.com', Cookie: 'secret=1', Authorization: 'Bearer secret', 'CF-Connecting-IP': '203.0.113.42', 'X-Forwarded-For': 'spoofed', 'User-Agent': 'test-browser', 'Content-Type': 'application/json',
    } });
    const [url, options] = send.mock.calls[0]!;
    expect(url).toBe('https://eu.i.posthog.com/e/?v=1&x=two');
    expect(options!.method).toBe('POST'); expect(new TextDecoder().decode(options!.body as Uint8Array)).toBe('{"event":"$pageview"}');
    const headers = new Headers(options!.headers);
    expect(headers.has('Referer')).toBe(false); expect(headers.has('Cookie')).toBe(false); expect(headers.has('Authorization')).toBe(false);
    expect(headers.get('X-Forwarded-For')).toBe('203.0.113.42'); expect(headers.get('User-Agent')).toBe('test-browser');
    expect(options!.cache).toBe('no-store'); expect(options!.redirect).toBe('error');
    expect(response.status).toBe(202); expect(await response.text()).toBe('accepted');
    expect(response.headers.get('Content-Type')).toBe('application/json'); expect(response.headers.get('Cache-Control')).toBe('no-store'); expect(response.headers.has('Set-Cookie')).toBe(false);
  });
  it.each(['GET', 'OPTIONS'])('forwards %s and static paths to the EU asset hostname', async method => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })); vi.stubGlobal('fetch', send);
    expect((await proxy('/ingest/static/file.js?v=2', { method, headers: { 'X-Forwarded-For': 'spoofed' } })).status).toBe(204);
    expect(send.mock.calls[0]![0]).toBe('https://eu-assets.i.posthog.com/static/file.js?v=2');
    expect(send.mock.calls[0]![1]!.method).toBe(method);
    expect(new Headers(send.mock.calls[0]![1]!.headers).has('X-Forwarded-For')).toBe(false);
  });
  it.each(['PUT', 'PATCH', 'DELETE', 'HEAD'])('rejects %s without contacting upstream', async method => {
    const send = vi.fn(); vi.stubGlobal('fetch', send);
    const response = await proxy(undefined, { method });
    expect(response.status).toBe(405); expect(response.headers.get('Allow')).toBe('GET, POST, OPTIONS'); expect(send).not.toHaveBeenCalled();
  });
  it('caps actual bytes as well as Content-Length at 64 KB', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok')); vi.stubGlobal('fetch', send);
    expect((await proxy(undefined, { method: 'POST', body: 'x'.repeat(65537) })).status).toBe(413);
    expect((await proxy(undefined, { method: 'POST', headers: { 'Content-Length': '65537' }, body: 'x' })).status).toBe(413);
    expect(send).not.toHaveBeenCalled();
    expect((await proxy(undefined, { method: 'POST', body: 'x'.repeat(65536) })).status).toBe(200);
  });
  it('returns 502 on failure and on the 10-second upstream timeout', async () => {
    const send = vi.fn<typeof fetch>().mockRejectedValue(new Error('upstream failed')); vi.stubGlobal('fetch', send);
    expect((await proxy()).status).toBe(502);
    vi.useFakeTimers();
    send.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options!.signal!.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const pending = proxy();
    await vi.advanceTimersByTimeAsync(10_000);
    expect((await pending).status).toBe(502);
  });
});
