INSERT INTO invite_codes (code, label, max_devices, revoked, expires_at, created_at, updated_at)
VALUES ('0615-DEMO', '测试邀请码', 2, 0, NULL, unixepoch() * 1000, unixepoch() * 1000)
ON CONFLICT(code) DO UPDATE SET
  label = excluded.label,
  max_devices = excluded.max_devices,
  revoked = excluded.revoked,
  expires_at = excluded.expires_at,
  updated_at = excluded.updated_at;

