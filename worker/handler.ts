import { verifyUnsubscribeToken } from './unsubscribe';
import type { Env } from './env';
import { allowedOrigin, CONSENT_TEXT, normalizeEmail, readBody } from './validate';
import { ipDigest, rateLimited } from './ratelimit';
import { processOutbox } from './outbox';
export async function waitlist(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const type = request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase();
  const form = type === 'application/x-www-form-urlencoded';
  const reply = (status: number, error?: string) => form
    ? new Response(null, { status: 303, headers: { Location: error ? `/?error=${error}#join` : '/?joined=1#join', 'Cache-Control': 'no-store' } })
    : Response.json(error ? { ok: false, error } : { ok: true }, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!allowedOrigin(request, env.SITE_ORIGIN)) return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });
  let email: string | null;
  let company: unknown;
  try {
    const body = await readBody(request);
    const fields = form ? Object.fromEntries(new URLSearchParams(body)) : type === 'application/json' ? JSON.parse(body) : null;
    email = normalizeEmail(fields?.email);
    company = fields?.company;
  } catch { return reply(400, 'invalid_email'); }
  if (typeof company === 'string' && company.length > 0) return reply(200);
  try {
    const digest = await ipDigest(request.headers.get('CF-Connecting-IP') ?? 'unknown', env.RATE_LIMIT_HMAC_KEY);
    if (await rateLimited(env.WAITLIST_DB, digest, Date.now())) return reply(429, 'rate_limited');
    if (!email) return reply(400, 'invalid_email');
    const id = crypto.randomUUID();
    const now = new Date(Date.now()).toISOString();
    await env.WAITLIST_DB.batch([
      env.WAITLIST_DB.prepare(`INSERT INTO waitlist_signups(id,email,created_at,consent_version,consent_text,source)
        VALUES (?,?,?,?,?,'landing') ON CONFLICT(email) DO NOTHING`).bind(id, email, now, env.CONSENT_VERSION, CONSENT_TEXT),
      env.WAITLIST_DB.prepare(`INSERT INTO outbox(id,signup_id,kind,next_attempt_at)
        SELECT ?, id, 'owner_notification', ? FROM waitlist_signups WHERE id=?`).bind(crypto.randomUUID(), now, id),
      env.WAITLIST_DB.prepare(`INSERT INTO outbox(id,signup_id,kind,next_attempt_at)
        SELECT ?, id, 'welcome', ? FROM waitlist_signups WHERE id=?`).bind(crypto.randomUUID(), now, id),
    ]);
    ctx.waitUntil(processOutbox(env).catch(() => console.error(JSON.stringify({ event: 'outbox_processing_failed' }))));
    return reply(200);
  } catch {
    console.error(JSON.stringify({ event: 'waitlist_save_failed' }));
    return reply(500, 'save_failed');
  }
}

export async function unsubscribe(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'GET') return new Response(null, { status: 303, headers: { Location: `/unsubscribe${url.search}`, 'Cache-Control': 'no-store' } });
  const type = request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase();
  let form = type === 'application/x-www-form-urlencoded';
  const reply = (status: number, error?: string) => form
    ? new Response(null, { status: 303, headers: { Location: error ? `/unsubscribe?error=${error}` : '/unsubscribe?done=1', 'Cache-Control': 'no-store' } })
    : Response.json(error ? { ok: false, error } : { ok: true }, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!allowedOrigin(request, env.SITE_ORIGIN)) return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });
  try {
    let token: unknown = url.searchParams.get('token');
    try {
      const body = await readBody(request);
      const fields = type === 'application/json' ? (body ? JSON.parse(body) : {}) : Object.fromEntries(new URLSearchParams(body));
      if (fields?.['List-Unsubscribe'] === 'One-Click') form = false;
      token ??= fields?.token;
    } catch { return reply(400, 'invalid_token'); }
    const digest = await ipDigest(request.headers.get('CF-Connecting-IP') ?? 'unknown', env.RATE_LIMIT_HMAC_KEY);
    if (await rateLimited(env.WAITLIST_DB, digest, Date.now())) return reply(429, 'rate_limited');
    const id = await verifyUnsubscribeToken(token, env.UNSUBSCRIBE_HMAC_KEY);
    if (!id) return reply(400, 'invalid_token');
    await env.WAITLIST_DB.prepare('DELETE FROM waitlist_signups WHERE id=?').bind(id).run();
    return reply(200);
  } catch {
    console.error(JSON.stringify({ event: 'unsubscribe_save_failed' }));
    return reply(500, 'save_failed');
  }
}
