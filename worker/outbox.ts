import type { Env } from './env';
import { sendNotification } from './brevo';
interface Row { id: string; signup_id: string; attempts: number }
export async function processOutbox(env: Env, deps: { now?: () => number; send?: typeof fetch } = {}): Promise<void> {
  const clock = deps.now ?? Date.now;
  const db = env.WAITLIST_DB;
  // Retain only the current and previous day's digest counters.
  await db.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(Math.floor(clock() / 86_400_000) * 86_400_000 - 86_400_000).run();
  if (env.EMAIL_ENABLED !== 'true') { console.log(JSON.stringify({ event: 'email disabled' })); return; }
  const now = new Date(clock()).toISOString();
  const rows = await db.prepare(`SELECT id, signup_id, attempts FROM outbox
    WHERE status='pending' AND next_attempt_at <= ? AND (locked_until IS NULL OR locked_until < ?)
    ORDER BY next_attempt_at, id LIMIT 20`).bind(now, now).all<Row>();
  for (const row of rows.results) {
    const claimedAt = new Date(clock()).toISOString();
    const lock = new Date(clock() + 60_000).toISOString();
    const claim = await db.prepare(`UPDATE outbox SET locked_until=?
      WHERE id=? AND status='pending' AND next_attempt_at <= ? AND (locked_until IS NULL OR locked_until < ?)
      RETURNING id`).bind(lock, row.id, claimedAt, claimedAt).first();
    if (!claim) continue;
    // attempts increments at claim time, including interrupted runs.
    const attempt = await db.prepare(`UPDATE outbox SET attempts=attempts+1
      WHERE id=? AND locked_until=? AND attempts < 10 RETURNING attempts`).bind(row.id, lock).first<{ attempts: number }>();
    if (!attempt) {
      await db.prepare(`UPDATE outbox SET status='failed', locked_until=NULL, last_error='attempts_exhausted'
        WHERE id=? AND locked_until=?`).bind(row.id, lock).run();
      console.error(JSON.stringify({ event: 'notification_failed', reason: 'attempts_exhausted' }));
      continue;
    }
    let sent = false;
    try {
      const signup = await db.prepare('SELECT email, created_at FROM waitlist_signups WHERE id=?').bind(row.signup_id).first<{ email: string; created_at: string }>();
      const total = await db.prepare('SELECT COUNT(*) AS total FROM waitlist_signups').first<{ total: number }>();
      if (!signup || !total) throw new Error('missing_signup');
      await sendNotification(env, signup, total.total, deps.send);
      sent = true;
    } catch { /* Use a fixed error code; never log email, credentials or vendor text. */ }
    const finished = clock();
    if (sent) {
      await db.prepare(`UPDATE outbox SET status='sent', sent_at=?, locked_until=NULL, last_error=NULL
        WHERE id=? AND locked_until=?`).bind(new Date(finished).toISOString(), row.id, lock).run();
      console.log(JSON.stringify({ event: 'notification_sent' }));
    } else {
      const failed = attempt.attempts >= 10;
      const retry = new Date(finished + Math.min(60_000 * 2 ** (attempt.attempts - 1), 21_600_000)).toISOString();
      await db.prepare(`UPDATE outbox SET status=?, next_attempt_at=?, last_error='notification_send_failed', locked_until=NULL
        WHERE id=? AND locked_until=?`).bind(failed ? 'failed' : 'pending', retry, row.id, lock).run();
      (failed ? console.error : console.log)(JSON.stringify({ event: failed ? 'notification_failed' : 'notification_retry', attempts: attempt.attempts }));
    }
  }
}
