export async function ipDigest(ip: string, secret: string): Promise<string> {
  if (!secret) throw new Error('missing_hmac_key');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(ip));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function rateLimited(db: D1Database, digest: string, now: number): Promise<boolean> {
  const windows = [['short', 600_000, 5], ['day', 86_400_000, 20]] as const;
  const statements = windows.map(([kind, duration]) => db.prepare(`
    INSERT INTO rate_limits(ip_hash, window_kind, window_start, attempts) VALUES (?, ?, ?, 1)
    ON CONFLICT(ip_hash, window_kind, window_start) DO UPDATE SET attempts = attempts + 1
    RETURNING attempts`).bind(digest, kind, Math.floor(now / duration) * duration));
  const results = await db.batch<{ attempts: number }>(statements);
  return results.some((result, index) => result.results[0]!.attempts > windows[index]![2]);
}
