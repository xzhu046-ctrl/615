const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8'
};

function corsHeaders(env){
  return {
    'access-control-allow-origin': env.ALLOWED_ORIGIN || '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400'
  };
}

function json(data, status, env){
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({}, JSON_HEADERS, corsHeaders(env || {}))
  });
}

function normalizeCode(value){
  return String(value || '').trim().toUpperCase();
}

function normalizeDeviceHash(value){
  return String(value || '').trim().toLowerCase().replace(/[^a-f0-9]/g, '').slice(0, 128);
}

function nowMs(){
  return Date.now();
}

function randomToken(){
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b)=>b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value){
  const bytes = new TextEncoder().encode(String(value || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b)=>b.toString(16).padStart(2, '0')).join('');
}

async function requestMeta(request, env){
  const ip = request.headers.get('cf-connecting-ip') || '';
  const ua = request.headers.get('user-agent') || '';
  const salt = String(env.LOG_SALT || 'phone-invite').trim();
  return {
    ipHash: await sha256Hex(salt + '|ip|' + ip),
    uaHash: await sha256Hex(salt + '|ua|' + ua)
  };
}

async function readJson(request){
  try{
    return await request.json();
  }catch(err){
    return {};
  }
}

async function logAccess(env, row){
  try{
    await env.DB.prepare(
      'INSERT INTO invite_access_logs (code, device_hash, action, ok, reason, ip_hash, ua_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      row.code || '',
      row.deviceHash || '',
      row.action || '',
      row.ok ? 1 : 0,
      row.reason || '',
      row.ipHash || '',
      row.uaHash || '',
      nowMs()
    ).run();
  }catch(err){}
}

async function reject(env, meta, code, deviceHash, action, message, status){
  await logAccess(env, {
    code,
    deviceHash,
    action,
    ok: false,
    reason: message,
    ipHash: meta.ipHash,
    uaHash: meta.uaHash
  });
  return json({ ok:false, message }, status || 400, env);
}

async function handleVerify(request, env){
  const body = await readJson(request);
  const meta = await requestMeta(request, env);
  const code = normalizeCode(body.code);
  const deviceHash = normalizeDeviceHash(body.deviceHash);
  if(!code) return reject(env, meta, code, deviceHash, 'verify', '邀请码不能为空', 400);
  if(!deviceHash) return reject(env, meta, code, deviceHash, 'verify', '设备信息无效', 400);

  const invite = await env.DB.prepare('SELECT * FROM invite_codes WHERE code = ?').bind(code).first();
  if(!invite) return reject(env, meta, code, deviceHash, 'verify', '邀请码不存在', 404);
  if(Number(invite.revoked || 0)) return reject(env, meta, code, deviceHash, 'verify', '邀请码已停用', 403);
  if(invite.expires_at && Number(invite.expires_at) < nowMs()) return reject(env, meta, code, deviceHash, 'verify', '邀请码已过期', 403);

  const existing = await env.DB.prepare(
    'SELECT * FROM invite_devices WHERE code = ? AND device_hash = ? AND revoked = 0'
  ).bind(code, deviceHash).first();

  const token = randomToken();
  if(existing){
    await env.DB.prepare(
      'UPDATE invite_devices SET session_token = ?, last_seen = ?, last_ip_hash = ?, last_ua_hash = ? WHERE code = ? AND device_hash = ?'
    ).bind(token, nowMs(), meta.ipHash, meta.uaHash, code, deviceHash).run();
    const countRow = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM invite_devices WHERE code = ? AND revoked = 0'
    ).bind(code).first();
    const count = Number(countRow && countRow.count || 0);
    await logAccess(env, { code, deviceHash, action:'verify', ok:true, reason:'existing_device', ipHash:meta.ipHash, uaHash:meta.uaHash });
    return json({ ok:true, code, token, deviceCount:count, maxDevices:Number(invite.max_devices || 2) || 2 }, 200, env);
  }

  const countRow = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM invite_devices WHERE code = ? AND revoked = 0'
  ).bind(code).first();
  const count = Number(countRow && countRow.count || 0);
  const maxDevices = Number(invite.max_devices || 2) || 2;
  if(count >= maxDevices){
    return reject(env, meta, code, deviceHash, 'verify', '这个邀请码已经绑定满 ' + maxDevices + ' 台设备，请联系作者重置。', 403);
  }

  await env.DB.prepare(
    'INSERT INTO invite_devices (code, device_hash, session_token, first_seen, last_seen, last_ip_hash, last_ua_hash, revoked) VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
  ).bind(code, deviceHash, token, nowMs(), nowMs(), meta.ipHash, meta.uaHash).run();
  await env.DB.prepare('UPDATE invite_codes SET updated_at = ? WHERE code = ?').bind(nowMs(), code).run();
  await logAccess(env, { code, deviceHash, action:'verify', ok:true, reason:'new_device', ipHash:meta.ipHash, uaHash:meta.uaHash });
  return json({ ok:true, code, token, deviceCount:count + 1, maxDevices }, 200, env);
}

async function handleSession(request, env){
  const body = await readJson(request);
  const meta = await requestMeta(request, env);
  const code = normalizeCode(body.code);
  const token = String(body.token || '').trim();
  const deviceHash = normalizeDeviceHash(body.deviceHash);
  if(!code || !token || !deviceHash) return reject(env, meta, code, deviceHash, 'session', '通行凭证无效，请重新输入邀请码。', 401);

  const invite = await env.DB.prepare('SELECT * FROM invite_codes WHERE code = ?').bind(code).first();
  if(!invite || Number(invite.revoked || 0)) return reject(env, meta, code, deviceHash, 'session', '邀请码已失效，请联系作者。', 403);

  const device = await env.DB.prepare(
    'SELECT * FROM invite_devices WHERE code = ? AND device_hash = ? AND session_token = ? AND revoked = 0'
  ).bind(code, deviceHash, token).first();
  if(!device) return reject(env, meta, code, deviceHash, 'session', '这台设备没有通行权，请重新验证邀请码。', 401);

  await env.DB.prepare(
    'UPDATE invite_devices SET last_seen = ?, last_ip_hash = ?, last_ua_hash = ? WHERE code = ? AND device_hash = ?'
  ).bind(nowMs(), meta.ipHash, meta.uaHash, code, deviceHash).run();
  const countRow = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM invite_devices WHERE code = ? AND revoked = 0'
  ).bind(code).first();
  await logAccess(env, { code, deviceHash, action:'session', ok:true, reason:'ok', ipHash:meta.ipHash, uaHash:meta.uaHash });
  return json({
    ok:true,
    code,
    deviceCount:Number(countRow && countRow.count || 0),
    maxDevices:Number(invite.max_devices || 2) || 2
  }, 200, env);
}

export default {
  async fetch(request, env){
    if(request.method === 'OPTIONS'){
      return new Response(null, { status: 204, headers: corsHeaders(env || {}) });
    }
    const url = new URL(request.url);
    if(request.method !== 'POST'){
      return json({ ok:false, message:'Only POST is supported' }, 405, env);
    }
    if(!env.DB){
      return json({ ok:false, message:'D1 DB binding is missing' }, 500, env);
    }
    if(url.pathname === '/verify') return handleVerify(request, env);
    if(url.pathname === '/session') return handleSession(request, env);
    return json({ ok:false, message:'Not found' }, 404, env);
  }
};
