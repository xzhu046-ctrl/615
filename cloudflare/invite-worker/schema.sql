CREATE TABLE IF NOT EXISTS invite_codes (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL DEFAULT '',
  max_devices INTEGER NOT NULL DEFAULT 2,
  revoked INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS invite_devices (
  code TEXT NOT NULL,
  device_hash TEXT NOT NULL,
  session_token TEXT NOT NULL,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  last_ip_hash TEXT NOT NULL DEFAULT '',
  last_ua_hash TEXT NOT NULL DEFAULT '',
  revoked INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (code, device_hash),
  FOREIGN KEY (code) REFERENCES invite_codes(code)
);

CREATE TABLE IF NOT EXISTS invite_access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL DEFAULT '',
  device_hash TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  ok INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  ip_hash TEXT NOT NULL DEFAULT '',
  ua_hash TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invite_devices_code_active
  ON invite_devices (code, revoked, last_seen);

CREATE INDEX IF NOT EXISTS idx_invite_access_logs_code_created
  ON invite_access_logs (code, created_at);

