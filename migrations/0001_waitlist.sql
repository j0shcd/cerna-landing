CREATE TABLE waitlist_signups (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE CHECK(length(email) BETWEEN 3 AND 254),
  created_at TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  consent_text TEXT NOT NULL CHECK(consent_text = 'One email when Cerna opens, nothing else.'),
  source TEXT NOT NULL CHECK(source = 'landing')
);
CREATE TABLE outbox (
  id TEXT PRIMARY KEY,
  signup_id TEXT NOT NULL UNIQUE REFERENCES waitlist_signups(id),
  kind TEXT NOT NULL CHECK(kind = 'owner_notification'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 10),
  next_attempt_at TEXT NOT NULL,
  last_error TEXT CHECK(length(last_error) <= 200),
  locked_until TEXT,
  sent_at TEXT,
  CHECK((status = 'sent') = (sent_at IS NOT NULL))
);
CREATE INDEX outbox_due ON outbox(status, next_attempt_at);
CREATE INDEX signups_created ON waitlist_signups(created_at);
CREATE TABLE rate_limits (
  ip_hash TEXT NOT NULL CHECK(length(ip_hash) = 64 AND ip_hash NOT GLOB '*[^0-9a-f]*'),
  window_kind TEXT NOT NULL CHECK(window_kind IN ('short', 'day')),
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL CHECK(attempts > 0),
  PRIMARY KEY(ip_hash, window_kind, window_start)
);
CREATE INDEX rate_limits_expiry ON rate_limits(window_start);
