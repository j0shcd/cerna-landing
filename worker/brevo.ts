import type { Env } from './env';
export async function sendNotification(env: Env, signup: { email: string; created_at: string }, total: number, send: typeof fetch = fetch): Promise<void> {
  const response = await send('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({ sender: { name: env.MAIL_FROM_NAME, email: env.MAIL_FROM },
      to: [{ email: env.ADMIN_NOTIFY_TO }], subject: 'New Cerna waitlist signup',
      textContent: `${signup.email}\n${signup.created_at}\n${total}` }),
  });
  // Never propagate vendor response bodies, which may contain personal data or secrets.
  await response.body?.cancel();
  if (!response.ok) throw new Error('brevo_send_failed');
}
