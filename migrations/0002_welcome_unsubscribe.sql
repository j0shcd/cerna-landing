-- Save children before replacing their parent; foreign keys stay enabled.
PRAGMA defer_foreign_keys=ON;
CREATE TABLE outbox_backup AS SELECT * FROM outbox;
DROP TABLE outbox;
CREATE TABLE waitlist_signups_new (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE CHECK(length(email) BETWEEN 3 AND 254),
  created_at TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  consent_text TEXT NOT NULL CHECK(consent_text IN ('One email when Cerna opens, nothing else.', 'Get notified when we launch.')),
  source TEXT NOT NULL CHECK(source = 'landing')
);
INSERT INTO waitlist_signups_new SELECT * FROM waitlist_signups;
DROP TABLE waitlist_signups;
ALTER TABLE waitlist_signups_new RENAME TO waitlist_signups;
CREATE TABLE outbox (
  id TEXT PRIMARY KEY,
  signup_id TEXT NOT NULL REFERENCES waitlist_signups(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('owner_notification', 'welcome')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 10),
  next_attempt_at TEXT NOT NULL,
  last_error TEXT CHECK(length(last_error) <= 200),
  locked_until TEXT,
  sent_at TEXT,
  UNIQUE(signup_id, kind),
  CHECK((status = 'sent') = (sent_at IS NOT NULL))
);
INSERT INTO outbox SELECT * FROM outbox_backup;
DROP TABLE outbox_backup;
CREATE INDEX outbox_due ON outbox(status, next_attempt_at);
CREATE INDEX signups_created ON waitlist_signups(created_at);
