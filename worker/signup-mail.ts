import type { Env } from './env';
import { sendNotification, sendWelcome } from './brevo';

const identifier = /^[a-zA-Z0-9_-]{1,128}$/;

/** Every send and cancellation for a signup uses the same EU object. */
export function signupMail(env: Env, signupId: string): DurableObjectStub {
  if (!env.SIGNUP_MAIL || !identifier.test(signupId)) throw new Error('mail_coordinator_unavailable');
  const namespace = env.SIGNUP_MAIL.jurisdiction('eu');
  return namespace.get(namespace.idFromName(signupId));
}

export async function mailOperation(
  env: Env, signupId: string, operation: 'deliver' | 'unsubscribe',
  claim?: { outboxId: string; lock: string },
): Promise<Response> {
  return signupMail(env, signupId).fetch(new Request(`https://signup-mail.internal/${operation}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signupId, ...claim }),
  }));
}

/** SQLite-backed by Wrangler; storage contains only signup ID and revocation. */
export class SignupMail implements DurableObject {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
    private readonly send: typeof fetch = fetch,
  ) {}

  fetch(request: Request): Promise<Response> {
    // D1 rechecks alone cannot serialize deletion against a later external
    // fetch. Keep the complete async operation inside one object input gate.
    // Brevo fetches have a 15s timeout; the platform bounds this gate at 30s.
    return this.state.blockConcurrencyWhile(async () => {
      try {
        const path = new URL(request.url).pathname;
        if (request.method !== 'POST' || !['/deliver', '/unsubscribe'].includes(path)) {
          return new Response(null, { status: 404 });
        }
        const body = await request.json<{ signupId?: unknown; outboxId?: unknown; lock?: unknown }>();
        if (typeof body.signupId !== 'string' || !identifier.test(body.signupId)) return new Response(null, { status: 400 });
        const signupId = body.signupId;
        const owner = await this.state.storage.get<string>('signup_id');
        if (owner !== undefined && owner !== signupId) return new Response(null, { status: 409 });
        if (owner === undefined) await this.state.storage.put('signup_id', signupId);
        if (path === '/unsubscribe') {
          // Persist first and never erase this tombstone with the D1 rows. A
          // failed deletion can be retried without re-enabling delayed work.
          await this.state.storage.put('revoked', true);
          await this.env.WAITLIST_DB.prepare('DELETE FROM waitlist_signups WHERE id=?').bind(signupId).run();
          return new Response(null, { status: 204 });
        }
        if (await this.state.storage.get<boolean>('revoked') === true) return new Response(null, { status: 410 });
        if (this.env.EMAIL_ENABLED !== 'true') return new Response(null, { status: 503 });
        if (typeof body.outboxId !== 'string' || typeof body.lock !== 'string') return new Response(null, { status: 400 });
        const row = await this.env.WAITLIST_DB.prepare(`SELECT kind FROM outbox
          WHERE id=? AND signup_id=? AND status='pending' AND locked_until=? AND locked_until > ?`)
          .bind(body.outboxId, signupId, body.lock, new Date(Date.now()).toISOString()).first<{ kind: string }>();
        if (!row) return new Response(null, { status: 409 });
        const signup = await this.env.WAITLIST_DB.prepare('SELECT email, created_at FROM waitlist_signups WHERE id=?')
          .bind(signupId).first<{ email: string; created_at: string }>();
        const total = await this.env.WAITLIST_DB.prepare('SELECT COUNT(*) AS total FROM waitlist_signups').first<{ total: number }>();
        if (!signup || !total) return new Response(null, { status: 409 });
        if (row.kind === 'welcome') await sendWelcome(this.env, signup.email, signupId, this.send);
        else if (row.kind === 'owner_notification') await sendNotification(this.env, signup, total.total, this.send);
        else return new Response(null, { status: 400 });
        return new Response(null, { status: 204 });
      } catch {
        // Fixed status only: never forward vendor errors, email or credentials.
        return new Response(null, { status: 502 });
      }
    });
  }
}
