export interface Env {
  WAITLIST_DB: D1Database;
  SITE_ORIGIN: string;
  MAIL_FROM: string;
  MAIL_FROM_NAME: string;
  ADMIN_NOTIFY_TO: string;
  CONSENT_VERSION: string;
  EMAIL_ENABLED: string;
  BREVO_API_KEY: string;
  RATE_LIMIT_HMAC_KEY: string;
}
